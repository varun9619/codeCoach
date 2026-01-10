---
title: Explain Diagnostics
description: Get plain-English explanations for errors and warnings
---

**Explain Diagnostics** translates cryptic error messages into understandable explanations with actionable fixes.

## How to Use

1. **Place cursor** on a line with an error/warning (red/yellow squiggle)
2. **Command Palette** → "Explain Diagnostic"

## What You Get

### Plain-English Cause

```
ERROR: Cannot read property 'name' of undefined

CAUSE:
You're trying to access 'name' on a variable that is undefined.
This usually happens when:
• An object wasn't initialized
• An async operation hasn't completed
• A function returned undefined instead of an object
```

### Suggested Fixes

```
FIXES:
1. Add null check: if (user) { console.log(user.name); }
2. Use optional chaining: console.log(user?.name);
3. Provide default: const name = user?.name ?? 'Unknown';
```

### Quick Fix Actions

Code Coach offers automatic fixes for common errors:

- **Add optional chaining** (`?.`)
- **Add non-null assertion** (`!`)
- **Add null check** (`if (x)`)
- **Initialize variable**

## Common Errors Explained

### TypeScript Errors

| Code | Error | Explanation |
|------|-------|-------------|
| TS2322 | Type 'X' is not assignable to 'Y' | Value type doesn't match expected type |
| TS2345 | Argument of type 'X' is not assignable | Function parameter type mismatch |
| TS2531 | Object is possibly 'null' | Need to check for null before using |
| TS2339 | Property 'X' does not exist | Accessing non-existent property |

### JavaScript Errors

| Error | Explanation |
|-------|-------------|
| ReferenceError: X is not defined | Using variable before declaration |
| TypeError: Cannot read property of undefined | Accessing property on undefined value |
| SyntaxError: Unexpected token | Invalid JavaScript syntax |

## Trace Diagnostic Origin

For complex errors, use **Trace Diagnostic Origin** to find the root cause:

1. **Place cursor** on error
2. **Command Palette** → "Trace Diagnostic Origin"

This traces the call chain to find where the bad value originated:

```
ERROR at: src/components/UserProfile.tsx:23
│
├── Called from: src/pages/Dashboard.tsx:45
│   └── user passed as prop (could be undefined)
│
└── Root cause: src/api/users.ts:12
    └── fetchUser() returns undefined on 404
```

## Configuration

### Output Surface

```json
{
  "codeCoach.ui.explainDiagnostic": "output"
}
```

### Enable Learning Resources

AI can include links to relevant documentation:

```json
{
  "codeCoach.ai.enabled": true
}
```

## Related Features

- [Explain Selection](/features/explain-selection/) - Understand any code
- [Code Smells](/features/code-smells/) - Detect potential issues
- [Deep Dive](/features/deep-dive/) - Full symbol analysis
