---
title: Your First Explanation
description: Walk through a complete Code Coach explanation
---

## Understanding the Output

When you run **Explain Selection**, Code Coach provides structured output. Let's break down what you see.

### Example Code

```typescript
export async function fetchUser(id: string): Promise<User | null> {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return null;
  }
}
```

### Static Analysis Output

Without AI enabled, you get structural analysis:

```
Function: fetchUser
├─ Parameters: id (string)
├─ Returns: Promise<User | null>
├─ Complexity: Low (1 branch)
└─ Analysis:
   Line 2: Try block wraps async operation
   Line 3: Fetches user data from REST endpoint
   Line 4-6: Validates HTTP response status
   Line 7: Parses JSON response
   Line 8-10: Catches errors, logs, returns null
```

### AI-Enhanced Output

With AI enabled, you get deeper insights:

```
This function fetches a user by ID from a REST API with error handling.

Key behaviors:
• Uses async/await for clean Promise handling
• Validates response.ok before parsing (catches 4xx/5xx errors)
• Returns null on failure instead of throwing (caller-friendly)

Potential issues:
• No timeout—could hang on slow networks
• JSON parse errors would be caught but obscured
• Type assertion on response.json() trusts server response

Citations:
• L4-6: HTTP error detection [response.ok]
• L7: JSON parsing without validation
• L10: Graceful null return on error
```

## Citation Links

Every claim is linked to specific lines. Click a citation to jump to that code.

## AI Verification

When AI makes claims, Code Coach verifies them against your code:

- ✅ **Verified**: Claim matches code structure
- ⚠️ **Unverified**: Claim couldn't be confirmed
- ❌ **Incorrect**: Claim contradicts code

This prevents AI hallucinations from misleading you.

## Output Surfaces

Code Coach can display explanations in different places:

| Surface | Best For |
|---------|----------|
| **Output Channel** | Quick reference, copy-paste |
| **Panel** | Detailed reading, scrolling |
| **Peek View** | Inline, don't leave editor |

Configure in settings: `codeCoach.ui.explainSelection`

## Next Steps

- [All core features](/features/explain-selection/)
- [Configure output surfaces](/config/settings/)
- [Team templates](/team/templates/)
