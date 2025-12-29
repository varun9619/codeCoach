import * as vscode from 'vscode';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';

const execFileAsync = promisify(execFile);

export type DeepDiveData = {
  overview: {
    name: string;
    kind: vscode.SymbolKind;
    filePath: string;
    range: vscode.Range;
  };
  usages: vscode.Location[];
  blame: BlameEntry[];
  coverage?: CoverageSummary;
};

export type CoverageSummary = {
  totalLines: number;
  hitLines: number;
  uncoveredLines: number[];
  source: string;
};

export type BlameEntry = {
  line: number;
  author: string;
  time: string;
  summary: string;
};

export class DeepDiveProvider implements vscode.TreeDataProvider<DeepDiveItem> {
  private readonly emitter = new vscode.EventEmitter<DeepDiveItem | undefined | void>();
  readonly onDidChangeTreeData = this.emitter.event;

  private data?: DeepDiveData;
  private rootItems: DeepDiveItem[] = [];
  private parentMap = new Map<DeepDiveItem, DeepDiveItem | undefined>();

  setData(data?: DeepDiveData): void {
    this.data = data;
    if (this.data) {
      this.rootItems = [
        new DeepDiveItem('Overview', 'section'),
        new DeepDiveItem('Usages', 'section'),
        new DeepDiveItem('Blame', 'section'),
        new DeepDiveItem('Coverage', 'section')
      ];
    } else {
      this.rootItems = [];
    }
    this.parentMap.clear();
    for (const root of this.rootItems) {
      this.parentMap.set(root, undefined);
    }
    this.emitter.fire();
  }

  getRootItems(): DeepDiveItem[] {
    return this.rootItems;
  }

  getTreeItem(element: DeepDiveItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: DeepDiveItem): vscode.ProviderResult<DeepDiveItem[]> {
    if (!this.data) {
      const hint = new DeepDiveItem('Select a symbol and run Code Coach: Deep Dive', 'hint');
      this.parentMap.set(hint, undefined);
      return [hint];
    }

    if (!element) {
      return this.rootItems;
    }

    if (element.section === 'overview') {
      const overview = this.data.overview;
      const relPath = vscode.workspace.asRelativePath(overview.filePath);
      const items = [
        new DeepDiveItem(`Symbol: ${overview.name}`, 'item'),
        new DeepDiveItem(`Kind: ${symbolKindLabel(overview.kind)}`, 'item'),
        new DeepDiveItem(`Location: ${relPath}:${overview.range.start.line + 1}`, 'item', {
          uri: vscode.Uri.file(overview.filePath),
          range: overview.range
        })
      ];
      for (const item of items) this.parentMap.set(item, element);
      return items;
    }

    if (element.section === 'usages') {
      if (this.data.usages.length === 0) {
        return [new DeepDiveItem('No usages found', 'item')];
      }
      const items = this.data.usages.slice(0, 20).map(loc => {
        const label = `${vscode.workspace.asRelativePath(loc.uri.fsPath)}:${loc.range.start.line + 1}`;
        return new DeepDiveItem(label, 'item', { uri: loc.uri, range: loc.range });
      });
      for (const item of items) this.parentMap.set(item, element);
      return items;
    }

    if (element.section === 'blame') {
      if (this.data.blame.length === 0) {
        return [new DeepDiveItem('No blame info available', 'item')];
      }
      const items = this.data.blame.slice(0, 10).map(entry => {
        const label = `${entry.author} — ${entry.summary}`;
        const description = `L${entry.line} • ${entry.time}`;
        return new DeepDiveItem(label, 'item', undefined, description);
      });
      for (const item of items) this.parentMap.set(item, element);
      return items;
    }

    if (element.section === 'coverage') {
      const coverage = this.data.coverage;
      if (!coverage) {
        return [new DeepDiveItem('Coverage not found (lcov.info missing)', 'item')];
      }
      const percent = coverage.totalLines === 0 ? 0 : Math.round((coverage.hitLines / coverage.totalLines) * 100);
      const summary = `Coverage: ${coverage.hitLines}/${coverage.totalLines} (${percent}%)`;
      const items: DeepDiveItem[] = [new DeepDiveItem(summary, 'item', undefined, coverage.source)];
      if (coverage.uncoveredLines.length > 0) {
        items.push(new DeepDiveItem(`Uncovered lines: ${coverage.uncoveredLines.join(', ')}`, 'item'));
      }
      for (const item of items) this.parentMap.set(item, element);
      return items;
    }

    return [];
  }

  getParent(element: DeepDiveItem): vscode.ProviderResult<DeepDiveItem> {
    return this.parentMap.get(element);
  }
}

export class DeepDiveItem extends vscode.TreeItem {
  section?: 'overview' | 'usages' | 'blame' | 'coverage';

  constructor(
    label: string,
    kind: 'section' | 'item' | 'hint',
    location?: { uri: vscode.Uri; range: vscode.Range },
    description?: string
  ) {
    super(label, kind === 'section' ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None);
    this.description = description;

    if (kind === 'section') {
      this.section = label.toLowerCase() as DeepDiveItem['section'];
    }

    if (location) {
      this.command = {
        command: 'codeCoach.openLocation',
        title: 'Open Location',
        arguments: [location.uri, location.range]
      };
    }
  }
}

export async function buildDeepDiveData(
  document: vscode.TextDocument,
  position: vscode.Position
): Promise<DeepDiveData | undefined> {
  const symbols = (await vscode.commands.executeCommand(
    'vscode.executeDocumentSymbolProvider',
    document.uri
  )) as vscode.DocumentSymbol[] | undefined;

  if (!symbols || symbols.length === 0) return undefined;

  const enclosing = findEnclosingSymbol(symbols, position);
  if (!enclosing) return undefined;

  const refs = (await vscode.commands.executeCommand(
    'vscode.executeReferenceProvider',
    document.uri,
    enclosing.selectionRange.start
  )) as vscode.Location[] | undefined;

  const usages = (refs ?? []).filter(
    ref => !(ref.uri.fsPath === document.uri.fsPath && ref.range.start.line === enclosing.selectionRange.start.line)
  );

  const blame = await loadBlame(document, enclosing.range);
  const coverage = await loadCoverage(document, enclosing.range);

  return {
    overview: {
      name: enclosing.name,
      kind: enclosing.kind,
      filePath: document.uri.fsPath,
      range: enclosing.range
    },
    usages,
    blame,
    coverage
  };
}

function findEnclosingSymbol(symbols: vscode.DocumentSymbol[], position: vscode.Position): vscode.DocumentSymbol | undefined {
  for (const sym of symbols) {
    if (!sym.range.contains(position)) continue;
    const child = findEnclosingSymbol(sym.children, position);
    return child ?? sym;
  }
  return undefined;
}

function symbolKindLabel(kind: vscode.SymbolKind): string {
  switch (kind) {
    case vscode.SymbolKind.Function:
      return 'Function';
    case vscode.SymbolKind.Method:
      return 'Method';
    case vscode.SymbolKind.Constructor:
      return 'Constructor';
    case vscode.SymbolKind.Class:
      return 'Class';
    case vscode.SymbolKind.Module:
      return 'Module';
    default:
      return 'Symbol';
  }
}

async function loadBlame(document: vscode.TextDocument, range: vscode.Range): Promise<BlameEntry[]> {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!workspaceFolder) return [];

  const startLine = range.start.line + 1;
  const endLine = Math.min(range.end.line + 1, startLine + 80);

  try {
    const { stdout } = await execFileAsync(
      'git',
      ['blame', '--porcelain', `-L`, `${startLine},${endLine}`, document.uri.fsPath],
      { cwd: workspaceFolder.uri.fsPath }
    );

    return parseBlamePorcelain(stdout);
  } catch {
    return [];
  }
}

function parseBlamePorcelain(text: string): BlameEntry[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const entries: BlameEntry[] = [];
  let current: Partial<BlameEntry> = {};

  for (const line of lines) {
    if (!line.trim()) continue;

    if (/^[0-9a-f]{8,}\s/.test(line)) {
      const parts = line.split(' ');
      const lineNumber = Number(parts[2]);
      current = { line: lineNumber };
      continue;
    }

    if (line.startsWith('author ')) current.author = line.replace('author ', '').trim();
    if (line.startsWith('author-time ')) {
      const ts = Number(line.replace('author-time ', '').trim());
      if (!Number.isNaN(ts)) {
        current.time = new Date(ts * 1000).toLocaleDateString();
      }
    }
    if (line.startsWith('summary ')) current.summary = line.replace('summary ', '').trim();

    if (line.startsWith('\t')) {
      if (current.line && current.author && current.summary && current.time) {
        entries.push(current as BlameEntry);
      }
      current = {};
    }
  }

  return entries;
}

async function loadCoverage(document: vscode.TextDocument, range: vscode.Range): Promise<CoverageSummary | undefined> {
  const files = await vscode.workspace.findFiles('**/lcov.info', '**/node_modules/**', 5);
  if (files.length === 0) return undefined;

  for (const file of files) {
    try {
      const data = await vscode.workspace.fs.readFile(file);
      const text = Buffer.from(data).toString('utf8');
      const summary = parseLcovForFile(text, document.uri.fsPath, range);
      if (summary) return summary;
    } catch {
      continue;
    }
  }

  return undefined;
}

function parseLcovForFile(text: string, targetPath: string, range: vscode.Range): CoverageSummary | undefined {
  const normalizedTarget = path.normalize(targetPath);
  const lines = text.replace(/\r\n/g, '\n').split('\n');

  let inFile = false;
  let filePath = '';
  const hitsByLine = new Map<number, number>();

  for (const line of lines) {
    if (line.startsWith('SF:')) {
      filePath = path.normalize(line.slice(3).trim());
      inFile = filePath === normalizedTarget || path.resolve(filePath) === path.resolve(normalizedTarget);
      continue;
    }
    if (!inFile) continue;
    if (line.startsWith('DA:')) {
      const [lineNoRaw, hitsRaw] = line.slice(3).split(',');
      const lineNo = Number(lineNoRaw);
      const hits = Number(hitsRaw);
      if (!Number.isNaN(lineNo) && !Number.isNaN(hits)) {
        hitsByLine.set(lineNo, hits);
      }
      continue;
    }
    if (line.startsWith('end_of_record')) {
      if (inFile) break;
    }
  }

  if (hitsByLine.size === 0) return undefined;

  const start = range.start.line + 1;
  const end = range.end.line + 1;
  const lineNumbers = Array.from(hitsByLine.keys()).filter(l => l >= start && l <= end);
  if (lineNumbers.length === 0) return undefined;

  let hitLines = 0;
  const uncovered: number[] = [];
  for (const lineNo of lineNumbers) {
    const hits = hitsByLine.get(lineNo) ?? 0;
    if (hits > 0) hitLines += 1;
    else uncovered.push(lineNo);
  }

  return {
    totalLines: lineNumbers.length,
    hitLines,
    uncoveredLines: uncovered.slice(0, 10),
    source: 'lcov.info'
  };
}
