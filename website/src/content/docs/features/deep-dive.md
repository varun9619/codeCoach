---
title: Deep Dive
description: Comprehensive symbol analysis in one place
---

**Deep Dive** provides everything you need to know about a symbol: usages, history, tests, coverage, and AI summary.

## How to Use

1. **Place cursor** on any symbol (function, class, variable)
2. **Command Palette** → "Deep Dive"
3. View the **Code Coach** sidebar panel

## What You Get

### Overview Section

Basic information about the symbol:

```
calculateTax (Function)
├─ File: src/utils/tax.ts:23
├─ Signature: (amount: number, rate: number) => number
├─ Exported: Yes
└─ JSDoc: Calculates tax with rounding to 2 decimal places
```

### Usages Section

Where this symbol is used:

```
Usages (12 references)
├─ src/checkout/Cart.tsx:45
├─ src/checkout/Cart.tsx:67
├─ src/orders/OrderSummary.tsx:23
├─ src/reports/TaxReport.tsx:89
└─ ... (8 more)
```

Click any usage to navigate directly.

### Blame Section

Who wrote and modified this code:

```
Git Blame
├─ Created: alice@team.com (2024-06-15)
├─ Last Modified: bob@team.com (2024-11-20)
└─ 3 contributors total
```

### History Section

Recent changes to this symbol:

```
History (last 10 commits)
├─ abc1234 "Fix rounding edge case" (2024-11-20)
├─ def5678 "Add JSDoc comments" (2024-10-15)
└─ ghi9012 "Initial implementation" (2024-06-15)
```

### Tests Section

Related test files:

```
Tests
├─ src/utils/__tests__/tax.test.ts
│   ├─ calculateTax › returns 0 for negative amounts
│   ├─ calculateTax › rounds to 2 decimal places
│   └─ calculateTax › handles 0% rate
└─ Coverage: 87% (13/15 lines)
```

### AI Summary

With AI enabled, get a contextual summary:

```
AI Summary:
This utility function calculates tax amounts with proper rounding.
It's used primarily in the checkout flow and reporting modules.
The function has been stable for 5 months with only documentation changes.
Consider: Adding support for locale-specific rounding rules.
```

## Sidebar Actions

### Pin Symbol

Keep important symbols accessible:

1. Click the **pin icon** in Deep Dive
2. Symbol appears in "Pinned" section at top
3. Quick access without re-searching

### Export as Markdown

Share symbol analysis:

1. Click **Export** button
2. Choose location
3. Get formatted markdown with all sections

### Filter Sections

Show only relevant sections:

```json
{
  "codeCoach.deepDive.sections": ["overview", "usages", "tests"]
}
```

## Team Pins

Mark symbols as important for the whole team:

1. Click **Pin for Team**
2. Add annotation: "Core tax logic - check before modifying"
3. Team members see pin in their Deep Dive

See [Team Pinned Symbols](/team/pins/) for details.

## Configuration

### Visible Sections

```json
{
  "codeCoach.deepDive.sections": [
    "overview",
    "usages",
    "blame",
    "history",
    "tests",
    "coverage",
    "summary"
  ]
}
```

### History Limit

```json
{
  "codeCoach.deepDive.historyLimit": 10
}
```

### Enable AI Summary

```json
{
  "codeCoach.deepDive.aiSummary": true,
  "codeCoach.ai.enabled": true
}
```

## Related Features

- [Explain Selection](/features/explain-selection/) - Quick code explanation
- [Team Pins](/team/pins/) - Share important symbols
- [Knowledge Graph](/team/graph/) - Visualize dependencies
