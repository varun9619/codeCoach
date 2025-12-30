import * as vscode from 'vscode';
import * as path from 'path';

type BranchData = {
  line: number;
  block: number;
  branch: number;
  taken: number | null;
};

type FileCoverage = {
  lines: Map<number, number>;
  branches: BranchData[];
};

type LcovCacheEntry = {
  mtime: number;
  byFile: Map<string, FileCoverage>;
};

export type BranchSummary = {
  totalBranches: number;
  coveredBranches: number;
  uncoveredBranches: BranchData[];
};

export type TestGap = {
  line: number;
  block: number;
  branch: number;
  taken: number | null;
  lineText: string;
  range: vscode.Range;
  suggestion?: string;
};

const lcovCache = new Map<string, LcovCacheEntry>();
let lcovFilesCache: { updatedAt: number; files: vscode.Uri[] } | undefined;

const gapStore = new Map<string, TestGap>();
const gapKeysByDoc = new Map<string, string[]>();

const LCOV_CACHE_TTL_MS = 5000;

export async function getBranchCoverage(
  document: vscode.TextDocument
): Promise<{ data: FileCoverage; source: string } | undefined> {
  const lcovFiles = await getLcovFiles();
  if (lcovFiles.length === 0) return undefined;

  const targetPath = normalizeFilePath(document.uri.fsPath);
  for (const lcovFile of lcovFiles) {
    const cache = await loadLcovCache(lcovFile);
    const entry = cache.byFile.get(targetPath);
    if (entry) {
      return { data: entry, source: path.basename(lcovFile.fsPath) };
    }
  }

  return undefined;
}

export function summarizeBranches(branches: BranchData[], range?: vscode.Range): BranchSummary {
  const start = range ? range.start.line + 1 : 1;
  const end = range ? range.end.line + 1 : Number.MAX_SAFE_INTEGER;

  const inRange = branches.filter(branch => branch.line >= start && branch.line <= end);
  const coveredBranches = inRange.filter(branch => (branch.taken ?? 0) > 0).length;
  const uncoveredBranches = inRange.filter(branch => (branch.taken ?? 0) === 0);

  return {
    totalBranches: inRange.length,
    coveredBranches,
    uncoveredBranches
  };
}

export function buildTestGaps(document: vscode.TextDocument, uncovered: BranchData[]): TestGap[] {
  const gaps: TestGap[] = [];

  for (const branch of uncovered) {
    const lineText = readLineText(document, branch.line);
    const range = new vscode.Range(
      Math.max(0, branch.line - 1),
      0,
      Math.max(0, branch.line - 1),
      Math.max(1, lineText.length)
    );

    gaps.push({
      line: branch.line,
      block: branch.block,
      branch: branch.branch,
      taken: branch.taken,
      lineText,
      range,
      suggestion: buildSuggestion(lineText, branch.branch)
    });
  }

  return gaps;
}

export function storeTestGaps(uri: vscode.Uri, gaps: TestGap[]): void {
  const docKey = uri.toString();
  const existing = gapKeysByDoc.get(docKey) ?? [];
  for (const key of existing) {
    gapStore.delete(key);
  }

  const newKeys: string[] = [];
  for (const gap of gaps) {
    const key = gapKey(uri, gap.line, gap.branch);
    gapStore.set(key, gap);
    newKeys.push(key);
  }

  gapKeysByDoc.set(docKey, newKeys);
}

export function getTestGap(uri: vscode.Uri, line: number, branch: number): TestGap | undefined {
  return gapStore.get(gapKey(uri, line, branch));
}

export function toTestGapDiagnostic(gap: TestGap): vscode.Diagnostic {
  const diag = new vscode.Diagnostic(
    gap.range,
    `Uncovered branch on line ${gap.line}: ${gap.lineText || 'Condition not captured'}`,
    vscode.DiagnosticSeverity.Hint
  );
  diag.source = 'Code Coach';
  diag.code = `testgap:${gap.line}:${gap.branch}`;
  return diag;
}

async function getLcovFiles(): Promise<vscode.Uri[]> {
  const now = Date.now();
  if (lcovFilesCache && now - lcovFilesCache.updatedAt < LCOV_CACHE_TTL_MS) {
    return lcovFilesCache.files;
  }

  const files = await vscode.workspace.findFiles('**/lcov.info', '**/node_modules/**', 5);
  lcovFilesCache = { updatedAt: now, files };
  return files;
}

async function loadLcovCache(uri: vscode.Uri): Promise<LcovCacheEntry> {
  const stat = await vscode.workspace.fs.stat(uri);
  const cached = lcovCache.get(uri.fsPath);
  if (cached && cached.mtime === stat.mtime) return cached;

  const raw = await vscode.workspace.fs.readFile(uri);
  const text = Buffer.from(raw).toString('utf8');
  const byFile = parseLcov(text);
  const next = { mtime: stat.mtime, byFile };
  lcovCache.set(uri.fsPath, next);
  return next;
}

function parseLcov(text: string): Map<string, FileCoverage> {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const byFile = new Map<string, FileCoverage>();

  let currentPath = '';
  let lineHits = new Map<number, number>();
  let branches: BranchData[] = [];
  let inFile = false;

  const flush = () => {
    if (!inFile || !currentPath) return;
    byFile.set(currentPath, { lines: lineHits, branches });
  };

  for (const raw of lines) {
    if (raw.startsWith('SF:')) {
      flush();
      currentPath = normalizeFilePath(raw.slice(3).trim());
      lineHits = new Map<number, number>();
      branches = [];
      inFile = true;
      continue;
    }

    if (!inFile) continue;

    if (raw.startsWith('DA:')) {
      const [lineRaw, hitsRaw] = raw.slice(3).split(',');
      const line = Number(lineRaw);
      const hits = Number(hitsRaw);
      if (!Number.isNaN(line) && !Number.isNaN(hits)) {
        lineHits.set(line, hits);
      }
      continue;
    }

    if (raw.startsWith('BRDA:')) {
      const [lineRaw, blockRaw, branchRaw, takenRaw] = raw.slice(5).split(',');
      const line = Number(lineRaw);
      const block = Number(blockRaw);
      const branch = Number(branchRaw);
      const taken = takenRaw === '-' ? null : Number(takenRaw);
      if (!Number.isNaN(line) && !Number.isNaN(block) && !Number.isNaN(branch)) {
        branches.push({
          line,
          block,
          branch,
          taken: Number.isNaN(taken as number) ? null : taken
        });
      }
      continue;
    }

    if (raw.startsWith('end_of_record')) {
      flush();
      currentPath = '';
      inFile = false;
      continue;
    }
  }

  flush();
  return byFile;
}

function normalizeFilePath(value: string): string {
  return path.resolve(path.normalize(value));
}

function readLineText(document: vscode.TextDocument, lineNumber: number): string {
  if (lineNumber < 1 || lineNumber > document.lineCount) return '';
  return document.lineAt(lineNumber - 1).text.trim();
}

function buildSuggestion(lineText: string, branchIndex: number): string | undefined {
  const label = branchIndex === 0 ? 'true' : branchIndex === 1 ? 'false' : undefined;
  if (!label) return undefined;

  const condition = extractCondition(lineText);
  if (!condition) return `Make condition evaluate to ${label}`;

  const sample = sampleInputForCondition(condition, label === 'true');
  if (sample) {
    return `Make condition evaluate to ${label} (e.g., ${sample})`;
  }

  return `Make condition evaluate to ${label}`;
}

function extractCondition(lineText: string): string | undefined {
  const trimmed = lineText.trim();
  if (!trimmed) return undefined;

  const ifMatch = trimmed.match(/^if\s*\((.*)\)\s*\{?\s*$/);
  if (ifMatch) return ifMatch[1];

  const whileMatch = trimmed.match(/^while\s*\((.*)\)\s*\{?\s*$/);
  if (whileMatch) return whileMatch[1];

  const elseIfMatch = trimmed.match(/^else\s+if\s*\((.*)\)\s*\{?\s*$/);
  if (elseIfMatch) return elseIfMatch[1];

  return trimmed;
}

function sampleInputForCondition(condition: string, targetTrue: boolean): string | undefined {
  const match = condition.match(/([A-Za-z_$][\w.$]*)\s*(===|!==|>=|<=|>|<)\s*([^\s&|)]+)/);
  if (!match) return undefined;

  const [, left, op, rightRaw] = match;
  const right = rightRaw.replace(/[);]+$/, '');
  const numeric = Number(right);
  const isNumber = !Number.isNaN(numeric) && /^[+-]?\d+(\.\d+)?$/.test(right);

  if (op === '===' || op === '!==') {
    const shouldEqual = op === '===' ? targetTrue : !targetTrue;
    return shouldEqual ? `${left} = ${right}` : `${left} = /* not ${right} */`;
  }

  if (!isNumber) return undefined;

  switch (op) {
    case '>':
      return targetTrue ? `${left} = ${numeric + 1}` : `${left} = ${numeric}`;
    case '>=':
      return targetTrue ? `${left} = ${numeric}` : `${left} = ${numeric - 1}`;
    case '<':
      return targetTrue ? `${left} = ${numeric - 1}` : `${left} = ${numeric}`;
    case '<=':
      return targetTrue ? `${left} = ${numeric}` : `${left} = ${numeric + 1}`;
    default:
      return undefined;
  }
}

function gapKey(uri: vscode.Uri, line: number, branch: number): string {
  return `${uri.toString()}:${line}:${branch}`;
}
