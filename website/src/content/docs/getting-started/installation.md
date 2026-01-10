---
title: Installation
description: Install Code Coach in VS Code
---

## Quick Install

1. Open VS Code
2. Press `Cmd+Shift+X` (Mac) or `Ctrl+Shift+X` (Windows/Linux) to open Extensions
3. Search for "Code Coach"
4. Click **Install**

Or install directly from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=code-coach.code-coach).

## Requirements

- **VS Code** 1.85.0 or higher
- **Node.js** 18+ (for advanced features)
- **Git** (for blame/history features)

## Post-Installation

After installation, Code Coach works immediately with static analysis. No API key required for core features.

### Optional: Enable AI Features

For AI-powered explanations:

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Run **Code Coach: Set AI API Key**
3. Choose your provider and enter your API key

Supported providers:
- OpenRouter (recommended - access to many models)
- OpenAI
- Anthropic
- Google Gemini
- Ollama (local, free)
- LM Studio (local, free)

### Privacy Modes

Code Coach respects your privacy. Choose your mode in settings:

| Mode | Behavior |
|------|----------|
| `offline` | No network requests. Static analysis only. |
| `local` | Only localhost (Ollama/LM Studio). |
| `redacted` | Send code with secrets stripped. |
| `full` | Send code as-is to configured AI provider. |

## Verify Installation

1. Open any JavaScript or TypeScript file
2. Select a few lines of code
3. Right-click and choose **Code Coach: Explain Selection**

You should see an explanation in the Output panel.

## Next Steps

- [Quick Start](/getting-started/quick-start/) - Your first explanation
- [AI Providers](/config/ai-providers/) - Configure AI for richer explanations
- [Privacy Modes](/config/privacy/) - Control what data leaves your machine
