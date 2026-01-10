---
title: Code Smells
description: Detect and fix quality issues in your code
---

**Code Smells** detects quality issues like high complexity, dead code, and nested callbacks.

## How to Use

1. Open any JavaScript/TypeScript file
2. **Command Palette** → "Show Code Smells"
3. Issues appear as CodeLens annotations above functions

## Detected Smells

### High Cyclomatic Complexity

Functions with too many branches:

```typescript
// ⚠️ Complexity: 12 (threshold: 10)
function processOrder(order) {
  if (order.type === 'retail') {
    if (order.discount) {
      // ...many nested conditions
    }
  }
}
```

**Fix**: Extract conditions into separate functions.

### Deep Nesting

Code nested more than 4 levels:

```typescript
// ⚠️ Nesting depth: 5
if (a) {
  if (b) {
    if (c) {
      if (d) {
        if (e) { // Too deep!
```

**Fix**: Use early returns or extract functions.

### Callback Hell

Nested callbacks instead of async/await:

```javascript
// ⚠️ Callback nesting detected
getData(function(a) {
  process(a, function(b) {
    save(b, function(c) {
      notify(c);
    });
  });
});
```

**Fix**: Convert to async/await.

### Dead Code

Unreachable code after return/throw:

```javascript
function example() {
  return 42;
  console.log('Never runs'); // ⚠️ Dead code
}
```

**Fix**: Remove unreachable code.

### Large Functions

Functions exceeding line threshold:

```typescript
// ⚠️ Function has 150 lines (threshold: 50)
function doEverything() {
  // ... too much code
}
```

**Fix**: Split into smaller, focused functions.

## Quick Fixes

Click the **lightbulb** on any smell to see fixes:

- **Extract function**: Move complex logic to new function
- **Convert to async/await**: Refactor callbacks
- **Remove dead code**: Delete unreachable lines

## Configuration

### Thresholds

```json
{
  "codeCoach.smells.complexityThreshold": 10,
  "codeCoach.smells.nestingThreshold": 4,
  "codeCoach.smells.lineLengthThreshold": 50
}
```

### Enable/Disable Specific Smells

```json
{
  "codeCoach.smells.enabled": {
    "complexity": true,
    "nesting": true,
    "callbacks": true,
    "deadCode": true,
    "largeFunction": true
  }
}
```

## Related Features

- [Test Gaps](/features/test-gaps/) - Find untested code
- [Explain Selection](/features/explain-selection/) - Understand smelly code
- [Deep Dive](/features/deep-dive/) - Full symbol analysis
