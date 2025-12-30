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
  const commentPrefix = commentPrefixForLanguage(document.languageId);

  if (kind === 'debugger' || kind === 'console-log') {
    return buildPreviewFix('Remove statement', document, range, '', diag, kind, 'replace');
  }

  if (kind === 'explicit-any') {
    return buildPreviewFix('Replace any with unknown', document, range, 'unknown', diag, kind, 'replace');
  }

  if (kind === 'eqeq') {
    const replacement = text.replace('==', '===').replace('!=', '!==');
    if (replacement === text) return undefined;
    return buildPreviewFix('Use strict equality', document, range, replacement, diag, kind, 'replace');
  }

  if (kind === 'sql-injection') {
    return buildPreviewFix(
      'Add TODO: parameterize query',
      document,
      range,
      `${commentPrefix}TODO(Code Coach): parameterize query and validate inputs\n`,
      diag,
      kind,
      'insert'
    );
  }

  if (kind === 'command-injection') {
    return buildPreviewFix(
      'Add TODO: validate command inputs',
      document,
      range,
      `${commentPrefix}TODO(Code Coach): validate/escape command inputs or use args array\n`,
      diag,
      kind,
      'insert'
    );
  }

  if (kind === 'unsafe-eval') {
    return buildPreviewFix(
      'Add TODO: remove eval',
      document,
      range,
      `${commentPrefix}TODO(Code Coach): remove eval and replace with safe parser\n`,
      diag,
      kind,
      'insert'
    );
  }

  return undefined;
}

function buildPreviewFix(
  title: string,
  document: vscode.TextDocument,
  range: vscode.Range,
  replacement: string,
  diag: vscode.Diagnostic,
  smellKind: string,
  editMode: 'replace' | 'insert'
): vscode.CodeAction {
  const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
  action.command = {
    command: 'codeCoach.previewSmellFix',
    title,
    arguments: [document.uri, range, replacement, title, editMode, smellKind]
  };
  action.diagnostics = [diag];
  return action;
}

function commentPrefixForLanguage(languageId: string): string {
  if (languageId === 'python') return '# ';
  return '// ';
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
