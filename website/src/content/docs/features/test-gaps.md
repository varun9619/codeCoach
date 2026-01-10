---
title: Test Gaps
description: Find untested code branches
---

**Test Gaps** analyzes your coverage data to find untested code paths that need attention.

## How to Use

1. Run your test suite with coverage: `npm test -- --coverage`
2. **Command Palette** → "Show Test Gaps"
3. Untested branches appear as CodeLens annotations

## What You Get

### Uncovered Lines

Lines that were never executed during tests:

```typescript
function processPayment(amount, method) {
  if (method === 'card') {
    // ✓ Covered
    return chargeCard(amount);
  } else if (method === 'crypto') {
    // ⚠️ NOT COVERED - Line 7-8
    return processCrypto(amount);
  }
  return null;
}
```

### Untested Branches

Conditional paths that weren't exercised:

```
Test Gaps in src/payment.ts:
├─ Line 7-8: 'crypto' payment path never tested
├─ Line 15: null return case never tested
└─ Line 23: error catch block never tested
```

### Coverage Summary

Quick view of file coverage:

```
Coverage: 67% (20/30 lines)
├─ Statements: 70%
├─ Branches: 55%
├─ Functions: 80%
└─ Lines: 67%
```

## Configuration

### Coverage File Paths

Tell Code Coach where to find coverage data:

```json
{
  "codeCoach.testGaps.coveragePaths": [
    "coverage/lcov.info",
    "coverage/coverage-final.json"
  ]
}
```

Supports:
- **lcov.info** - Standard LCOV format
- **coverage-final.json** - Istanbul JSON format

### Highlight Style

```json
{
  "codeCoach.testGaps.highlightStyle": "background" // or "border" or "gutter"
}
```

## Generating Coverage

### Jest

```bash
jest --coverage
```

### Vitest

```bash
vitest run --coverage
```

### NYC/Istanbul

```bash
nyc npm test
```

## Writing Missing Tests

Click a test gap to get suggestions:

```
Suggested test for uncovered branch (line 7-8):

test('processPayment handles crypto method', () => {
  const result = processPayment(100, 'crypto');
  expect(result).toBeDefined();
  expect(processCrypto).toHaveBeenCalledWith(100);
});
```

## Related Features

- [Code Smells](/features/code-smells/) - Find quality issues
- [Deep Dive](/features/deep-dive/) - See test coverage per symbol
- [Explain Selection](/features/explain-selection/) - Understand code before testing
