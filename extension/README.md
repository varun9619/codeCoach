# Code Coach (VS Code Extension)

A minimal static-only MVP that helps you understand code and diagnostics.

## MVP features

- **Explain Selection**: highlight code and get a line-by-line plain-English walkthrough.
- **Explain Why This Works**: summarize assumptions, edge cases, and what could break (AI when enabled).
- **Explain Diagnostic**: hover on a VS Code diagnostic to see a plain-English explanation + likely causes + fixes.
- **Diagnostic Quick Fixes**: lightbulb offers optional chaining / non-null assertion / implicit-any fixes where safe.
- **Trace Diagnostic Origin**: trace a diagnostic back to its enclosing symbol and likely callers.
- **Trace Stack Trace**: paste a stack trace and see a linked call chain.
- **Show Code Smells**: run a static analysis pass for common performance/maintainability issues (JS/TS + basic Python/Java heuristics).
- **Test Gap Finder**: uses coverage files (`lcov.info` or `coverage-final.json`) to highlight uncovered branches and suggest test inputs.
- **Deep Dive**: open a sidebar panel with symbol overview, usages, blame, history, tests (heuristic), coverage, and AI summary (if enabled).
  - Pin important symbols, filter visible sections, and export a report.
- **Smell CodeLens + Quick Fixes**: shows smell counts per function and offers safe quick fixes for certain smells.
- **Test Gap CodeLens + Quick Fixes**: shows branch coverage per function and offers test stub actions for gaps.
- **Coach Mode (inline hints)**: optional inlay hints that annotate lines with quick explanations.

## AI (optional)

This extension can store API keys securely (VS Code Secret Storage) and supports OpenRouter, OpenAI, Anthropic, Gemini, plus local providers (Ollama, LM Studio). OpenRouter is the default provider.

- Command Palette → **Code Coach: Set AI API Key**
- Command Palette → **Code Coach: Clear AI API Key**

Settings:

- `codeCoach.ai.enabled` (default: false)
- `codeCoach.ai.provider` (openrouter | openai | anthropic | gemini | ollama | lmstudio)
- `codeCoach.ai.baseUrl` (override provider default)
- `codeCoach.ai.endpointPath` (override provider default; supports `{model}` placeholder)
- `codeCoach.ai.model` (override provider default)
- `codeCoach.ai.authHeader` / `codeCoach.ai.authScheme` (override auth header/scheme)
- `codeCoach.ai.temperature` / `codeCoach.ai.maxTokens`
- `codeCoach.ai.openrouter.referer` / `codeCoach.ai.openrouter.title` (optional headers)
- `codeCoach.ai.promptOptimizerMode` (strict | balanced | compact)
- `codeCoach.ai.strictJson` (enforce JSON-only responses; uses provider JSON mode when supported)
- Privacy:
  - `codeCoach.privacy.mode` (offline | local | redacted | full)
  - `codeCoach.privacy.allowedDomains`
  - `codeCoach.privacy.redactPatterns`
  - `codeCoach.privacy.maxContextChars`
- UI surfaces:
  - `codeCoach.ui.explainSelection`
  - `codeCoach.ui.explainWhyWorks`
  - `codeCoach.ui.explainDiagnostic`
  - `codeCoach.ui.traceDiagnosticOrigin`
  - `codeCoach.ui.runtimeException`
  - `codeCoach.ui.codeSmells`
  - `codeCoach.ui.testGaps`
  (values: `output`, `panel`, or `peek`; peek renders a Markdown-styled view)
- Coach Mode:
  - `codeCoach.coachMode.enabled`
  - `codeCoach.coachMode.maxHints`
- Telemetry (local only):
  - `codeCoach.telemetry.enabled`
- Enterprise controls:
  - `codeCoach.enterprise.allowedAiProviders`
  - `codeCoach.enterprise.auditLogPath`
- Test gaps:
  - `codeCoach.testGaps.coveragePaths`
- Deep Dive:
  - `codeCoach.deepDive.sections`
  - `codeCoach.deepDive.aiSummary`
  - `codeCoach.deepDive.historyLimit`
- Performance:
  - `codeCoach.performance.prewarmSymbols`
  - `codeCoach.performance.prewarmFileLimit`
  - `codeCoach.performance.prewarmDelayMs`
  - `codeCoach.performance.prewarmGlob`
  - `codeCoach.performance.prewarmExclude`

AI citation behavior:
- AI explanations are asked to include line citations (e.g., `src/file.ts:42` or `L42`).
- For selections, citations are verified to be within the selected line range. Verification notes appear if mismatched.
- Panel views link file:line citations so you can jump directly to code.

Prompt optimizer layer:
- User inputs are automatically structured into an "objective / constraints / evidence / output" format before hitting the LLM.
- This improves consistency across providers and makes outputs easier to verify.
- `codeCoach.ai.promptOptimizer` toggles the optimizer layer.
- `codeCoach.ai.promptDebug` shows the optimized prompt in a separate output channel.
- `codeCoach.ai.strictJson` requires JSON-only responses; otherwise AI falls back to static explanations.

## Usage

- Select code → Command Palette → **Code Coach: Explain Selection**
- Select code → Command Palette → **Code Coach: Explain Why This Works**
- Hover over an error underline → see the **Code Coach** hover
- Command Palette → **Code Coach: Explain Diagnostic** (uses the diagnostic under your cursor, else the first in the file)
- Command Palette → **Code Coach: Trace Diagnostic Origin**
- Command Palette → **Code Coach: Trace Stack Trace**
- Command Palette → **Code Coach: Show Code Smells**
- Command Palette → **Code Coach: Show Test Gaps**
- Command Palette → **Code Coach: Deep Dive** (uses the symbol under your cursor)
- Command Palette → **Code Coach: Run Onboarding** (replay the guided walkthrough)
- Command Palette → **Code Coach: Pin Deep Dive** / **Unpin Deep Dive**
- Command Palette → **Code Coach: Deep Dive Sections**
- Command Palette → **Code Coach: Export Deep Dive**
- Command Palette → **Code Coach: Feedback (Helpful/Not Helpful)**
- Toggle Coach Mode → Settings: `codeCoach.coachMode.enabled`

## Development

```bash
npm install
npm run compile
```

Run the extension:

- Press `F5` in VS Code (uses the extension host launch config).

## Notes

This MVP is primarily static-only; optional runtime capture is available when debugging is enabled. AI requests respect `codeCoach.privacy.mode` (offline blocks AI).
