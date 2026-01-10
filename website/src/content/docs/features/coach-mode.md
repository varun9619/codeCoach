---
title: Coach Mode
description: Inline explanatory hints as you code
---

**Coach Mode** displays inline hints throughout your code, helping you understand as you navigate.

## How to Use

1. **Command Palette** → "Toggle Coach Mode"
2. Hints appear as inline annotations
3. Toggle off when you don't need them

## What You See

### Function Hints

Above each function:

```typescript
// 💡 Async function returning Promise<User[]>
// 💡 Fetches from /api/users with auth header
async function getUsers(): Promise<User[]> {
```

### Complex Logic Hints

Near tricky code:

```typescript
const result = items
  .filter(x => x.active)  // 💡 Removes inactive items
  .map(x => x.value)      // 💡 Extracts value field
  .reduce((a, b) => a + b, 0);  // 💡 Sums all values
```

### Warning Hints

For potential issues:

```typescript
// ⚠️ This can throw - consider try/catch
JSON.parse(data);
```

## Configuration

### Enable/Disable

```json
{
  "codeCoach.coachMode.enabled": false
}
```

### Maximum Hints Per File

Prevent visual clutter:

```json
{
  "codeCoach.coachMode.maxHints": 50
}
```

### Hint Types

Control which hints appear:

```json
{
  "codeCoach.coachMode.hints": {
    "functions": true,
    "complexity": true,
    "warnings": true,
    "types": false
  }
}
```

## Best Practices

1. **Use temporarily** - Enable when exploring new code
2. **Disable for familiar code** - Reduces noise
3. **Combine with Deep Dive** - Coach Mode for overview, Deep Dive for details

## Related Features

- [Explain Selection](/features/explain-selection/) - On-demand explanations
- [Deep Dive](/features/deep-dive/) - Full symbol analysis
- [Code Smells](/features/code-smells/) - Quality warnings
