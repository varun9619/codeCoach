---
title: Explain Diff
description: Understand what changed in git diffs and PRs
---

**Explain Diff** provides plain-English summaries of git changes with citations to specific modifications.

## How to Use

### Explain Working Changes

1. Make some code changes
2. **Command Palette** → "Explain Diff"
3. See summary of uncommitted changes

### Explain Staged Changes

1. Stage some changes (`git add`)
2. **Command Palette** → "Explain Diff (Staged)"
3. See summary of what will be committed

### Explain a Commit

1. Open **Timeline** view
2. Right-click a commit
3. Select **Explain Commit**

## What You Get

### Summary

High-level overview of changes:

```
DIFF SUMMARY: HEAD vs working tree (5 files, +127 -43)

This change implements user authentication validation with
email format checks and password strength rules.
```

### File-by-File Breakdown

```
FILES CHANGED:

▼ src/auth/validate.ts (+45 -12)
  • Added validateEmail() function (L23-34)
  • Modified validatePassword() for 8+ char requirement
  • Added EMAIL_REGEX constant

▼ src/auth/types.ts (+8 -0)
  • Added ValidationResult interface
  • Added ValidationError type

▼ src/auth/__tests__/validate.test.ts (+74 -31)
  • Added tests for email validation
  • Updated password tests for new rules
```

### Potential Concerns

AI highlights possible issues:

```
⚠️ POTENTIAL CONCERNS:

1. PASSWORD_REGEX allows spaces - intentional?
   Location: src/auth/validate.ts:15

2. No rate limiting on validation endpoint
   Location: src/auth/controller.ts:45

3. Test coverage for unicode emails missing
   Location: src/auth/__tests__/validate.test.ts
```

### Citations

Every claim links to the actual diff. Click to see the change.

## Configuration

### Output Surface

```json
{
  "codeCoach.ui.explainDiff": "panel"
}
```

### Max Files

Limit analysis for large diffs:

```json
{
  "codeCoach.explainDiff.maxFiles": 20
}
```

### Include Test Files

```json
{
  "codeCoach.explainDiff.includeTestFiles": true
}
```

### Show Concerns

```json
{
  "codeCoach.explainDiff.showPotentialConcerns": true
}
```

## Use Cases

### Code Review

Before reviewing a PR:

1. **Explain Diff** on the PR branch
2. Get quick understanding of scope
3. Focus review on flagged concerns

### Pre-Commit Check

Before committing:

1. Stage changes
2. **Explain Diff (Staged)**
3. Verify changes match your intent
4. Catch accidental modifications

### Understanding History

When investigating issues:

1. Find relevant commits in Timeline
2. **Explain Commit** on each
3. Trace how code evolved

## SCM Integration

Access directly from Source Control view:

1. Open **Source Control** panel
2. Click **...** menu → **Explain Changes**

Or right-click changed file → **Explain This File's Changes**

## Related Features

- [Explain Selection](/features/explain-selection/) - Explain current code
- [Change Subscriptions](/team/subscriptions/) - Get notified of changes
- [Deep Dive](/features/deep-dive/) - View file history
