# Platform Expansion Plan

This document outlines feasibility and required changes for VS Code Web and JetBrains IDEs.

## VS Code Web (vscode.dev / github.dev)

### Constraints
- No `child_process` (git blame/log must use VS Code APIs or be disabled).
- Limited filesystem access; no direct shell commands.
- Webview CSP restrictions are stricter.

### Required changes
- Replace git blame/log with:
  - VS Code Git extension APIs when available, or
  - fallback to "history not available" in web mode.
- Replace local file reads with `vscode.workspace.fs` only.
- Avoid Node-only modules or guard them behind runtime checks.
- Add `isWebExtension` gate to disable features that rely on local binaries.

### Minimum viable web support
- Explain Selection (static)
- Explain Diagnostic (static)
- Trace Origin (references only)
- Deep Dive (usages only, no blame/history)

---

## JetBrains (IntelliJ / WebStorm) Prep

### Strategy
- Extract a language-agnostic core library:
  - AST parsing adapters
  - smell rule engine
  - test gap parsing
  - prompt building + verification
- Keep IDE-specific UI layers thin.

### Required changes
- Move analysis + prompt logic into `/core` package.
- Add an interface for:
  - symbol provider
  - diagnostics provider
  - code actions / quick fixes
- Implement JetBrains plugin UI:
  - editor gutter / intention actions
  - tool window for Deep Dive

### Milestone
- Core extraction prototype (2-3 weeks)
- First JetBrains POC (4-6 weeks after core)
