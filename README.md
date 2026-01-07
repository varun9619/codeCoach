# Code Coach

Code Coach is a VS Code extension that explains code you did not write. It focuses on fast, cited understanding, debugging guidance, and navigation—especially for AI‑assisted codebases and new joiners.

## What you get

- **Explain Selection** with line‑by‑line walkthroughs and citations.
- **Explain Diagnostic** with plain‑English causes + fixes.
- **Trace Error Origin** with a static call chain and stack‑trace parsing.
- **Deep Dive** sidebar: usages, blame, history, tests, coverage, and AI summary.
- **Code Smells** with quick fixes and preview diffs.
- **Test Gap Finder** using branch coverage (`lcov.info` or `coverage-final.json`).
- **Coach Mode** inline hints (opt‑in).
- **BYOK AI** with OpenRouter/OpenAI/Anthropic/Gemini + local (Ollama/LM Studio).
- **Privacy modes** to keep code on device or redact before sending.

## Repository layout

```
codeCoach/
├─ extension/              # VS Code extension source
├─ docs/                   # Product + implementation docs
├─ PRODUCT_PROPOSAL.md     # Vision and roadmap
```

## Quickstart (dev)

```bash
cd extension
npm install
npm run compile
```

Then press **F5** in VS Code to launch the Extension Host.

## Usage (core commands)

- **Code Coach: Explain Selection**
- **Code Coach: Explain Why This Works**
- **Code Coach: Explain Diagnostic**
- **Code Coach: Trace Diagnostic Origin**
- **Code Coach: Trace Stack Trace**
- **Code Coach: Show Code Smells**
- **Code Coach: Show Test Gaps**
- **Code Coach: Deep Dive**
- **Code Coach: Run Onboarding**

## Settings (high‑signal)

AI and privacy:
- `codeCoach.ai.enabled`
- `codeCoach.ai.provider` (openrouter | openai | anthropic | gemini | ollama | lmstudio)
- `codeCoach.privacy.mode` (offline | local | redacted | full)
- `codeCoach.privacy.allowedDomains`
- `codeCoach.privacy.redactPatterns`
- `codeCoach.privacy.maxContextChars`

UI surfaces:
- `codeCoach.ui.explainSelection`
- `codeCoach.ui.explainWhyWorks`
- `codeCoach.ui.explainDiagnostic`
- `codeCoach.ui.traceDiagnosticOrigin`
- `codeCoach.ui.runtimeException`
- `codeCoach.ui.codeSmells`
- `codeCoach.ui.testGaps`

Deep Dive:
- `codeCoach.deepDive.sections`
- `codeCoach.deepDive.aiSummary`
- `codeCoach.deepDive.historyLimit`

Performance (monorepos):
- `codeCoach.performance.prewarmSymbols`
- `codeCoach.performance.prewarmFileLimit`
- `codeCoach.performance.prewarmDelayMs`
- `codeCoach.performance.prewarmGlob`
- `codeCoach.performance.prewarmExclude`

See `extension/README.md` for the full list.

## Privacy model

Code Coach supports multiple privacy modes:
- **offline**: no AI calls (static only)
- **local**: only localhost LLMs
- **redacted**: strips comments/strings + redact patterns before sending
- **full**: sends full context to AI

All AI outputs are validated against citations where possible; verification notes appear when outputs are not fully grounded.

## Documentation map

- Vision and roadmap: `PRODUCT_PROPOSAL.md`
- Execution plan: `docs/IMPLEMENTATION_PLAN.md`
- Remaining gaps plan: `docs/IMPLEMENTATION_PLAN_GAPS.md`
- Coverage status: `docs/PROPOSAL_STATUS.md`
- Platform expansion notes: `docs/PLATFORM_PLAN.md`
- Monetization: `docs/MONETIZATION.md`
- Competitive analysis: `docs/COMPETITIVE_MOAT.md`

## Troubleshooting

- **AI not used**: check `codeCoach.ai.enabled` and `codeCoach.privacy.mode`.
- **Deep Dive missing blame/history**: repo must be a git repo with history.
- **Test gaps not showing**: ensure `lcov.info` or `coverage-final.json` exists.
- **Slow on big repos**: enable `codeCoach.performance.prewarmSymbols`.

## Contributing

PRs are welcome. Start with the Extension Host (`F5`) and run:

```bash
cd extension
npm run compile
```
