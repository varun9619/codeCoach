import * as vscode from 'vscode';
import { getBranchCoverage, getTestGap, summarizeBranches } from './testGaps';

const SUPPORTED_LANGS = new Set(['javascript', 'typescript', 'javascriptreact', 'typescriptreact']);

export class TestGapCodeLensProvider implements vscode.CodeLensProvider {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.emitter.event;

  refresh(): void {
    this.emitter.fire();
  }

  async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    if (!SUPPORTED_LANGS.has(document.languageId)) return [];

    const coverage = await getBranchCoverage(document);
    if (!coverage) return [];

    const summary = summarizeBranches(coverage.data.branches);
    if (summary.totalBranches === 0) return [];

    const lenses: vscode.CodeLens[] = [];
    lenses.push(
      new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title: formatLensTitle(summary.coveredBranches, summary.totalBranches),
        command: 'codeCoach.showTestGaps',
        arguments: []
      })
    );

    const symbols = (await vscode.commands.executeCommand(
      'vscode.executeDocumentSymbolProvider',
      document.uri
    )) as vscode.DocumentSymbol[] | undefined;

    if (!symbols) return lenses;

    const fnSymbols = collectFunctionSymbols(symbols);
    for (const sym of fnSymbols) {
      const scoped = summarizeBranches(coverage.data.branches, sym.range);
      if (scoped.totalBranches === 0) continue;
      lenses.push(
        new vscode.CodeLens(sym.selectionRange, {
          title: formatLensTitle(scoped.coveredBranches, scoped.totalBranches),
          command: 'codeCoach.showTestGaps',
          arguments: [sym.range]
        })
      );
    }

    return lenses;
  }
}

export class TestGapCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diag of context.diagnostics) {
      if (diag.source !== 'Code Coach') continue;
      const code = typeof diag.code === 'string' ? diag.code : undefined;
      if (!code || !code.startsWith('testgap:')) continue;
      const [_, lineRaw, branchRaw] = code.split(':');
      const line = Number(lineRaw);
      const branch = Number(branchRaw);
      if (Number.isNaN(line) || Number.isNaN(branch)) continue;

      const gap = getTestGap(document.uri, line, branch);
      const title = gap ? `Generate test stub (branch ${branch})` : 'Generate test stub';

      const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
      action.command = {
        command: 'codeCoach.generateTestStub',
        title,
        arguments: [document.uri, line, branch]
      };
      action.diagnostics = [diag];
      actions.push(action);
    }

    return actions;
  }
}

function collectFunctionSymbols(symbols: vscode.DocumentSymbol[]): vscode.DocumentSymbol[] {
  const result: vscode.DocumentSymbol[] = [];
  for (const sym of symbols) {
    if (isFunctionSymbol(sym)) result.push(sym);
    if (sym.children?.length) result.push(...collectFunctionSymbols(sym.children));
  }
  return result;
}

function isFunctionSymbol(sym: vscode.DocumentSymbol): boolean {
  return (
    sym.kind === vscode.SymbolKind.Function ||
    sym.kind === vscode.SymbolKind.Method ||
    sym.kind === vscode.SymbolKind.Constructor
  );
}

function formatLensTitle(covered: number, total: number): string {
  const uncovered = Math.max(0, total - covered);
  return `Tests: ${covered} passing, ${uncovered} branches uncovered`;
}
