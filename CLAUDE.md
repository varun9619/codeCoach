# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Code Coach is a VS Code extension that provides plain-English explanations of JavaScript/TypeScript code and diagnostics. This is a **static-only MVP** — it analyzes code structure without executing or capturing runtime values.

## Development Commands

All commands run from the `extension/` directory:

```bash
cd extension
npm install          # Install dependencies
npm run compile      # Compile TypeScript to out/
npm run watch        # Watch mode for development
npm run lint         # Run ESLint
```

**Running the extension**: Press `F5` in VS Code (with `extension/` open) to launch the Extension Host.

## Architecture

```
extension/
├── src/
│   ├── extension.ts          # Entry point: registers commands + hover provider
│   ├── explainSelection.ts   # Parses selected code via TS compiler API, generates explanations
│   └── explainDiagnostics.ts # Maps VS Code diagnostics to plain-English cause/fix pairs
└── out/                      # Compiled JS output
```

**Core flow**:
1. `extension.ts` activates on JS/TS files and registers two commands + a hover provider
2. Commands pipe selected text or diagnostics to the respective explain functions
3. Results are displayed in the "Code Coach" Output Channel or as hover tooltips

**Key patterns**:
- Uses TypeScript's compiler API (`ts.createSourceFile`) for lightweight AST parsing in `explainSelection.ts`
- Pattern-matching on TS diagnostic codes (2304, 2339, 2322, 2345) with fallback heuristics in `explainDiagnostics.ts`
- Outputs plain Markdown for hovers (`vscode.MarkdownString`)

## Design Principles

- Keep changes minimal and focused on static-only MVP
- Prefer clear, plain-English explanations over verbose output
- JS/TS first; design for future language adapters
- Avoid adding extra UI beyond Output Channel and hover text unless requested
