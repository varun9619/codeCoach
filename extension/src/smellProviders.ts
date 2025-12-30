import * as vscode from 'vscode';
import { analyzeDocumentForSmells, CodeSmell } from './smells';

const SUPPORTED_LANGS = new Set(['javascript', 'typescript', 'javascriptreact', 'typescriptreact']);

export class SmellCodeLensProvider implements vscode.CodeLensProvider {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.emitter.event;

  refresh(): void {
    this.emitter.fire();
  }

  async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    if (!SUPPORTED_LANGS.has(document.languageId)) return [];

    const smells = analyzeDocumentForSmells(document);
    if (smells.length === 0) return [];

    const lenses: vscode.CodeLens[] = [];
    lenses.push(
      new vscode.CodeLens(new vscode.Range(0, 0, 0, 0), {
        title: `Smells: ${smells.length}`,
        command: 'codeCoach.showSmells',
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
      const count = smells.filter(smell => sym.range.intersection(smell.range)).length;
      if (count === 0) continue;
      lenses.push(
        new vscode.CodeLens(sym.selectionRange, {
          title: `Smells: ${count}`,
          command: 'codeCoach.showSmells',
          arguments: [sym.range]
        })
      );
    }

    return lenses;
  }
}

export class SmellCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diag of context.diagnostics) {
      if (diag.source !== 'Code Coach') continue;
      const code = typeof diag.code === 'string' ? diag.code : undefined;
      if (!code || !code.startsWith('smell:')) continue;
      const kind = code.replace('smell:', '');
      const fix = buildFix(document, diag, kind);
      if (fix) actions.push(fix);
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

function buildFix(document: vscode.TextDocument, diag: vscode.Diagnostic, kind: string): vscode.CodeAction | undefined {
  const range = diag.range;
  const text = document.getText(range);

  if (kind === 'debugger' || kind === 'console-log') {
    const action = new vscode.CodeAction('Remove statement', vscode.CodeActionKind.QuickFix);
    const edit = new vscode.WorkspaceEdit();
    edit.delete(document.uri, range);
    action.edit = edit;
    action.diagnostics = [diag];
    return action;
  }

  if (kind === 'explicit-any') {
    const action = new vscode.CodeAction('Replace any with unknown', vscode.CodeActionKind.QuickFix);
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, range, 'unknown');
    action.edit = edit;
    action.diagnostics = [diag];
    return action;
  }

  if (kind === 'eqeq') {
    const replacement = text.replace('==', '===').replace('!=', '!==');
    if (replacement === text) return undefined;
    const action = new vscode.CodeAction('Use strict equality', vscode.CodeActionKind.QuickFix);
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, range, replacement);
    action.edit = edit;
    action.diagnostics = [diag];
    return action;
  }

  return undefined;
}

export function toSmellDiagnostic(smell: CodeSmell): vscode.Diagnostic {
  const diag = new vscode.Diagnostic(
    smell.range,
    `${smell.message} Suggestion: ${smell.suggestion}`,
    smell.severity
  );
  diag.source = 'Code Coach';
  diag.code = `smell:${smell.code}`;
  return diag;
}
