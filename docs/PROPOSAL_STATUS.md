# PRODUCT_PROPOSAL.md Coverage Status

This document maps every major item in `PRODUCT_PROPOSAL.md` to its implementation status or explicit scope.

Legend:
- Implemented: shipped in the extension.
- Partial: shipped in a reduced form.
- Doc-only: product/marketing plan only (no code expected).

## Executive Summary / Positioning / Taglines
- Status: Doc-only.

## Target Users & Pain Points
- Status: Doc-only.

## Core Feature Set
- Explain Selection: Implemented (`extension/src/extension.ts`, `extension/src/explainSelection.ts`).
- Explain Diagnostic (Enhanced): Implemented (expanded TS patterns + AI assist) (`extension/src/explainDiagnostics.ts`, `extension/src/extension.ts`).
- Trace Error Origin: Implemented (call graph panel + stack trace parsing) (`extension/src/extension.ts`).
- Code Smell Detector: Implemented (JS/TS + basic Python/Java + security heuristics) (`extension/src/smells.ts`).
- Symbol Deep Dive: Implemented (TreeView sections, includes History + Summary) (`extension/src/deepDive.ts`).
- "Why Does This Work" Mode: Implemented (`extension/src/extension.ts`, `extension/src/aiClient.ts`).
- Inline Annotations (Coach Mode): Implemented (`extension/src/coachMode.ts`).
- Test Gap Finder: Implemented (lcov + coverage-final.json; Jest/Vitest coverage supported via Istanbul) (`extension/src/testGaps.ts`).

## Differentiators vs Competition
- Inline explanation: Implemented (hover + panel/peek).
- Error root cause tracing: Implemented (call graph + stack trace).
- Git blame integration: Implemented (`extension/src/deepDive.ts`).
- Test coverage awareness: Implemented (coverage file parsing).
- Code smells: Implemented (rules + quick fixes).
- Works offline: Implemented (static mode).
- Cites exact code locations: Implemented (static outputs include file paths; AI requires citations).
- Monorepo optimized: Implemented (cache + debounce + background prewarm).

## Workflow Examples (3)
- Status: Doc-only (scenarios are supported by implemented features).

## Architecture Sketch / LLM Boundary
- Status: Implemented in spirit; structure described in docs (no code enforcement of module layout).

## Trust & Safety / Enterprise Concerns
- Data privacy modes: Implemented (`extension/src/privacy.ts`, `extension/package.json`).
- Prompt injection defenses: Implemented (sanitization + redaction) (`extension/src/privacy.ts`).
- Deterministic explanations + citations: Implemented (AI verified; static outputs include file:line).
- Audit logging: Implemented (`extension/src/telemetry.ts`).

## Pricing & Packaging
- Status: Doc-only.

## Roadmap
- Status: Doc-only.

## Risks & Mitigations
- Status: Doc-only (some mitigations implemented via privacy + verification + preview fixes).

## Appendices
- Name ideas / domains: Doc-only.
- UI mock text: Doc-only.
- Telemetry events spec: Implemented (activation, hover, invoke, feedback, LLM, smell/testgap).
- Competitive teardown: Doc-only.
- Demo scripts: Doc-only.
- Onboarding flow: Implemented (webview onboarding + command).
- Prompt templates: Implemented (prompt optimizer + diagnostic/why/summary modes).

## Explicitly Out of Scope (tracked in docs)
- VS Code Web support: not implemented, plan in `docs/PLATFORM_PLAN.md`.
- JetBrains plugin: not implemented, plan in `docs/PLATFORM_PLAN.md`.
