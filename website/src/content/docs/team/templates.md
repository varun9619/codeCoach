---
title: Explanation Templates
description: Tailor explanations for different audiences
---

**Explanation Templates** customize AI explanations for specific audiences like junior developers, security reviewers, or performance analysts.

## Built-in Templates

| Template | Focus | Best For |
|----------|-------|----------|
| **General** | Balanced explanation | Default use |
| **Junior Developer** | Define terms, step-by-step | Onboarding, learning |
| **Security Auditor** | Vulnerabilities, risks | Security reviews |
| **Performance Analyst** | Complexity, bottlenecks | Optimization |
| **Code Reviewer** | Issues, edge cases | PR reviews |
| **Quick Summary** | One paragraph max | Quick understanding |

## How to Use

### Select Template on Explain

1. **Select code** → **Explain Selection**
2. Template picker appears
3. Choose template
4. Get tailored explanation

### Set Default Template

```json
{
  "codeCoach.templates.default": "junior-dev"
}
```

### Disable Picker

Use default template without asking:

```json
{
  "codeCoach.templates.showPicker": false
}
```

## Template Examples

### Junior Developer Template

Input:
```typescript
const memoize = <T>(fn: (arg: T) => T) => {
  const cache = new Map<T, T>();
  return (arg: T) => cache.get(arg) ?? cache.set(arg, fn(arg)).get(arg)!;
};
```

Output:
```
EXPLANATION FOR JUNIOR DEVELOPERS:

What is this?
A "memoize" function that remembers previous results to avoid
recalculating them. This is called "memoization" - a performance
optimization technique.

How it works step by step:
1. Creates a storage box (Map) to remember results
2. When called, first checks if we've seen this input before
3. If yes: returns the saved result (fast!)
4. If no: calculates result, saves it, then returns it

Key terms:
• Generic <T>: Works with any data type
• Map: A key-value storage (like a dictionary)
• ?? (nullish coalescing): "use left side, unless it's null"

Why use this?
Speeds up expensive calculations that get called with the same
inputs repeatedly.
```

### Security Auditor Template

Same input, different output:

```
SECURITY ANALYSIS:

Risk Assessment: LOW

Observations:
• No user input validation
• Map grows unbounded (potential memory DoS)
• Type assertion (!) could mask errors

Vulnerabilities:
⚠️ Memory exhaustion: Cache has no size limit
   - Attacker could exhaust memory with unique inputs
   - Recommendation: Add maxSize parameter

⚠️ Prototype pollution: Map keys could be exploited
   - Unlikely with Map, but verify input source

Safe practices present:
✓ Uses Map instead of object (no prototype chain issues)
✓ Generics maintain type safety
✓ No eval or dynamic code execution
```

## Custom Templates

Create your own templates in `.code-coach/templates/`:

### Template File Format

`.code-coach/templates/api-review.json`:

```json
{
  "id": "api-review",
  "name": "API Review",
  "description": "Focus on API design and contracts",
  "prompt": {
    "systemContext": "You are reviewing code for API design quality.",
    "focusAreas": [
      "Input/output contracts",
      "Error handling patterns",
      "Backward compatibility",
      "Documentation completeness"
    ],
    "outputFormat": "structured",
    "maxLength": 500
  }
}
```

### Register Template

Templates in `.code-coach/templates/` are auto-discovered.

Or specify a custom path:

```json
{
  "codeCoach.templates.customTemplatesPath": "./my-templates/"
}
```

## Configuration

### Recent Templates

```json
{
  "codeCoach.templates.maxRecentTemplates": 5
}
```

### Default Template

```json
{
  "codeCoach.templates.default": "general"
}
```

## Related Features

- [Explain Selection](/features/explain-selection/) - Use templates
- [Team Pins](/team/pins/) - Combine with templates
- [Shared Cache](/team/cache/) - Cache template-specific explanations
