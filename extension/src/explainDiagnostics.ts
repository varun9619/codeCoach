import * as vscode from 'vscode';

export function explainDiagnostic(diag: vscode.Diagnostic, languageId: string): string {
  const header: string[] = [];
  header.push('Code Coach — Explain Diagnostic');
  header.push('');
  header.push(`Message: ${diag.message}`);
  if (diag.source) header.push(`Source: ${diag.source}`);
  if (diag.code !== undefined) header.push(`Code: ${String(diag.code)}`);
  header.push('');

  const details = explainByKnownPatterns(diag, languageId);

  const out: string[] = [...header];

  out.push('What likely caused this:');
  for (const c of details.causes) out.push(`- ${c}`);
  out.push('');

  out.push('How to fix it:');
  for (const f of details.fixes) out.push(`- ${f}`);
  out.push('');

  out.push('Notes:');
  out.push('- This explanation is static (based on the diagnostic + code shape).');
  out.push('- If you run into this repeatedly, we can add a specific rule for this code.');

  return out.join('\n');
}

type DiagnosticExplanation = {
  causes: string[];
  fixes: string[];
};

function explainByKnownPatterns(diag: vscode.Diagnostic, languageId: string): DiagnosticExplanation {
  const code = typeof diag.code === 'number' ? diag.code : undefined;
  const message = diag.message;

  // TypeScript / JavaScript diagnostics from the TS server commonly include numeric codes.
  if (languageId.startsWith('typescript') || languageId.startsWith('javascript')) {
    if (code === 2304) {
      return {
        causes: [
          'A variable/function name is being used before it is declared, or it was never imported/defined.',
          'A typo in the identifier name.'
        ],
        fixes: [
          'Check spelling and casing of the name.',
          'If it comes from another file, add the missing import/export.',
          'If it should be global (e.g., window property), add the correct type definitions or qualify it (e.g., window.foo).'
        ]
      };
    }

    if (code === 2339) {
      return {
        causes: [
          'You are accessing a property that TypeScript does not think exists on that type.',
          'The variable is typed too broadly (e.g., unknown, {}, any[]) or to the wrong interface.'
        ],
        fixes: [
          'Confirm the object’s type and the property name.',
          'Narrow the type (e.g., with an if check, "in" check, or a type guard).',
          'Update the type/interface so the property is declared, or fix the data shape.'
        ]
      };
    }

    if (code === 2322) {
      return {
        causes: [
          'A value of one type is being assigned to a variable/property expecting a different type.'
        ],
        fixes: [
          'Adjust the value to match the expected type, or change the declared type if the new type is correct.',
          'If you are sure it is safe, use a more precise type assertion (but prefer fixing the types over forcing it).'
        ]
      };
    }

    if (code === 2345) {
      return {
        causes: [
          'A function argument does not match the parameter type the function expects.'
        ],
        fixes: [
          'Check the function signature and ensure you pass the correct type/shape.',
          'Convert/parse the value before passing it (e.g., string → number).',
          'If the function should accept more types, widen the parameter type intentionally.'
        ]
      };
    }
  }

  // Generic fallback
  const genericCauses: string[] = [];
  const genericFixes: string[] = [];

  if (/cannot find/i.test(message)) {
    genericCauses.push('Something referenced here is not in scope or not available.');
    genericFixes.push('Check imports, spelling, and whether the symbol is defined in this file/module.');
  }

  if (/type/i.test(message) || /assignable/i.test(message)) {
    genericCauses.push('There is a type mismatch between what the code provides and what it expects.');
    genericFixes.push('Inspect the expected type and make the value match it, or update the types to reflect reality.');
  }

  if (genericCauses.length === 0) genericCauses.push('The diagnostic message indicates a constraint the code is violating.');
  if (genericFixes.length === 0) genericFixes.push('Read the message closely and adjust the code to satisfy it (imports, types, or control flow).');

  return { causes: genericCauses, fixes: genericFixes };
}
