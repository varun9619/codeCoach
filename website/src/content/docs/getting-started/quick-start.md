---
title: Quick Start
description: Get up and running with Code Coach in 5 minutes
---

## Your First Explanation

### 1. Select Code

Open any JavaScript or TypeScript file and select some code:

```javascript
function calculateTax(amount, rate) {
  if (amount <= 0) return 0;
  const tax = amount * (rate / 100);
  return Math.round(tax * 100) / 100;
}
```

### 2. Explain It

Right-click and select **Code Coach: Explain Selection**, or use the Command Palette:

- `Cmd+Shift+P` (Mac) / `Ctrl+Shift+P` (Windows)
- Type "Explain Selection"
- Press Enter

### 3. Read the Explanation

Code Coach provides a line-by-line breakdown:

```
Line 1: Defines a function 'calculateTax' that takes an amount and tax rate
Line 2: Guards against zero or negative amounts by returning 0
Line 3: Calculates tax by multiplying amount by rate as a decimal
Line 4: Rounds to 2 decimal places and returns the result
```

## Try More Commands

| Command | What It Does |
|---------|--------------|
| **Explain Why This Works** | Reveals assumptions, edge cases, potential breakpoints |
| **Explain Diagnostic** | Put cursor on error, get plain-English explanation |
| **Deep Dive** | Full analysis: usages, blame, history, tests |
| **Show Code Smells** | Detect complexity, dead code, nested callbacks |

## Enable AI (Optional)

For richer explanations powered by AI:

1. Get an API key from [OpenRouter](https://openrouter.ai) (recommended)
2. Run **Code Coach: Set AI API Key**
3. Select "OpenRouter" and paste your key

Now explanations include context-aware insights beyond static analysis.

## Keyboard Shortcuts

Set up shortcuts for frequent commands:

1. Open Keyboard Shortcuts (`Cmd+K Cmd+S`)
2. Search "Code Coach"
3. Click the + to add your preferred shortcut

Suggested bindings:
- `Cmd+Shift+E` → Explain Selection
- `Cmd+Shift+D` → Deep Dive

## Next Steps

- [Explain Selection in depth](/features/explain-selection/)
- [Configure AI providers](/config/ai-providers/)
- [Team features overview](/team/overview/)
