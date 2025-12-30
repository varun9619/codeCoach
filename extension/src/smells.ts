import * as vscode from 'vscode';
import ts from 'typescript';

export type CodeSmell = {
  type: 'performance' | 'maintainability' | 'correctness';
  severity: vscode.DiagnosticSeverity;
  code: string;
  message: string;
  suggestion: string;
  range: vscode.Range;
};

export function analyzeDocumentForSmells(document: vscode.TextDocument): CodeSmell[] {
  const text = document.getText();
  if (!text.trim()) return [];

  const scriptKind = getScriptKind(document.languageId);
  if (scriptKind === ts.ScriptKind.Unknown) return [];

  const sourceFile = ts.createSourceFile(document.fileName, text, ts.ScriptTarget.Latest, true, scriptKind);
  const smells: CodeSmell[] = [];
  const loopStack: ts.Node[] = [];

  const visit = (node: ts.Node) => {
    if (isLoop(node)) {
      if (loopStack.length >= 1) {
        const range = nodeRange(document, sourceFile, node);
        smells.push({
          type: 'performance',
          severity: vscode.DiagnosticSeverity.Warning,
          code: 'nested-loop',
          message: 'Nested loop detected. This can lead to O(n²) performance.',
          suggestion: 'Consider using a Map/Set for lookups or precomputing indexes.',
          range
        });
      }
      loopStack.push(node);
      ts.forEachChild(node, visit);
      loopStack.pop();
      return;
    }

    if (ts.isFunctionLike(node)) {
      const paramCount = node.parameters?.length ?? 0;
      if (paramCount > 5) {
        const range = nodeNameRange(document, sourceFile, node) ?? nodeRange(document, sourceFile, node);
        smells.push({
          type: 'maintainability',
          severity: vscode.DiagnosticSeverity.Information,
          code: 'many-params',
          message: `Function has ${paramCount} parameters.`,
          suggestion: 'Consider replacing parameters with a single options object.',
          range
        });
      }
    }

    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      const range = nodeRange(document, sourceFile, node);
      smells.push({
        type: 'maintainability',
        severity: vscode.DiagnosticSeverity.Information,
        code: 'explicit-any',
        message: 'Explicit "any" type reduces type safety.',
        suggestion: 'Prefer a specific type or an explicit union/interface.',
        range
      });
    }

    if (ts.isCatchClause(node) && node.block.statements.length === 0) {
      const range = nodeRange(document, sourceFile, node);
      smells.push({
        type: 'correctness',
        severity: vscode.DiagnosticSeverity.Warning,
        code: 'empty-catch',
        message: 'Empty catch block swallows errors.',
        suggestion: 'Log, rethrow, or handle the error explicitly.',
        range
      });
    }

    if (ts.isDebuggerStatement(node)) {
      const range = nodeRange(document, sourceFile, node);
      smells.push({
        type: 'maintainability',
        severity: vscode.DiagnosticSeverity.Information,
        code: 'debugger',
        message: 'Debugger statement left in code.',
        suggestion: 'Remove the debugger statement.',
        range
      });
    }

    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (
        ts.isPropertyAccessExpression(expr) &&
        ts.isIdentifier(expr.expression) &&
        expr.expression.text === 'console' &&
        expr.name.text === 'log'
      ) {
        const range = nodeRange(document, sourceFile, node);
        smells.push({
          type: 'maintainability',
          severity: vscode.DiagnosticSeverity.Information,
          code: 'console-log',
          message: 'console.log left in code.',
          suggestion: 'Remove the console.log or replace with a structured logger.',
          range
        });
      }
    }

    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      if (op === ts.SyntaxKind.EqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsToken) {
        const range = nodeRange(document, sourceFile, node);
        smells.push({
          type: 'correctness',
          severity: vscode.DiagnosticSeverity.Warning,
          code: 'eqeq',
          message: 'Non-strict equality comparison used.',
          suggestion: 'Prefer strict equality (=== / !==).',
          range
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return smells;
}

function isLoop(node: ts.Node): boolean {
  return (
    ts.isForStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node)
  );
}

function getScriptKind(languageId: string): ts.ScriptKind {
  switch (languageId) {
    case 'typescript':
      return ts.ScriptKind.TS;
    case 'typescriptreact':
      return ts.ScriptKind.TSX;
    case 'javascript':
      return ts.ScriptKind.JS;
    case 'javascriptreact':
      return ts.ScriptKind.JSX;
    default:
      return ts.ScriptKind.Unknown;
  }
}

function nodeRange(document: vscode.TextDocument, sourceFile: ts.SourceFile, node: ts.Node): vscode.Range {
  const start = document.positionAt(node.getStart(sourceFile, false));
  const end = document.positionAt(node.getEnd());
  return new vscode.Range(start, end);
}

function nodeNameRange(
  document: vscode.TextDocument,
  sourceFile: ts.SourceFile,
  node: ts.Node
): vscode.Range | undefined {
  if (
    (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isFunctionExpression(node)) &&
    node.name
  ) {
    return nodeRange(document, sourceFile, node.name);
  }
  return undefined;
}
