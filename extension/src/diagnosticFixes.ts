import * as vscode from 'vscode';

const SUPPORTED_LANGS = new Set(['javascript', 'typescript', 'javascriptreact', 'typescriptreact']);

export class DiagnosticFixCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    if (!SUPPORTED_LANGS.has(document.languageId)) return [];

    const actions: vscode.CodeAction[] = [];
    for (const diag of context.diagnostics) {
      if (diag.source && diag.source !== 'ts') {
        continue;
      }
      actions.push(...buildFixActions(document, diag));
    }

    return actions;
  }
}

function buildFixActions(document: vscode.TextDocument, diag: vscode.Diagnostic): vscode.CodeAction[] {
  const actions: vscode.CodeAction[] = [];
  const code = typeof diag.code === 'number' ? diag.code : undefined;

  const explain = new vscode.CodeAction('Code Coach: Explain Diagnostic', vscode.CodeActionKind.QuickFix);
  explain.command = {
    command: 'codeCoach.explainDiagnosticAt',
    title: 'Code Coach: Explain Diagnostic',
    arguments: [document.uri, diag.range.start]
  };
  explain.diagnostics = [diag];
  actions.push(explain);

  if (code === 2532 || code === 2531 || code === 2722) {
    const optionalFix = buildOptionalChainingFix(document, diag);
    if (optionalFix) actions.push(optionalFix);
    const nonNullFix = buildNonNullAssertionFix(document, diag);
    if (nonNullFix) actions.push(nonNullFix);
  }

  if (code === 7006) {
    const implicitAnyFix = buildImplicitAnyFix(document, diag);
    if (implicitAnyFix) actions.push(implicitAnyFix);
  }

  return actions;
}

function buildOptionalChainingFix(document: vscode.TextDocument, diag: vscode.Diagnostic): vscode.CodeAction | undefined {
  const { lineText, dotIndex } = findDotBeforeRange(document, diag.range);
  if (dotIndex === undefined) return undefined;
  if (dotIndex > 0 && lineText[dotIndex - 1] === '?') return undefined;

  const action = new vscode.CodeAction('Use optional chaining (?.)', vscode.CodeActionKind.QuickFix);
  action.command = {
    command: 'codeCoach.applyDiagnosticFix',
    title: 'Use optional chaining (?.)',
    arguments: [
      document.uri,
      new vscode.Position(diag.range.start.line, dotIndex),
      '?',
      'optional-chaining'
    ]
  };
  action.diagnostics = [diag];
  action.isPreferred = true;
  return action;
}

function buildNonNullAssertionFix(document: vscode.TextDocument, diag: vscode.Diagnostic): vscode.CodeAction | undefined {
  const { lineText, dotIndex } = findDotBeforeRange(document, diag.range);
  if (dotIndex === undefined) return undefined;
  if (dotIndex > 0 && lineText[dotIndex - 1] === '!') return undefined;

  const action = new vscode.CodeAction('Assert non-null (!)', vscode.CodeActionKind.QuickFix);
  action.command = {
    command: 'codeCoach.applyDiagnosticFix',
    title: 'Assert non-null (!)',
    arguments: [
      document.uri,
      new vscode.Position(diag.range.start.line, dotIndex),
      '!',
      'non-null-assertion'
    ]
  };
  action.diagnostics = [diag];
  return action;
}

function buildImplicitAnyFix(document: vscode.TextDocument, diag: vscode.Diagnostic): vscode.CodeAction | undefined {
  const range = diag.range;
  const line = document.lineAt(range.end.line).text;
  const after = line.slice(range.end.character, range.end.character + 2);
  if (after.startsWith(':')) return undefined;

  const action = new vscode.CodeAction('Add type annotation (: any)', vscode.CodeActionKind.QuickFix);
  action.command = {
    command: 'codeCoach.applyDiagnosticFix',
    title: 'Add type annotation (: any)',
    arguments: [document.uri, range.end, ': any', 'implicit-any']
  };
  action.diagnostics = [diag];
  return action;
}

function findDotBeforeRange(
  document: vscode.TextDocument,
  range: vscode.Range
): { lineText: string; dotIndex?: number } {
  const lineText = document.lineAt(range.start.line).text;
  const searchStart = Math.max(0, range.start.character - 1);
  const dotIndex = lineText.lastIndexOf('.', searchStart);
  if (dotIndex === -1) return { lineText };
  return { lineText, dotIndex };
}
