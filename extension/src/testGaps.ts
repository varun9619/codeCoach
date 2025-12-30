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

type CoverageCacheEntry = {
  mtime: number;
  byFile: Map<string, FileCoverage>;
};

type CoverageFormat = 'lcov' | 'istanbul';

type CoverageFile = {
  uri: vscode.Uri;
  format: CoverageFormat;
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

const lcovCache = new Map<string, CoverageCacheEntry>();
const istanbulCache = new Map<string, CoverageCacheEntry>();
let coverageFilesCache: { updatedAt: number; files: CoverageFile[] } | undefined;

const gapStore = new Map<string, TestGap>();
const gapKeysByDoc = new Map<string, string[]>();

const COVERAGE_CACHE_TTL_MS = 5000;

export async function getBranchCoverage(
  document: vscode.TextDocument
): Promise<{ data: FileCoverage; source: string } | undefined> {
  const coverageFiles = await getCoverageFiles();
  if (coverageFiles.length === 0) return undefined;

  const targetPath = normalizeFilePath(document.uri.fsPath);
  for (const file of coverageFiles) {
    const cache =
      file.format === 'lcov' ? await loadLcovCache(file.uri) : await loadIstanbulCache(file.uri);
    const entry = findCoverageEntry(cache.byFile, targetPath);
    if (entry) {
      return { data: entry, source: path.basename(file.uri.fsPath) };
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

async function getCoverageFiles(): Promise<CoverageFile[]> {
  const now = Date.now();
  if (coverageFilesCache && now - coverageFilesCache.updatedAt < COVERAGE_CACHE_TTL_MS) {
    return coverageFilesCache.files;
  }

  const patterns = getCoveragePatterns();
  const exclude = '**/node_modules/**';
  const filesMap = new Map<string, CoverageFile>();

  for (const pattern of patterns) {
    const uris = await vscode.workspace.findFiles(pattern, exclude, 10);
    for (const uri of uris) {
      const format = coverageFormatForUri(uri);
      if (!format) continue;
      filesMap.set(uri.toString(), { uri, format });
    }
  }

  const files = Array.from(filesMap.values());
  coverageFilesCache = { updatedAt: now, files };
  return files;
}

async function loadLcovCache(uri: vscode.Uri): Promise<CoverageCacheEntry> {
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

async function loadIstanbulCache(uri: vscode.Uri): Promise<CoverageCacheEntry> {
  const stat = await vscode.workspace.fs.stat(uri);
  const cached = istanbulCache.get(uri.fsPath);
  if (cached && cached.mtime === stat.mtime) return cached;

  const raw = await vscode.workspace.fs.readFile(uri);
  const text = Buffer.from(raw).toString('utf8');
  const byFile = parseIstanbulCoverage(text);
  const next = { mtime: stat.mtime, byFile };
  istanbulCache.set(uri.fsPath, next);
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

function parseIstanbulCoverage(text: string): Map<string, FileCoverage> {
  const byFile = new Map<string, FileCoverage>();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    return byFile;
  }
  if (!json || typeof json !== 'object') return byFile;

  for (const [filePath, entry] of Object.entries(json)) {
    if (!entry || typeof entry !== 'object') continue;
    const branchMap = (entry as any).branchMap ?? {};
    const branchHits = (entry as any).b ?? {};
    const branches: BranchData[] = [];

    for (const [id, map] of Object.entries(branchMap)) {
      const loc = (map as any)?.loc?.start;
      const line = typeof loc?.line === 'number' ? loc.line : undefined;
      if (!line) continue;
      const hits = (branchHits as any)[id] as number[] | undefined;
      if (!Array.isArray(hits)) continue;
      hits.forEach((hit, idx) => {
        branches.push({
          line,
          block: Number(id),
          branch: idx,
          taken: typeof hit === 'number' ? hit : null
        });
      });
    }

    if (branches.length > 0) {
      byFile.set(filePath, { lines: new Map<number, number>(), branches });
    }
  }

  return byFile;
}

function normalizeFilePath(value: string): string {
  return path.resolve(path.normalize(value));
}

function findCoverageEntry(byFile: Map<string, FileCoverage>, targetPath: string): FileCoverage | undefined {
  const normalizedTarget = normalizeFilePath(targetPath);
  for (const [filePath, entry] of byFile) {
    if (!filePath) continue;
    const normalizedEntry = normalizeFilePath(filePath);
    if (normalizedEntry === normalizedTarget) return entry;
    if (!path.isAbsolute(filePath) && normalizedTarget.endsWith(path.normalize(filePath))) return entry;
  }
  return undefined;
}

function getCoveragePatterns(): string[] {
  const config = vscode.workspace.getConfiguration('codeCoach');
  const raw = config.get<string[]>('testGaps.coveragePaths');
  if (raw && raw.length > 0) {
    return raw.filter(Boolean);
  }
  return ['**/lcov.info', '**/coverage-final.json'];
}

function coverageFormatForUri(uri: vscode.Uri): CoverageFormat | undefined {
  const basename = path.basename(uri.fsPath).toLowerCase();
  if (basename === 'lcov.info' || basename.endsWith('.lcov')) return 'lcov';
  if (basename.endsWith('.json')) return 'istanbul';
  return undefined;
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
