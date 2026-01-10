---
title: All Commands
description: Complete list of Code Coach commands
---

All available commands organized by category.

## Core Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| `Code Coach: Explain Selection` | - | Explain highlighted code |
| `Code Coach: Explain Why This Works` | - | Analyze assumptions and edge cases |
| `Code Coach: Explain Diagnostic` | - | Explain error under cursor |
| `Code Coach: Trace Diagnostic Origin` | - | Find root cause of error |
| `Code Coach: Trace Stack Trace` | - | Parse and link stack trace |
| `Code Coach: Deep Dive` | - | Full symbol analysis |
| `Code Coach: Show Code Smells` | - | Run smell detection |
| `Code Coach: Show Test Gaps` | - | Find untested branches |
| `Code Coach: Run Onboarding` | - | Replay first-run walkthrough |

## Deep Dive Commands

| Command | Description |
|---------|-------------|
| `Code Coach: Pin Deep Dive` | Pin current symbol |
| `Code Coach: Unpin Deep Dive` | Remove pin |
| `Code Coach: Deep Dive Sections` | Filter visible sections |
| `Code Coach: Export Deep Dive` | Export as markdown |

## AI Commands

| Command | Description |
|---------|-------------|
| `Code Coach: Set AI API Key` | Store API key securely |
| `Code Coach: Clear AI API Key` | Remove stored key |

## Team Intelligence Commands

| Command | Description |
|---------|-------------|
| `Code Coach: Explain Diff` | Explain git changes |
| `Code Coach: Show Team Pins` | View all team pins |
| `Code Coach: Create Tour` | Start new onboarding tour |
| `Code Coach: Add Tour Stop` | Add stop to current tour |
| `Code Coach: Start Tour` | Run an existing tour |
| `Code Coach: Subscribe to File Changes` | Watch for changes |
| `Code Coach: Manage Subscriptions` | View/edit subscriptions |
| `Code Coach: Show Cache Statistics` | View cache stats |
| `Code Coach: Clear Explanation Cache` | Clear cached explanations |
| `Code Coach: Show Knowledge Graph` | Open dependency graph |
| `Code Coach: Focus Knowledge Graph on Current File` | Focus on current file |

## Enterprise Commands

| Command | Description |
|---------|-------------|
| `Code Coach: Enterprise SSO Login` | Authenticate with IdP |
| `Code Coach: Enterprise SSO Logout` | Sign out |
| `Code Coach: Enterprise SSO Status` | Check auth status |
| `Code Coach: Add Custom Model Endpoint` | Configure self-hosted AI |
| `Code Coach: Manage Custom Endpoints` | List/test/remove endpoints |
| `Code Coach: Test Default Endpoint` | Quick test default endpoint |

## Utility Commands

| Command | Description |
|---------|-------------|
| `Code Coach: Feedback (Helpful/Not Helpful)` | Rate explanations |
| `Code Coach: Create Config` | Generate config file |
| `Code Coach: Validate Config` | Check config for errors |
| `Code Coach: Show Resolved Config` | See merged config |

## Context Menu Actions

Right-click in the editor:

| Menu Item | When Available |
|-----------|----------------|
| **Code Coach: Explain Selection** | When text is selected |
| **Code Coach: Explain Why This Works** | When text is selected |
| **Code Coach: Deep Dive** | Always (uses cursor) |
| **Pin for Team** | Always (uses cursor) |

## Setting Keyboard Shortcuts

1. Open Keyboard Shortcuts (`Cmd+K Cmd+S` / `Ctrl+K Ctrl+S`)
2. Search "Code Coach"
3. Click the `+` to add your preferred shortcut

### Suggested Shortcuts

```json
{
  "key": "cmd+shift+e",
  "command": "codeCoach.explainSelection",
  "when": "editorHasSelection"
},
{
  "key": "cmd+shift+d",
  "command": "codeCoach.deepDive",
  "when": "editorTextFocus"
}
```

## Related

- [Quick Start](/getting-started/quick-start/) - Getting started
- [Settings Reference](/config/settings/) - All settings
