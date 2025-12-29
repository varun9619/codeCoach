# Code Coach: Product Proposal

## Executive Summary

**One-line positioning:**
Code Coach is the "explainability layer" for AI-generated and inherited codebases—helping developers understand *what* code does, *why* it fails, and *where* to look, without leaving VS Code.

**Tagline options:**
- "Understand any code. Fix any bug. Ship with confidence."
- "Your codebase, explained."
- "The missing manual for code you didn't write."

---

## Target Users & Pain Points

### Primary Personas

| Persona | Description | % of Target |
|---------|-------------|-------------|
| **New Joiner** | 0-6 months at company, onboarding to unfamiliar codebase | 35% |
| **Agent-Assisted Dev** | Uses Copilot/Cursor heavily, often doesn't fully understand generated code | 30% |
| **Legacy Maintainer** | Inherited old code, original authors gone, sparse docs | 25% |
| **Code Reviewer** | Reviews PRs from junior devs or AI agents, needs fast comprehension | 10% |

### Top 3 Pain Points

1. **"I don't know what this does"**
   AI-generated or inherited code lacks context. Reading it takes 10-30 min. Asking teammates interrupts them. ChatGPT lacks repo context.

2. **"I hit an error but don't know where to look"**
   Stack traces point to symptoms, not root causes. Error messages are cryptic. Debugging is archaeology.

3. **"This code works but feels wrong"**
   Tests pass, but something's off—performance, security, maintainability. No signal until production breaks.

---

## Core Feature Set (MVP: Full Vision)

The MVP ships the full feature vision below, with deep functionality and LLM-enhanced outputs where applicable. The MVP timeline is extended to support full scope.

### Feature 1: Explain Selection

| Attribute | Detail |
|-----------|--------|
| **User Story** | As a new joiner, I want to highlight unfamiliar code and get a plain-English explanation so I can understand it without asking teammates. |
| **UX Interaction** | Select code → Right-click → "Code Coach: Explain" OR `Cmd+Shift+E` |
| **Output** | Markdown panel: (1) One-sentence summary, (2) Line-by-line walkthrough, (3) Key concepts used, (4) Related files/symbols |
| **Success Metric** | Time-to-understanding < 60s for 80% of selections; 70% find explanation "helpful" (thumbs up) |

### Feature 2: Explain Diagnostic (Enhanced)

| Attribute | Detail |
|-----------|--------|
| **User Story** | As a developer hitting a TypeScript error, I want to see why it's happening and how to fix it without Googling the error code. |
| **UX Interaction** | Hover over red squiggle → See enhanced tooltip with cause/fix/location |
| **Output** | (1) Plain-English cause, (2) Likely fix with code suggestion, (3) Link to exact symbol/line causing the issue, (4) "Apply Fix" quick action |
| **Success Metric** | 50% of diagnostics resolved without leaving hover; avg 2 clicks to fix |

### Feature 3: Trace Error Origin

| Attribute | Detail |
|-----------|--------|
| **User Story** | As a debugger, when I see an error, I want to trace back to the root cause across files so I don't fix symptoms. |
| **UX Interaction** | Click "Trace Origin" in diagnostic hover → Opens call graph panel showing error propagation path |
| **Output** | Visual call chain: `fileA:fn1() → fileB:fn2() → fileC:fn3() [ROOT CAUSE HERE]` with clickable nodes |
| **Success Metric** | 60% of traced errors lead to correct root cause file on first try |

### Feature 4: Code Smell Detector

| Attribute | Detail |
|-----------|--------|
| **User Story** | As a code reviewer, I want to see potential issues in a function (perf, security, maintainability) even if tests pass. |
| **UX Interaction** | CodeLens above functions: "⚠️ 2 potential issues" → Click to expand inline annotations |
| **Output** | Inline annotations: smell type, severity, explanation, suggested refactor, "Apply Refactor" action |
| **Success Metric** | 40% of flagged smells acknowledged as valid; false positive rate < 30% |

### Feature 5: Symbol Deep Dive

| Attribute | Detail |
|-----------|--------|
| **User Story** | As a maintainer, I want to understand everything about a symbol—who uses it, who wrote it, how it changed, what tests cover it. |
| **UX Interaction** | Right-click symbol → "Code Coach: Deep Dive" → Opens sidebar panel |
| **Output** | Panel with tabs: (1) Usages (call sites), (2) History (git blame + commit messages), (3) Tests (coverage + test names), (4) AI Summary |
| **Success Metric** | Panel opened 3x+ per session by power users; 50% retention after week 1 |

### Feature 6: "Why Does This Work?" Mode

| Attribute | Detail |
|-----------|--------|
| **User Story** | As a dev reviewing AI-generated code, I want to understand *why* the code works, not just *what* it does, so I can trust it. |
| **UX Interaction** | Select code → "Explain Why This Works" (separate from basic explain) |
| **Output** | (1) Assumptions the code makes, (2) Edge cases handled (and not handled), (3) Dependencies relied upon, (4) "What could break this" section |
| **Success Metric** | Used on 30% of AI-generated code; 60% report increased confidence in code |

### Feature 7: Inline Annotations (Non-Blocking)

| Attribute | Detail |
|-----------|--------|
| **User Story** | As a reader, I want to see lightweight explanations inline without opening panels, like a smart comment layer. |
| **UX Interaction** | Toggle "Coach Mode" → See ghost text annotations after complex lines |
| **Output** | Subtle inline text: `// ← transforms user input to API format` or `// ← O(n²) - consider optimizing for large arrays` |
| **Success Metric** | 25% of users enable Coach Mode daily; avg session length increases 15% |

### Feature 8: Test Gap Finder

| Attribute | Detail |
|-----------|--------|
| **User Story** | As a maintainer, I want to know which branches/edge cases of a function lack test coverage so I can add them. |
| **UX Interaction** | CodeLens: "Tests: 3 passing, 2 branches uncovered" → Click to see branch details |
| **Output** | List of uncovered branches with (1) condition description, (2) sample input that would hit it, (3) "Generate Test" action |
| **Success Metric** | 20% of suggested tests are generated and kept; coverage increases 5% avg |

---

## Differentiators vs Competition

| Capability | Copilot | Cursor | Codeium | ChatGPT | **Code Coach** |
|------------|---------|--------|---------|---------|----------------|
| Inline explanation | ❌ | Chat only | ❌ | ❌ | ✅ Hover + inline |
| Error root cause tracing | ❌ | ❌ | ❌ | ❌ | ✅ Call graph |
| Git blame integration | ❌ | ❌ | ❌ | ❌ | ✅ Per-symbol history |
| Test coverage awareness | ❌ | ❌ | ❌ | ❌ | ✅ Branch-level |
| Code smell detection | ❌ | ❌ | ✅ Basic | ❌ | ✅ With refactor actions |
| Works offline | ❌ | ❌ | ❌ | ❌ | ✅ Static analysis mode |
| Cites exact code locations | ❌ | ❌ | ❌ | ❌ | ✅ Always |
| Monorepo optimized | ⚠️ | ⚠️ | ⚠️ | ❌ | ✅ Incremental indexing |

**Key differentiator:** Code Coach is the only tool that provides **traceable, citable explanations**. Every insight links back to file:line:symbol. No hallucinated answers without provenance. MVP delivers the full feature set: explain, trace, smells, deep dive, test gaps, and inline annotations.

---

## Workflow Examples

### Workflow 1: "I Don't Understand This Function"

**Scenario:** New joiner sees a 40-line utility function in a PR review.

```
Step 1: Select the function body
Step 2: Press Cmd+Shift+E (or right-click → "Explain Selection")
Step 3: Coach Panel opens on the right:

┌─────────────────────────────────────────────────────┐
│ 📘 Code Coach: Explain Selection                    │
├─────────────────────────────────────────────────────┤
│ ## Summary                                          │
│ Transforms raw API response into normalized user    │
│ objects, handling pagination and deduplication.     │
│                                                     │
│ ## What I See                                       │
│ • Data transformation pipeline                      │
│ • Pagination handling (cursor-based)                │
│ • Deduplication via Map                             │
│                                                     │
│ ## Line-by-Line                                     │
│ L12: Extracts `data` array from response            │
│ L14: Creates Map for O(1) dedup lookup              │
│ L16-22: Iterates and normalizes each user object    │
│ L24: Handles next page cursor if present            │
│                                                     │
│ ## Related                                          │
│ • Used by: src/api/users.ts:fetchAllUsers (L45)     │
│ • Calls: src/utils/normalize.ts:normalizeUser       │
│ • Tests: src/utils/__tests__/transform.test.ts      │
│                                                     │
│ [👍 Helpful] [👎 Not helpful] [🔄 Regenerate]       │
└─────────────────────────────────────────────────────┘

Step 4: Click on "src/api/users.ts:fetchAllUsers" to see usage context
Step 5: Close panel, continue review with understanding
```

**Time saved:** ~15 minutes of reading + Slack interruption avoided.

---

### Workflow 2: "I Hit a Runtime Error"

**Scenario:** Dev sees `TypeError: Cannot read property 'id' of undefined` in console.

```
Step 1: Click on error in Problems panel (or paste stack trace)
Step 2: Code Coach intercepts and shows enhanced diagnostic:

┌─────────────────────────────────────────────────────┐
│ 🔴 TypeError: Cannot read property 'id' of undefined│
├─────────────────────────────────────────────────────┤
│ ## What Happened                                    │
│ You're accessing `.id` on a variable that is        │
│ `undefined` at runtime.                             │
│                                                     │
│ ## Where It Originates                              │
│ 📍 src/components/UserCard.tsx:23                   │
│    `const userId = user.id`                         │
│                                                     │
│ ## Why `user` Is Undefined                          │
│ Traced back through call chain:                     │
│                                                     │
│   UserCard.tsx:23 ← user prop                       │
│        ↑                                            │
│   UserList.tsx:45 ← users[index]                    │
│        ↑                                            │
│   useFetchUsers.ts:12 ← API response.data           │
│        ↑ [ROOT CAUSE]                               │
│   API returned empty array when user not found      │
│                                                     │
│ ## How To Fix                                       │
│ Option A: Add null check before access              │
│   `const userId = user?.id`                         │
│                                                     │
│ Option B: Handle empty state in UserList            │
│   `if (!users.length) return <Empty />`             │
│                                                     │
│ [Apply Fix A] [Apply Fix B] [Trace Full Chain]      │
└─────────────────────────────────────────────────────┘

Step 3: Click "Apply Fix A" → Code Coach inserts optional chaining
Step 4: Click "Trace Full Chain" → See full call graph visualization
```

**Time saved:** ~30 minutes of console.log debugging.

---

### Workflow 3: "This Code Smells Off"

**Scenario:** Reviewing a PR where a function "works" but feels wrong.

```
Step 1: Notice CodeLens above function: "⚠️ 3 potential issues"
Step 2: Click to expand:

┌─────────────────────────────────────────────────────┐
│ ⚠️ Code Smells Detected                             │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 🐢 Performance (Medium)                   Line 34   │
│ Nested loop creates O(n²) complexity.               │
│ With 10k items, this takes ~2s.                     │
│ → Consider: Use Map for O(n) lookup                 │
│ [Show Refactor] [Dismiss]                           │
│                                                     │
│ 🔓 Security (High)                        Line 41   │
│ User input passed directly to SQL query.            │
│ Potential SQL injection vector.                     │
│ → Consider: Use parameterized query                 │
│ [Show Refactor] [Dismiss]                           │
│                                                     │
│ 📦 Maintainability (Low)                  Line 28   │
│ Function has 6 parameters.                          │
│ Consider using an options object.                   │
│ → Consider: Destructure from config object          │
│ [Show Refactor] [Dismiss]                           │
│                                                     │
└─────────────────────────────────────────────────────┘

Step 3: Click "Show Refactor" on Security issue
Step 4: See diff preview with parameterized query
Step 5: Click "Apply" → Code updated, smell resolved
Step 6: Add comment in PR: "Fixed SQL injection risk flagged by Code Coach"
```

**Value:** Caught security bug before production; documented in PR.

---

## Visual Language (IntelliSense-Parity)

Code Coach uses the same visual language developers already trust in VS Code, so insights feel like native IntelliSense rather than a separate AI layer.

- **Severity colors:** red for errors, yellow for warnings, blue for info; consistent with Problems panel and squiggles.
- **Hover tooltips:** expanded diagnostic hovers with "Cause / Fix / Source" sections and clickable citations.
- **Inline hints:** Coach Mode uses inlay-hint styling, lightweight ghost text, and theme tokens for readability.
- **Quick fixes:** lightbulb actions with diff previews; no auto-apply for risky changes.
- **Badges and icons:** CodeLens badges (e.g., "Tests: 3 passing, 2 gaps") and smell icons for scanability.
- **Accessibility:** respects user themes, high-contrast mode, and reduce-motion settings.

---

## Architecture Sketch

### High-Level Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         VS Code Extension                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Hover        │  │ CodeLens     │  │ Commands     │           │
│  │ Provider     │  │ Provider     │  │ (Explain,    │           │
│  │              │  │              │  │  Trace, etc) │           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
│         │                 │                 │                    │
│         └────────────┬────┴─────────────────┘                    │
│                      ▼                                           │
│         ┌────────────────────────┐                               │
│         │   Analysis Orchestrator │                               │
│         └────────────┬───────────┘                               │
│                      │                                           │
│    ┌─────────────────┼─────────────────┐                         │
│    ▼                 ▼                 ▼                         │
│ ┌──────────┐  ┌──────────────┐  ┌──────────────┐                │
│ │ Static   │  │ Context      │  │ LLM          │                │
│ │ Analysis │  │ Gatherer     │  │ Interface    │                │
│ │ Engine   │  │              │  │ (configurable)│               │
│ └────┬─────┘  └──────┬───────┘  └──────┬───────┘                │
│      │               │                 │                         │
│      ▼               ▼                 ▼                         │
│ ┌──────────┐  ┌──────────────┐  ┌──────────────┐                │
│ │ TS       │  │ Git Blame    │  │ Anthropic /  │                │
│ │ Compiler │  │ Test Runner  │  │ OpenAI /     │                │
│ │ API      │  │ Symbol Index │  │ Local Model  │                │
│ └──────────┘  └──────────────┘  └──────────────┘                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### VS Code APIs Used

| API | Purpose |
|-----|---------|
| `vscode.languages.registerHoverProvider` | Enhanced diagnostic hovers |
| `vscode.languages.registerCodeLensProvider` | Smell indicators, test coverage |
| `vscode.languages.registerCodeActionsProvider` | Quick fixes, refactors |
| `vscode.commands.registerCommand` | Explain, Trace, Deep Dive commands |
| `vscode.window.createWebviewPanel` | Coach Panel, Call Graph visualization |
| `vscode.window.createTreeView` | Symbol Deep Dive sidebar |
| `vscode.languages.getDiagnostics` | Access TS/ESLint errors |
| `vscode.workspace.fs` | Read files for context gathering |
| `vscode.extensions.getExtension` | Integrate with GitLens, Test Explorer |

### Analysis Pipeline

```
Input (code selection / diagnostic / symbol)
           │
           ▼
┌─────────────────────────────────┐
│ 1. Parse & Extract             │  ← TypeScript Compiler API
│    - AST nodes                 │  ← ts.createSourceFile
│    - Symbol table              │  ← ts.TypeChecker
│    - Diagnostic codes          │
└─────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ 2. Build Context Graph         │  ← Local, no LLM
│    - Call sites (who uses this)│  ← ts.findAllReferences
│    - Dependencies (what this   │  ← Import/require analysis
│      calls)                    │
│    - Git history (who wrote it)│  ← git blame, git log
│    - Test coverage (what tests │  ← lcov.info / Jest API
│      hit this)                 │
└─────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ 3. Pattern Matching            │  ← Local, deterministic
│    - Known diagnostic codes    │  ← Hardcoded rules (2304, 2339...)
│    - Known code smells         │  ← AST pattern rules
│    - Known error patterns      │  ← Regex + AST
└─────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ 4. LLM Enhancement (Optional)  │  ← Only if enabled
│    - Natural language summary  │
│    - Edge case analysis        │
│    - Refactor suggestions      │
│    - "Why does this work"      │
└─────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ 5. Output Formatting           │  ← Local
│    - Markdown generation       │
│    - Code citations (file:line)│
│    - Action buttons            │
└─────────────────────────────────┘
           │
           ▼
        UI Render
```

### LLM Boundary: What's Local vs What Needs LLM

| Capability | Local/Static | LLM Required |
|------------|--------------|--------------|
| Line-by-line walkthrough (basic) | ✅ | |
| Diagnostic cause/fix (known codes) | ✅ | |
| Call graph construction | ✅ | |
| Git blame integration | ✅ | |
| Test coverage mapping | ✅ | |
| Code smell detection (patterns) | ✅ | |
| Natural language summaries | | ✅ |
| "Why does this work" analysis | | ✅ |
| Complex refactor suggestions | | ✅ |
| Edge case enumeration | | ✅ |
| Cross-file intent inference | | ✅ |

**Design principle:** The MVP ships LLM-enhanced outputs for all applicable features, with deterministic offline fallbacks (reduced depth + confidence labels). LLM is additive, not foundational.

---

## Trust & Safety / Enterprise Concerns

### Data Privacy Modes

| Mode | Description | Code Leaves Device? | LLM Used? |
|------|-------------|---------------------|-----------|
| **Offline** | Static analysis only, no network | ❌ No | ❌ No |
| **Local LLM** | Ollama / LM Studio integration | ❌ No | ✅ Local |
| **Cloud (Redacted)** | Send AST structure, not raw code | ⚠️ Metadata only | ✅ Cloud |
| **Cloud (Full)** | Full code context to LLM | ✅ Yes | ✅ Cloud |

### Enterprise Settings

```json
{
  "codeCoach.privacyMode": "offline | local | redacted | full",
  "codeCoach.allowedDomains": ["api.anthropic.com"],
  "codeCoach.redactPatterns": ["API_KEY", "SECRET", "PASSWORD"],
  "codeCoach.telemetryEnabled": false,
  "codeCoach.maxContextSize": 4000
}
```

### Prompt Injection Defenses

1. **Sanitization:** Strip comments and strings that match injection patterns before LLM calls
2. **Structured output:** Use JSON mode / function calling, not free-form text parsing
3. **Citation requirement:** LLM responses must include file:line references; uncitable claims are flagged
4. **Human review:** Refactor actions show diff preview; never auto-apply

### Deterministic Explanations + Citations

**Every explanation includes:**
```
📍 Source: src/utils/transform.ts:L24-L30
📍 Related: src/api/users.ts:L45 (caller)
📍 Confidence: High (pattern match) | Medium (LLM inference)
```

Users can click any citation to jump to source. Explanations without citations are marked as "inference" and can be disabled.

---

## Pricing & Packaging

### Tiers

| Tier | Price | Features | Target |
|------|-------|----------|--------|
| **Free** | $0 | Offline mode only: basic explain, diagnostic hover, call graph | Individual devs, OSS |
| **Pro** | $15/mo | + LLM summaries, smell detection, deep dive, test gap finder | Professional devs |
| **Team** | $12/user/mo (min 5) | + Admin controls, SSO, audit logs, shared smell rules | Engineering teams |
| **Enterprise** | Custom | + On-prem LLM, custom models, SLA, dedicated support | Large orgs |

### Who Pays & Why

- **Individual Pro:** Devs who onboard to new jobs frequently, or work with AI agents daily. Value: time saved > $15/mo easily.
- **Team:** Engineering managers who want to reduce onboarding time and PR review cycles. Value: 1 week faster onboarding = $2k+ saved.
- **Enterprise:** Security-conscious orgs needing air-gapped deployment. Value: compliance + productivity.

### Revenue Model

- Primary: Subscription (Pro + Team)
- Secondary: Enterprise contracts
- Tertiary: Marketplace revenue share (VS Code takes 0% currently)

---

## Roadmap

### MVP (8-12 weeks)

| Week | Deliverable |
|------|-------------|
| 1-2 | Explain Selection + Explain Diagnostic (AST + top TS/JS error patterns) |
| 3-4 | Trace Error Origin + Symbol Deep Dive (call graph, usages, blame, tests) |
| 5-6 | LLM integration + "Why Does This Work" + AI summaries |
| 7-8 | Code Smell Detector + Test Gap Finder (rules + coverage hooks) |
| 9-10 | Inline Annotations (Coach Mode) + UX polish |
| 11-12 | Performance, telemetry, error handling, beta release |

**MVP success criteria:** 1,000 installs, 100 weekly active users, 4.0+ star rating.

### V1 (3 months)

- Stack trace correlation for root-cause tracing (runtime + static)
- Expanded smell rules + false-positive tuning
- Test gap support for more runners/coverage formats
- Python support (basic)
- Team tier launch + admin policy controls

**V1 success criteria:** 10,000 installs, 1,000 WAU, 100 paying users.

### V2 (6 months)

- Local LLM support (Ollama, LM Studio)
- Inline annotations ("Coach Mode")
- Webview-based interactive call graph
- Java/Go/Rust support
- Enterprise features (SSO, audit, on-prem)
- VS Code for Web support
- IDE-agnostic core (JetBrains plugin prep)

**V2 success criteria:** 50,000 installs, 5,000 WAU, $50k ARR.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **LLM hallucinations** | High | High | Require citations; show confidence level; allow disable |
| **Wrong fix suggestions** | Medium | High | Always show diff preview; never auto-apply; track revert rate |
| **Slow on monorepos** | High | Medium | Incremental indexing; lazy loading; workspace trust boundaries |
| **Limited language support** | Medium | Medium | Prioritize JS/TS/Python; use tree-sitter for others |
| **Privacy concerns** | Medium | High | Default to offline; clear data flow docs; SOC2 roadmap |
| **Copilot feature overlap** | High | Medium | Focus on explainability + tracing (not generation); differentiate clearly |
| **Extension size/perf** | Medium | Medium | Lazy load heavy deps; use web workers; profile startup |
| **User trust in AI explanations** | Medium | Medium | Always cite sources; show "how we determined this"; allow feedback |

---

## Appendix A: Name Ideas

### Product Names (20)

1. **Code Coach** (current)
2. **Codebase** ("your codebase, explained")
3. **Sourcery** (clever, but taken)
4. **Codex** (taken by OpenAI)
5. **Illuminate**
6. **Raycast for Code** (concept)
7. **CodeLens Pro** (confusing with VS Code feature)
8. **Unpack**
9. **Grok** (taken)
10. **Decode**
11. **CodeWhisperer** (taken by AWS)
12. **Spelunker**
13. **Cartographer**
14. **CodeMap**
15. **Rosetta**
16. **Transparen-C** (clever but confusing)
17. **Explainer**
18. **CodeGuide**
19. **Sherpa**
20. **Pathfinder**

### Domain-Style Names

- `explain.dev`
- `codeexplain.io`
- `getcoach.dev`
- `codebase.ai`
- `unpack.dev`
- `decode.sh`
- `rosetta.dev`
- `codemap.io`

---

## Appendix B: UI Mock Text

### Hover Tooltip (Enhanced Diagnostic)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 TS2339: Property 'name' does not exist on type '{}'.

💡 What's happening:
You're trying to access `.name` on an object that TypeScript
thinks is empty (`{}`). The actual object probably has `name`,
but TS can't see it.

🔍 Where this comes from:
→ src/types.ts:12 defines `User` without `name` property
→ src/api.ts:45 returns `{}` as fallback (should return `User`)

🔧 How to fix:
• Add `name` to the User interface in src/types.ts
• Or narrow the type: `if ('name' in user) { ... }`

[Apply Fix] [See Full Trace] [Dismiss]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Sidebar Panel (Symbol Deep Dive)

```
┌─────────────────────────────────────────────┐
│ 🔍 Deep Dive: normalizeUser()               │
├─────────────────────────────────────────────┤
│ 📍 src/utils/normalize.ts:23-45             │
│                                             │
│ ┌─ Usages (12) ────────────────────────────┐│
│ │ • src/api/users.ts:67      fetchUsers()  ││
│ │ • src/api/users.ts:89      createUser()  ││
│ │ • src/hooks/useUser.ts:23  transform     ││
│ │ • ... (9 more)                           ││
│ └──────────────────────────────────────────┘│
│                                             │
│ ┌─ History ────────────────────────────────┐│
│ │ 3 days ago   @jane   "Fix null handling" ││
│ │ 2 weeks ago  @bob    "Add email field"   ││
│ │ 1 month ago  @alice  "Initial impl"      ││
│ └──────────────────────────────────────────┘│
│                                             │
│ ┌─ Tests (4 passing) ──────────────────────┐│
│ │ ✅ normalizes basic user object          ││
│ │ ✅ handles missing optional fields       ││
│ │ ✅ throws on invalid input               ││
│ │ ⚠️ uncovered: null email branch (L34)    ││
│ └──────────────────────────────────────────┘│
│                                             │
│ ┌─ AI Summary ─────────────────────────────┐│
│ │ Transforms raw API user objects into     ││
│ │ normalized format with defaults.         ││
│ │ Key: handles legacy `userName` → `name`. ││
│ └──────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

---

## Appendix C: Telemetry Events (Privacy-Safe)

| Event | Properties | Purpose |
|-------|------------|---------|
| `extension.activated` | `version`, `vscodeVersion`, `os` | Install tracking |
| `explain.selection.invoked` | `lineCount`, `languageId`, `source` (command/menu) | Feature usage |
| `explain.selection.feedback` | `helpful` (boolean), `responseTime` | Quality tracking |
| `diagnostic.hover.shown` | `diagnosticCode`, `languageId` | Error pattern coverage |
| `diagnostic.fix.applied` | `diagnosticCode`, `fixType` | Fix success rate |
| `deepdive.opened` | `tabViewed` (usages/history/tests/summary) | Feature engagement |
| `smell.detected` | `smellType`, `severity`, `dismissed` | Smell accuracy |
| `smell.refactor.applied` | `smellType`, `reverted` (after 5min) | Refactor quality |
| `llm.request` | `feature`, `tokenCount`, `latency` | LLM cost/perf |
| `error.occurred` | `errorType`, `stack` (redacted) | Bug tracking |

**Privacy guarantees:**
- No code content ever sent
- No file paths (only extensions: `.ts`, `.js`)
- No user identifiers (anonymous install ID only)
- Telemetry can be fully disabled

---

## Appendix D: Competitive Teardown

| Feature | GitHub Copilot | Cursor | Codeium | Code Coach |
|---------|---------------|--------|---------|------------|
| **Primary use case** | Code generation | AI-native IDE | Code completion | Code understanding |
| **Explain code** | Chat (context lost) | Chat (good) | ❌ | ✅ Inline + panel |
| **Explain errors** | Chat only | Chat only | ❌ | ✅ Hover + trace |
| **Root cause tracing** | ❌ | ❌ | ❌ | ✅ Call graph |
| **Git integration** | ❌ | ❌ | ❌ | ✅ Blame per symbol |
| **Test awareness** | ❌ | ❌ | ❌ | ✅ Coverage + gaps |
| **Code smells** | ❌ | ❌ | ✅ Basic | ✅ With actions |
| **Offline mode** | ❌ | ❌ | ❌ | ✅ Full static |
| **Monorepo perf** | ⚠️ Slow | ⚠️ Slow | ⚠️ Slow | ✅ Optimized |
| **Price** | $10-19/mo | $20/mo | $10/mo | $0-15/mo |
| **Citations** | ❌ Sometimes | ❌ | ❌ | ✅ Always |

**Positioning:** "Copilot writes code. Code Coach explains it."

---

## Appendix E: 10 Killer Demo Scripts (2-min video)

### Demo 1: "New Joiner Onboarding"
*Setup:* Open unfamiliar codebase. Select complex function.
*Action:* Cmd+Shift+E → Show explanation panel
*Payoff:* "Understood in 30 seconds instead of 15 minutes"

### Demo 2: "The Cryptic TypeScript Error"
*Setup:* Show red squiggle with TS2339
*Action:* Hover → Show enhanced explanation with root cause
*Payoff:* "Knew exactly which file to fix"

### Demo 3: "The Runtime Error Hunt"
*Setup:* Show `Cannot read property of undefined`
*Action:* Trace Origin → Show call graph
*Payoff:* "Found the bug in the API layer, not the component"

### Demo 4: "AI Code Review"
*Setup:* Show AI-generated function
*Action:* "Explain Why This Works" → Show assumptions + edge cases
*Payoff:* "Now I trust this code because I understand it"

### Demo 5: "The Hidden SQL Injection"
*Setup:* Show function with user input → SQL
*Action:* Click CodeLens warning → Show security smell
*Payoff:* "Caught before production"

### Demo 6: "Test Coverage Gaps"
*Setup:* Show function with 80% coverage
*Action:* Click "2 branches uncovered" → See gap details
*Payoff:* "Generated test for edge case in 10 seconds"

### Demo 7: "Who Wrote This?"
*Setup:* See confusing code
*Action:* Deep Dive → History tab → See author + commit message
*Payoff:* "Context from 6 months ago explained everything"

### Demo 8: "The O(n²) Surprise"
*Setup:* Show nested loop
*Action:* CodeLens warning → Performance smell detail
*Payoff:* "Refactored to O(n) with one click"

### Demo 9: "Offline on a Plane"
*Setup:* Show airplane mode
*Action:* Full explain still works (static analysis)
*Payoff:* "No internet, still productive"

### Demo 10: "Enterprise Privacy"
*Setup:* Show settings: privacy mode = offline
*Action:* Demonstrate no network calls in dev tools
*Payoff:* "Your code never leaves your machine"

---

## Appendix F: Onboarding Flow (New Joiners)

### First Launch

```
┌─────────────────────────────────────────────────────┐
│ 👋 Welcome to Code Coach                            │
│                                                     │
│ I help you understand code you didn't write.       │
│                                                     │
│ Let's set up in 30 seconds:                         │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 1. Privacy Mode                                 │ │
│ │    ○ Offline (static analysis only)            │ │
│ │    ○ Local LLM (your machine)                  │ │
│ │    ● Cloud (best explanations) ← recommended   │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 2. Keyboard Shortcut                           │ │
│ │    Explain Selection: Cmd+Shift+E              │ │
│ │    [Customize]                                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│                              [Get Started →]        │
└─────────────────────────────────────────────────────┘
```

### Guided Walkthrough (Optional)

```
Step 1: "Select these 3 lines and press Cmd+Shift+E"
        → Shows explain panel
        → "Great! You just got a code explanation."

Step 2: "Now hover over this red squiggle"
        → Shows enhanced diagnostic
        → "See how we show the root cause?"

Step 3: "Click 'Trace Origin' to see the call graph"
        → Shows visualization
        → "You can trace any error back to its source."

Step 4: "You're ready! Here are power user tips:"
        → Deep Dive, Smell Detection, Test Gaps

[Finish Tour] [Show Tips Later]
```

---

## Appendix G: Internal Prompt Templates

### Explain Selection Prompt

```
You are a code explanation assistant. Explain the following code to a developer who didn't write it.

RULES:
- Be concise (max 200 words for summary)
- Use plain English, avoid jargon
- Always cite line numbers
- Mention edge cases and assumptions
- If you're unsure, say so

CODE ({{languageId}}):
```
{{selectedCode}}
```

CONTEXT:
- File: {{fileName}}
- Lines: {{startLine}}-{{endLine}}
- Surrounding code: {{surroundingContext}}

OUTPUT FORMAT:
{
  "summary": "One sentence summary",
  "walkthrough": [
    {"line": 1, "explanation": "..."},
    {"line": 2, "explanation": "..."}
  ],
  "concepts": ["concept1", "concept2"],
  "assumptions": ["assumption1"],
  "edgeCases": ["edge case 1"]
}
```

### Debug Error Prompt

```
You are a debugging assistant. Explain why this error occurred and how to fix it.

RULES:
- Identify the root cause, not just the symptom
- Provide 2-3 fix options ranked by preference
- Cite exact file:line locations
- Be specific to this codebase, not generic advice

ERROR:
{{diagnosticMessage}}
Code: {{diagnosticCode}}
File: {{fileName}}:{{line}}

RELEVANT CODE:
```
{{codeSnippet}}
```

CALL CONTEXT:
{{callChain}}

OUTPUT FORMAT:
{
  "rootCause": "...",
  "explanation": "...",
  "fixes": [
    {
      "description": "...",
      "code": "...",
      "location": "file:line"
    }
  ]
}
```

### Code Smell Prompt

```
You are a code quality assistant. Identify potential issues in this code.

RULES:
- Only flag real issues, not style preferences
- Severity: low (maintainability), medium (performance), high (security/correctness)
- Provide specific refactor, not vague advice
- False positives damage trust—when in doubt, don't flag

CODE ({{languageId}}):
```
{{code}}
```

OUTPUT FORMAT:
{
  "smells": [
    {
      "type": "performance|security|maintainability|correctness",
      "severity": "low|medium|high",
      "line": 42,
      "description": "...",
      "suggestion": "...",
      "refactoredCode": "..."
    }
  ]
}
```

### Why Does This Work Prompt

```
You are a code analysis assistant. Explain WHY this code works, not just WHAT it does.

RULES:
- Identify hidden assumptions and dependencies
- List edge cases that are handled (and not handled)
- Explain what could break this code
- Be honest about uncertainty

CODE ({{languageId}}):
```
{{code}}
```

CONTEXT:
- This code is called by: {{callers}}
- This code calls: {{callees}}
- Related tests: {{tests}}

OUTPUT FORMAT:
{
  "whyItWorks": "...",
  "assumptions": ["..."],
  "edgeCasesHandled": ["..."],
  "edgeCasesNotHandled": ["..."],
  "whatCouldBreakThis": ["..."],
  "confidenceLevel": "high|medium|low"
}
```

---

*Document version: 1.0*
*Last updated: {{date}}*
*Author: Code Coach Team*
