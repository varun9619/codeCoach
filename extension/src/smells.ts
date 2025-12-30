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
  const isTest = isTestFile(document.uri.fsPath);

  const visit = (node: ts.Node, depth = 0) => {
    const nestingNode = isNestingNode(node);
    const nextDepth = nestingNode ? depth + 1 : depth;

    if (nestingNode && depth >= 3) {
      const range = nodeRange(document, sourceFile, node);
      smells.push({
        type: 'maintainability',
        severity: vscode.DiagnosticSeverity.Information,
        code: 'deep-nesting',
        message: 'Deeply nested control flow (depth 4+).',
        suggestion: 'Consider extracting helper functions or early returns to reduce nesting.',
        range
      });
    }

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
      ts.forEachChild(node, child => visit(child, nextDepth));
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

      const range = nodeRange(document, sourceFile, node);
      const lineCount = Math.max(1, range.end.line - range.start.line + 1);
      if (lineCount > 80) {
        smells.push({
          type: 'maintainability',
          severity: vscode.DiagnosticSeverity.Information,
          code: 'long-function',
          message: `Function is ${lineCount} lines long.`,
          suggestion: 'Split the function into smaller helpers to improve readability.',
          range: nodeNameRange(document, sourceFile, node) ?? range
        });
      }
    }

    if (!isTest && node.kind === ts.SyntaxKind.AnyKeyword) {
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

    if (!isTest && ts.isDebuggerStatement(node)) {
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
        if (!isTest) {
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

    if (ts.isAwaitExpression(node) && loopStack.length > 0) {
      const range = nodeRange(document, sourceFile, node);
      smells.push({
        type: 'performance',
        severity: vscode.DiagnosticSeverity.Warning,
        code: 'await-in-loop',
        message: 'Await used inside a loop can serialize async work.',
        suggestion: 'Consider Promise.all or batching to run async work in parallel.',
        range
      });
    }

    ts.forEachChild(node, child => visit(child, nextDepth));
  };

  visit(sourceFile, 0);
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

function isNestingNode(node: ts.Node): boolean {
  return (
    ts.isIfStatement(node) ||
    isLoop(node) ||
    ts.isSwitchStatement(node) ||
    ts.isTryStatement(node)
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

function isTestFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  return (
    normalized.includes('/__tests__/') ||
    normalized.includes('.test.') ||
    normalized.includes('.spec.') ||
    normalized.endsWith('.test.js') ||
    normalized.endsWith('.test.ts') ||
    normalized.endsWith('.spec.js') ||
    normalized.endsWith('.spec.ts')
  );
}
