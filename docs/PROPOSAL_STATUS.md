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
- Explain Diagnostic (Enhanced): Partial (9 TS codes + generic fallback) (`extension/src/explainDiagnostics.ts`).
- Trace Error Origin: Implemented (call graph panel + stack trace parsing) (`extension/src/extension.ts`).
- Code Smell Detector: Implemented (JS/TS + basic Python/Java + security heuristics) (`extension/src/smells.ts`).
- Symbol Deep Dive: Implemented (TreeView sections, includes History + Summary) (`extension/src/deepDive.ts`).
- "Why Does This Work" Mode: Implemented (`extension/src/extension.ts`, `extension/src/aiClient.ts`).
- Inline Annotations (Coach Mode): Implemented (`extension/src/coachMode.ts`).
- Test Gap Finder: Partial (lcov + coverage-final.json; no direct Jest/Vitest API) (`extension/src/testGaps.ts`).

## Differentiators vs Competition
- Inline explanation: Implemented (hover + panel/peek).
- Error root cause tracing: Implemented (call graph + stack trace).
- Git blame integration: Implemented (`extension/src/deepDive.ts`).
- Test coverage awareness: Implemented (coverage file parsing).
- Code smells: Implemented (rules + quick fixes).
- Works offline: Implemented (static mode).
- Cites exact code locations: Partial (AI requires citations; static outputs include line numbers, not always file paths).
- Monorepo optimized: Partial (caching + debounce; no dedicated indexer yet).

## Workflow Examples (3)
- Status: Doc-only (scenarios are supported by implemented features).

## Architecture Sketch / LLM Boundary
- Status: Implemented in spirit; structure described in docs (no code enforcement of module layout).

## Trust & Safety / Enterprise Concerns
- Data privacy modes: Implemented (`extension/src/privacy.ts`, `extension/package.json`).
- Prompt injection defenses: Partial (basic line sanitization + redaction).
- Deterministic explanations + citations: Partial (AI verified; static outputs include line numbers).
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
- Telemetry events spec: Partial (core events implemented; not full list).
- Competitive teardown: Doc-only.
- Demo scripts: Doc-only.
- Onboarding flow: Implemented (webview onboarding + command).
- Prompt templates: Partial (prompt optimizer + specialized prompt modes; not all appendix templates).

## Explicitly Out of Scope (tracked in docs)
- VS Code Web support: not implemented, plan in `docs/PLATFORM_PLAN.md`.
- JetBrains plugin: not implemented, plan in `docs/PLATFORM_PLAN.md`.
