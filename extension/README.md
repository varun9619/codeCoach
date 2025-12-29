# Code Coach (VS Code Extension)

A minimal static-only MVP that helps you understand code and diagnostics.

## MVP features

- **Explain Selection**: highlight code and get a line-by-line plain-English walkthrough.
- **Explain Diagnostic**: hover on a VS Code diagnostic to see a plain-English explanation + likely causes + fixes.
- **Trace Diagnostic Origin**: trace a diagnostic back to its enclosing symbol and likely callers.
- **Show Code Smells**: run a static analysis pass for common performance/maintainability issues.
- **Deep Dive**: open a sidebar panel with symbol overview, usages, blame, and coverage (if lcov exists).

## AI (optional)

This extension can store API keys securely (VS Code Secret Storage) and supports OpenRouter, OpenAI, Anthropic, and Gemini. OpenRouter is the default provider.

- Command Palette → **Code Coach: Set AI API Key**
- Command Palette → **Code Coach: Clear AI API Key**

Settings:

- `codeCoach.ai.enabled` (default: false)
- `codeCoach.ai.provider` (openrouter | openai | anthropic | gemini)
- `codeCoach.ai.baseUrl` (override provider default)
- `codeCoach.ai.endpointPath` (override provider default; supports `{model}` placeholder)
- `codeCoach.ai.model` (override provider default)
- `codeCoach.ai.authHeader` / `codeCoach.ai.authScheme` (override auth header/scheme)
- `codeCoach.ai.temperature` / `codeCoach.ai.maxTokens`
- `codeCoach.ai.openrouter.referer` / `codeCoach.ai.openrouter.title` (optional headers)
- UI surfaces:
  - `codeCoach.ui.explainSelection`
  - `codeCoach.ui.explainDiagnostic`
  - `codeCoach.ui.traceDiagnosticOrigin`
  - `codeCoach.ui.runtimeException`
  - `codeCoach.ui.codeSmells`
  (values: `output` or `panel`)

## Usage

- Select code → Command Palette → **Code Coach: Explain Selection**
- Hover over an error underline → see the **Code Coach** hover
- Command Palette → **Code Coach: Explain Diagnostic** (uses the diagnostic under your cursor, else the first in the file)
- Command Palette → **Code Coach: Trace Diagnostic Origin**
- Command Palette → **Code Coach: Show Code Smells**
- Command Palette → **Code Coach: Deep Dive** (uses the symbol under your cursor)

## Development

```bash
npm install
npm run compile
```

Run the extension:

- Press `F5` in VS Code (uses the extension host launch config).

## Notes

This MVP is static-only: it does not run your code or capture runtime values.
