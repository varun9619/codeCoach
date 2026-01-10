import * as vscode from 'vscode';

export function explainDiagnostic(
  diag: vscode.Diagnostic,
  languageId: string,
  locationLabel?: string
): string {
  const header: string[] = [];
  header.push('Code Coach — Explain Diagnostic');
  header.push('');
  if (locationLabel) header.push(`Location: ${locationLabel}`);
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

    if (code === 2307) {
      return {
        causes: [
          'TypeScript cannot resolve the module path or does not have type declarations for it.',
          'The module is missing from node_modules or tsconfig path mappings.'
        ],
        fixes: [
          'Check the import path and file name casing.',
          'Install the package or its types (e.g., `npm i` or `npm i -D @types/...`).',
          'If using path aliases, confirm `tsconfig.json` paths/baseUrl are correct.'
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

    if (code === 2341) {
      return {
        causes: [
          'You are accessing a private property outside of its declaring class.'
        ],
        fixes: [
          'Access the value through a public method or getter.',
          'If appropriate, change the visibility to protected/public.',
          'Refactor to avoid reaching into private state.'
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

    if (code === 2355) {
      return {
        causes: [
          'A function that is declared to return a value is missing a return on some code paths.'
        ],
        fixes: [
          'Ensure every code path returns a value.',
          'Change the return type to void if returning a value is not required.'
        ]
      };
    }

    if (code === 2367) {
      return {
        causes: [
          'You are comparing two types that do not overlap, which is likely a bug.'
        ],
        fixes: [
          'Check the types involved and correct the comparison.',
          'Narrow the types before comparison or adjust the types so they overlap.'
        ]
      };
    }

    if (code === 2532 || code === 2531) {
      return {
        causes: [
          'A value might be null or undefined at this point in the code path.'
        ],
        fixes: [
          'Add a guard before using the value (if check, early return, or default).',
          'Use optional chaining when accessing properties (`obj?.prop`).',
          'If you are certain the value exists, use a non-null assertion (`obj!.prop`) with caution.'
        ]
      };
    }

    if (code === 2722) {
      return {
        causes: [
          'You are calling a function that could be undefined at runtime.'
        ],
        fixes: [
          'Check the function exists before calling it (`if (fn) fn()` or `fn?.()`).',
          'Tighten the type so the function is always defined.'
        ]
      };
    }

    if (code === 2741) {
      return {
        causes: [
          'A required property is missing from the object you are assigning.'
        ],
        fixes: [
          'Add the missing property with the correct type.',
          'If the property should be optional, update the type definition.'
        ]
      };
    }

    if (code === 2488) {
      return {
        causes: [
          'You are iterating with `for..of` over a value that is not iterable.'
        ],
        fixes: [
          'Ensure the value is an array or implements Symbol.iterator.',
          'Convert it to an array before iterating.'
        ]
      };
    }

    if (code === 2551) {
      return {
        causes: [
          'You are accessing a property that does not exist; TypeScript suggests a similar name.'
        ],
        fixes: [
          'Use the suggested property name if it is correct.',
          'Update the type/interface to include the missing property if needed.'
        ]
      };
    }

    if (code === 7006) {
      return {
        causes: [
          'A function parameter has an implicit `any` type because no annotation is provided.'
        ],
        fixes: [
          'Add an explicit type annotation to the parameter.',
          'If this is intentional, adjust your TS config (noImplicitAny) or use `: any` explicitly.'
        ]
      };
    }

    if (code === 7005) {
      return {
        causes: [
          'A variable implicitly has type `any` because no type is inferred.'
        ],
        fixes: [
          'Add an explicit type annotation.',
          'Initialize the variable so TypeScript can infer the type.'
        ]
      };
    }

    if (code === 7031) {
      return {
        causes: [
          'A binding element (e.g., destructuring) implicitly has `any` type.'
        ],
        fixes: [
          'Add a type annotation to the destructured parameter or object.',
          'Define a type for the object being destructured.'
        ]
      };
    }

    if (code === 2554) {
      return {
        causes: [
          'The function call does not match the required number of parameters.'
        ],
        fixes: [
          'Check the function signature and pass the required arguments.',
          'If some arguments are optional, ensure the signature marks them as optional.'
        ]
      };
    }

    if (code === 18047 || code === 18048) {
      return {
        causes: [
          'A value is possibly null or undefined and is being used without a guard.'
        ],
        fixes: [
          'Add a null/undefined check or default value.',
          'Use optional chaining or non-null assertion if safe.'
        ]
      };
    }

    if (code === 6133) {
      return {
        causes: [
          'A variable is declared but never used.'
        ],
        fixes: [
          'Remove the unused variable, or use it if it was intended.',
          'If this is a required placeholder, prefix it with `_` to silence the warning.'
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
