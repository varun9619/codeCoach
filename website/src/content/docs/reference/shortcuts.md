---
title: Keyboard Shortcuts
description: Recommended keyboard shortcuts for Code Coach
---

Code Coach doesn't set default keyboard shortcuts to avoid conflicts. Here are recommended bindings.

## Setting Up Shortcuts

1. Open Keyboard Shortcuts:
   - Mac: `Cmd+K Cmd+S`
   - Windows/Linux: `Ctrl+K Ctrl+S`
2. Search for "Code Coach"
3. Click the `+` icon to add a binding

## Recommended Bindings

### macOS

| Action | Shortcut |
|--------|----------|
| Explain Selection | `Cmd+Shift+E` |
| Explain Why This Works | `Cmd+Shift+W` |
| Explain Diagnostic | `Cmd+Shift+X` |
| Deep Dive | `Cmd+Shift+D` |
| Show Code Smells | `Cmd+Shift+S` |
| Explain Diff | `Cmd+Shift+G` |

### Windows/Linux

| Action | Shortcut |
|--------|----------|
| Explain Selection | `Ctrl+Shift+E` |
| Explain Why This Works | `Ctrl+Shift+W` |
| Explain Diagnostic | `Ctrl+Shift+X` |
| Deep Dive | `Ctrl+Shift+D` |
| Show Code Smells | `Ctrl+Shift+S` |
| Explain Diff | `Ctrl+Shift+G` |

## keybindings.json

Add to your `keybindings.json`:

```json
[
  {
    "key": "cmd+shift+e",
    "command": "codeCoach.explainSelection",
    "when": "editorHasSelection"
  },
  {
    "key": "cmd+shift+w",
    "command": "codeCoach.explainWhyWorks",
    "when": "editorHasSelection"
  },
  {
    "key": "cmd+shift+x",
    "command": "codeCoach.explainDiagnostic",
    "when": "editorTextFocus"
  },
  {
    "key": "cmd+shift+d",
    "command": "codeCoach.deepDive",
    "when": "editorTextFocus"
  },
  {
    "key": "cmd+shift+s",
    "command": "codeCoach.showCodeSmells",
    "when": "editorTextFocus"
  },
  {
    "key": "cmd+shift+g",
    "command": "codeCoach.explainDiff"
  }
]
```

For Windows/Linux, replace `cmd` with `ctrl`.

## Context-Specific Shortcuts

### Only When Text Selected

```json
{
  "key": "cmd+shift+e",
  "command": "codeCoach.explainSelection",
  "when": "editorHasSelection && editorTextFocus"
}
```

### Only in Specific Languages

```json
{
  "key": "cmd+shift+e",
  "command": "codeCoach.explainSelection",
  "when": "editorLangId == typescript || editorLangId == javascript"
}
```

### Disable in Specific Contexts

```json
{
  "key": "cmd+shift+e",
  "command": "-codeCoach.explainSelection",
  "when": "editorLangId == markdown"
}
```

## Chord Shortcuts

Use two-key sequences:

```json
{
  "key": "cmd+k cmd+e",
  "command": "codeCoach.explainSelection",
  "when": "editorHasSelection"
},
{
  "key": "cmd+k cmd+d",
  "command": "codeCoach.deepDive",
  "when": "editorTextFocus"
}
```

## Related

- [All Commands](/reference/commands/) - Command reference
- [Quick Start](/getting-started/quick-start/) - Getting started
