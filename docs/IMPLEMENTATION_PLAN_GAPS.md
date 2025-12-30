# Code Coach Implementation Plan — Missing Gaps

This plan covers the remaining gaps vs PRODUCT_PROPOSAL.md. It is additive to the existing IMPLEMENTATION_PLAN.md and is ordered for fast, safe delivery.

## Scope Summary (what is missing)
- Deep Dive: History (recent commits) + AI Summary section.
- "Why Does This Work" mode (assumptions, edge cases, failure modes).
- Privacy modes + domain allowlist + redaction + max context size.
- Prompt injection defenses (sanitize before LLM calls).
- Security smell rules + diff preview refactors.
- Onboarding + guided walkthrough.
- Telemetry events for feedback + feature quality.
- Future-facing: VS Code Web / JetBrains core extraction (plan only).

## Guiding Principles
- Keep offline mode fully functional.
- Never send code without explicit privacy mode allowing it.
- Every AI output must be verifiable + citeable.
- No silent changes; show previews before applying fixes.

---

## Phase G1: Privacy + Prompt Safety Foundation

### Deliverables
- New settings:
  - `codeCoach.privacy.mode` (offline | local | redacted | full)
  - `codeCoach.privacy.allowedDomains` (array)
  - `codeCoach.privacy.redactPatterns` (array of regex-like strings)
  - `codeCoach.privacy.maxContextChars` (number)
- Enforce privacy mode in AI client:
  - offline: block all AI calls
  - local: allow only ollama/lmstudio or local baseUrl
  - redacted: strip strings/comments + redact pattern matches
  - full: current behavior
- Domain allowlist enforcement for cloud providers.
- Prompt injection sanitizer (strip instruction-like lines in code/comments).

### Implementation tasks
- Add new config schema + README docs.
- Create `privacy.ts` to:
  - validate privacy mode
  - enforce allowed domains
  - redact content + clamp context length
- Integrate sanitizer + redaction into aiClient.
- Add telemetry events for blocked requests (privacy).

### Verification
- offline mode blocks AI with a clear message.
- local mode allows only local endpoints.
- redact mode removes secrets + reduces prompt size.
- maxContextChars clamps code + evidence.

---

## Phase G2: Deep Dive Enhancements

### Deliverables
- History section: recent commits from `git log` (author/date/summary).
- AI Summary section (optional, gated by AI + privacy mode).
- Export improvements include history + AI summary.

### Implementation tasks
- Add `history` and `summary` to DeepDiveData.
- Add git log loader with safe fallbacks.
- Add summary generator (AI with static fallback).
- Update TreeView sections + export serializer.

### Verification
- Deep Dive shows History for git repos.
- Summary appears when AI enabled; falls back gracefully when disabled.

---

## Phase G3: "Why Does This Work" Mode

### Deliverables
- New command `codeCoach.explainWhyWorks`.
- Output format:
  - assumptions
  - edge cases handled / not handled
  - what could break
  - citations + confidence
- Static fallback when AI unavailable.

### Implementation tasks
- Add command + keybinding (optional).
- Add prompt template in aiClient (new kind).
- Add static heuristic output for offline mode.

### Verification
- AI mode returns structured explanation.
- Offline mode returns static guidance with citations.

---

## Phase G4: Security Smell Rules + Refactor Preview

### Deliverables
- Security smell rules (SQL injection, command injection, unsafe eval).
- Diff preview for refactor quick fixes (no silent apply).

### Implementation tasks
- Extend smell engine with security rules.
- Update smell quick fixes to show preview using VS Code diff.
- Add "Apply" step from preview.

### Verification
- Security smells trigger on known patterns.
- Preview shows diff and requires explicit apply.

---

## Phase G5: Onboarding + Guided Walkthrough

### Deliverables
- First-run onboarding (privacy mode selection + shortcut hint).
- Optional guided walkthrough (3 steps).

### Implementation tasks
- Track first-run state in globalStorage.
- Add welcome webview or modal sequence.
- Link to settings + commands.

### Verification
- First run shows onboarding once.
- Walkthrough can be re-run from command palette.

---

## Phase G6: Telemetry Events + Feedback

### Deliverables
- Feedback commands (thumbs up/down).
- Telemetry events for feature usage and feedback.

### Implementation tasks
- Add commands + output channel log entries.
- Store minimal event properties (no code).

### Verification
- Events appear in telemetry output/audit log.

---

## Phase G7: Future-facing (Plan Only)

### Deliverables
- VS Code Web feasibility notes.
- JetBrains core extraction plan.

### Implementation tasks
- Document constraints + next steps in a separate doc.

---

## Acceptance Gates (for each phase)
- `npm run compile` passes.
- Manual Extension Host test steps added/updated.
- No regressions to existing commands.
