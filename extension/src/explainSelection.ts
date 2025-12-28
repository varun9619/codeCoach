import ts from 'typescript';

export type ExplainSelectionInput = {
  text: string;
  languageId: string;
  startLineNumber: number; // 1-based in the original document
};

export function explainSelection(input: ExplainSelectionInput): string {
  const lines = input.text.replace(/\r\n/g, '\n').split('\n');
  const numbered = lines
    .map((line, index) => ({ line, lineNumber: input.startLineNumber + index }))
    .filter(({ line }) => line.trim().length > 0);

  // Try a light TypeScript parse to detect high-level constructs.
  const wrapped = `function __codeCoachWrap__() {\n${input.text}\n}`;
  const sf = ts.createSourceFile('selection.ts', wrapped, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  const constructs = summarizeTopLevelConstructs(sf);

  const out: string[] = [];
  out.push('Code Coach — Explain Selection');
  out.push('');

  if (constructs.length > 0) {
    out.push('What I see:');
    for (const c of constructs) out.push(`- ${c}`);
    out.push('');
  }

  out.push('Line-by-line walkthrough:');
  for (const { line, lineNumber } of numbered) {
    out.push(`- Line ${lineNumber}: ${explainLine(line)}`);
  }

  out.push('');
  out.push('Notes:');
  out.push('- This is a static explanation (no runtime values).');
  out.push('- If you want, I can also summarize intent + edge cases for this selection.');

  return out.join('\n');
}

function summarizeTopLevelConstructs(sf: ts.SourceFile): string[] {
  const result: string[] = [];
  const body = findWrappedFunctionBody(sf);
  if (!body) return result;

  for (const stmt of body.statements) {
    if (ts.isVariableStatement(stmt)) {
      result.push('Variable declaration');
    } else if (ts.isIfStatement(stmt)) {
      result.push('Conditional (if/else)');
    } else if (ts.isForStatement(stmt) || ts.isForOfStatement(stmt) || ts.isForInStatement(stmt)) {
      result.push('Loop (for/for..of/for..in)');
    } else if (ts.isWhileStatement(stmt) || ts.isDoStatement(stmt)) {
      result.push('Loop (while/do..while)');
    } else if (ts.isReturnStatement(stmt)) {
      result.push('Return statement');
    } else if (ts.isTryStatement(stmt)) {
      result.push('Error handling (try/catch/finally)');
    } else if (ts.isExpressionStatement(stmt)) {
      result.push('Expression / function call');
    }
  }

  return dedupe(result);
}

function findWrappedFunctionBody(sf: ts.SourceFile): ts.Block | undefined {
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name?.text === '__codeCoachWrap__') {
      return stmt.body ?? undefined;
    }
  }
  return undefined;
}

function explainLine(rawLine: string): string {
  const line = rawLine.trim();

  if (/^\/\//.test(line)) return 'Comment.';
  if (/^\/\*.*\*\/$/.test(line)) return 'Block comment.';

  if (/^(const|let|var)\s+/.test(line)) {
    return 'Declares a variable (and maybe initializes it).';
  }

  if (/^function\s+/.test(line) || /=>\s*\{?\s*$/.test(line)) {
    return 'Defines a function.';
  }

  if (/^if\s*\(/.test(line)) return 'Starts a conditional branch (if).';
  if (/^else\b/.test(line)) return 'Alternative branch (else).';

  if (/^for\s*\(/.test(line) || /^for\s*\(.*\bof\b/.test(line) || /^for\s*\(.*\bin\b/.test(line)) {
    return 'Starts a loop (for).';
  }

  if (/^while\s*\(/.test(line)) return 'Starts a loop (while).';
  if (/^do\b/.test(line)) return 'Starts a do..while loop body.';

  if (/^return\b/.test(line)) return 'Returns a value from the current function.';
  if (/^throw\b/.test(line)) return 'Throws an error (exits the current flow).';

  if (/^try\b/.test(line)) return 'Starts a try block (error handling).';
  if (/^catch\b/.test(line)) return 'Handles an error from a try block (catch).';
  if (/^finally\b/.test(line)) return 'Runs cleanup code whether an error happened or not (finally).';

  if (/^[}\]]/.test(line)) return 'Closes a block or structure.';

  if (/=/.test(line) && /;\s*$/.test(line)) return 'Assigns a value (or updates state).';
  if (/\w+\s*\(.*\)\s*;?$/.test(line)) return 'Calls a function.';

  return 'Performs an operation; needs surrounding context to explain more precisely.';
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}
