# Code Coach Implementation Plan

This plan turns the PRODUCT_PROPOSAL.md roadmap into an execution plan with concrete phases, deliverables, and verification gates. Each phase must be tested and confirmed before moving on.

## Goals
- JS/TS first; Python/Java later.
- Explainability + debugging + navigation with citations.
- Fast on large repos (incremental + cached).
- Works offline; LLM enhances but does not replace static analysis.

## Guiding Constraints
- Every explanation links to file:line (or symbol) locations.
- No silent auto-apply for risky changes; always show preview.
- Respect VS Code visual language (diagnostics, hover, CodeLens, inlay hints).
- Phase gating: do not start the next phase until the prior phase passes tests.

## Architecture Layout (target)
- extension/src/
  - commands/ (command handlers)
  - analysis/ (AST, symbol graph, call graph)
  - diagnostics/ (TS error patterns, smell diagnostics)
  - ui/ (hover, CodeLens, TreeView, Webview)
  - llm/ (provider routing, prompts, verification)
  - runtime/ (debug adapter tracking)
  - config/ (settings + secrets)

## Phase 0: Baseline (done)
Deliverables:
- Explain Selection (static + basic AST parsing).
- Explain Diagnostic (known TS patterns).
- Hover provider for diagnostics.
Verification:
- npm run compile passes.
- Run in VS Code Extension Host and use both commands.

## Phase 1: Wired Commands First (done, pending your validation)
Scope:
- Trace Diagnostic Origin (text report).
- Code Smells (static rules + diagnostics).
Deliverables:
- Command: codeCoach.traceDiagnosticOrigin
- Command: codeCoach.showSmells
- Smell diagnostics collection + output channel report
- Minimal smell rules: nested loops, many params, explicit any, empty catch
Verification:
- Run in Extension Host:
  - Trigger a diagnostic and run Trace Diagnostic Origin.
  - Open a file with a nested loop and run Show Code Smells.

## Phase 2: Symbol Deep Dive (next)
Scope:
- Right-click or command to open sidebar with usage + blame + tests.
Deliverables:
- Command: codeCoach.deepDive
- TreeView: Deep Dive with sections (Overview, Usages, Blame, Tests)
- Usages via executeReferenceProvider
- Blame via git CLI (git blame -L start,end)
- Tests from coverage file if present (lcov default)
Implementation tasks:
- Add TreeView provider and view contribution.
- Add file/symbol selection logic.
- Add git blame adapter with safe fallbacks if git not available.
- Add coverage loader (lcov parse if file exists).
Verification:
- Open a symbol and run Deep Dive.
- Validate usages list and blame output.
- If coverage file exists, validate Tests section.

## Phase 3: Trace UX Upgrade (call graph panel)
Scope:
- Webview call graph visualization + clickable nodes.
Deliverables:
- Webview panel for call graph (Trace Diagnostic Origin UI upgrade).
- Minimal call graph builder (static):
  - Build call chain from selected symbol.
  - Use references + local AST walk for direct calls.
Implementation tasks:
- Add simple graph model (nodes + edges + file locations).
- Webview with graph layout (basic list or small DAG).
- Clickable nodes open file:line.
Verification:
- Trigger Trace Diagnostic Origin and open panel.
- Click nodes, confirm file opens.

## Phase 4: LLM Enhancements (BYOK all providers)
Scope:
- Integrate LLM across selection/diagnostic/runtime with verified outputs.
Deliverables:
- Provider routing: OpenRouter/OpenAI/Anthropic/Gemini
- Per-provider SecretStorage keys
- Prompt templates + response validation
- Verification notes when AI claims do not match evidence
Implementation tasks:
- Expand aiClient adapters, add prompt templates per feature.
- Add citation format requirement (file:line) when AI is used.
- Provide graceful fallback to static explanations.
Verification:
- Set provider + key; run Explain Selection and see AI output.
- Unset key and verify clean fallback with a clear message.

## Phase 5: Smell Engine Expansion
Scope:
- Expand rules + add CodeLens summary and quick fixes.
Deliverables:
- 8-10 smell rules (performance, security, maintainability).
- CodeLens: "Smells: N" and click to open report.
- Quick fixes with diff preview (no auto-apply).
Verification:
- Smell badges appear at function level.
- Quick fix shows diff and can be dismissed safely.

## Phase 6: Test Gap Finder
Scope:
- Use branch coverage to show gaps and suggest tests.
Deliverables:
- lcov parser (default), opt-in jest/vitest paths.
- CodeLens: "Tests: X passing, Y gaps"
- Output panel for gap details
Verification:
- With lcov present, gaps are shown and links open relevant lines.
- Without lcov, feature degrades gracefully.

## Phase 7: Inline Annotations (Coach Mode)
Scope:
- Inlay hints for key lines, toggled via setting.
Deliverables:
- InlayHint provider with throttling + cache
- Toggle setting: codeCoach.coachMode.enabled
Verification:
- Hints appear/disappear with setting toggle.
- Performance remains acceptable on large files.

## Phase 8: Performance + Reliability
Scope:
- Incremental indexing + caching + telemetry.
Deliverables:
- Cache for symbol graph and references per file.
- Debounce on document changes.
- Telemetry events (privacy-safe).
Verification:
- Large repo test: hover response < 150ms after warm cache.
- No UI freezes during indexing.

## V1 (3 months) Deliverables
- Stack trace correlation for tracing.
- Expanded smell rules + false-positive tuning.
- Test gap support for more runners/coverage formats.
- Python support (basic).
- Team tier admin controls.

## V2 (6 months) Deliverables
- Local LLM support (Ollama/LM Studio).
- Inline annotations (Coach Mode) at scale.
- Webview call graph improvements.
- Java/Go/Rust support.
- Enterprise controls (SSO/audit/on-prem).

## Acceptance Gates Per Phase
- npm run compile passes.
- Manual Extension Host test script passes.
- No regression in existing commands.
- Output channel shows correct mode + error handling.

## Manual Test Script (baseline)
1) Explain Selection on JS/TS selection.
2) Explain Diagnostic on a known TS error.
3) Trace Diagnostic Origin (text report, then webview in Phase 3).
4) Show Code Smells (at least one rule hit).
5) Set/clear provider API key and verify AI toggle.

## Risk Controls
- Keep AI outputs verified against evidence; show verification notes.
- Always provide static fallback.
- Avoid heavy analysis on every keystroke; use explicit commands.
