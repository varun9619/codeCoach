# Code Coach (VS Code Extension)

A minimal static-only MVP that helps you understand code and diagnostics.

## MVP features

- **Explain Selection**: highlight code and get a line-by-line plain-English walkthrough.
- **Explain Diagnostic**: hover on a VS Code diagnostic to see a plain-English explanation + likely causes + fixes.
- **Trace Diagnostic Origin**: trace a diagnostic back to its enclosing symbol and likely callers.
- **Show Code Smells**: run a static analysis pass for common performance/maintainability issues.
- **Deep Dive**: open a sidebar panel with symbol overview, usages, blame, and coverage (if lcov exists).
- **Smell CodeLens + Quick Fixes**: shows smell counts per function and offers safe quick fixes for certain smells.

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

AI citation behavior:
- AI explanations are asked to include line citations (e.g., `src/file.ts:42` or `L42`).
- For selections, citations are verified to be within the selected line range. Verification notes appear if mismatched.

Prompt optimizer layer:
- User inputs are automatically structured into an "objective / constraints / evidence / output" format before hitting the LLM.
- This improves consistency across providers and makes outputs easier to verify.
- `codeCoach.ai.promptOptimizer` toggles the optimizer layer.
- `codeCoach.ai.promptDebug` shows the optimized prompt in a separate output channel.
- `codeCoach.ai.strictJson` requires JSON-only responses; otherwise AI falls back to static explanations.

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
