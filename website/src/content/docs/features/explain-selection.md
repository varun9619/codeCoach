---
title: Explain Selection
description: Get line-by-line explanations of any code
---

**Explain Selection** is Code Coach's core feature. Select any code and get a plain-English breakdown of what it does.

## How to Use

1. **Select code** in your editor
2. **Right-click** → **Code Coach: Explain Selection**
   - Or: Command Palette → "Explain Selection"
   - Or: Set a keyboard shortcut

## What You Get

### Line-by-Line Breakdown

Every line is explained with its purpose:

```
Line 1: Declares async function that returns a Promise
Line 2: Destructures config object with defaults
Line 3: Validates input against schema
Line 4: Calls external API with retry logic
Line 5: Transforms response to internal format
```

### With AI Enabled

AI adds context and insights:

- **Intent**: What the code is trying to accomplish
- **Assumptions**: What must be true for this to work
- **Edge Cases**: Inputs that might cause issues
- **Suggestions**: Potential improvements

### Citations

Every claim links to specific lines. Click to navigate.

## Configuration

### Output Surface

Choose where explanations appear:

```json
{
  "codeCoach.ui.explainSelection": "output" // or "panel" or "peek"
}
```

### Response Style

Control explanation verbosity:

```json
{
  "codeCoach.ai.responseStyle": "concise" // or "detailed"
}
```

### Templates

Use explanation templates for different audiences:

- **Junior Developer**: Define terms, step-by-step
- **Security Auditor**: Focus on vulnerabilities
- **Performance Analyst**: Highlight complexity

See [Explanation Templates](/team/templates/) for details.

## Examples

### Simple Function

```javascript
const double = (n) => n * 2;
```

Output:
```
Arrow function 'double' takes number 'n' and returns it multiplied by 2.
Pure function with no side effects.
```

### Complex Async Code

```typescript
async function processQueue(items: Item[]): Promise<Result[]> {
  const results = await Promise.all(
    items.map(item =>
      retryWithBackoff(() => processItem(item), 3)
    )
  );
  return results.filter(r => r.success);
}
```

Output:
```
Processes a queue of items in parallel with retry logic.

L2-5: Maps each item through processItem with 3 retry attempts
L6: Filters to return only successful results

Behaviors:
• Parallel execution (not sequential)
• Retries failed items up to 3 times
• Drops failures silently

Potential issues:
• All items process at once (no rate limiting)
• Failed items are silently dropped
• Memory usage scales with input size
```

## Tips

1. **Select meaningful chunks** - A whole function is better than random lines
2. **Include context** - Select imports or surrounding code if helpful
3. **Use templates** - Security review for auth code, performance for loops
4. **Read citations** - AI claims are verified against your code

## Related Features

- [Explain Why This Works](/features/explain-why/) - Assumptions and edge cases
- [Explain Diagnostics](/features/explain-diagnostics/) - Error explanations
- [Deep Dive](/features/deep-dive/) - Full symbol analysis
