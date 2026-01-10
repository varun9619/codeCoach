# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Code Coach is a VS Code extension that explains code you did not write. It provides plain-English explanations, debugging guidance, and navigation aids—especially useful for AI-assisted codebases and new team members. The extension supports both static analysis and optional AI-powered explanations via multiple providers.

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
extension/src/
├── extension.ts          # Entry point: registers all commands, providers, and activation logic
├── AI Layer
│   ├── aiClient.ts       # Multi-provider AI integration (OpenRouter/OpenAI/Anthropic/Gemini/Ollama/LM Studio)
│   ├── aiSettings.ts     # API key storage (VS Code Secret Storage), provider configuration
│   ├── aiTypes.ts        # TypeScript interfaces for AI requests/responses
│   ├── aiVerify.ts       # Citation verification against source ranges
│   └── promptOptimizer.ts # Structures prompts into objective/constraints/evidence/output format
├── Core Analysis
│   ├── explainSelection.ts    # Line-by-line code explanation via TS compiler API
│   ├── explainDiagnostics.ts  # Maps diagnostic codes to plain-English cause/fix pairs
│   ├── smells.ts              # Code smell detection (complexity, dead code, nested callbacks, etc.)
│   ├── testGaps.ts            # Branch coverage analysis from lcov.info/coverage-final.json
│   └── diagnosticFixes.ts     # Quick fix code actions (optional chaining, non-null assertion)
├── UI Providers
│   ├── deepDive.ts            # TreeView sidebar: usages, blame, history, tests, coverage, AI summary
│   ├── coachMode.ts           # InlayHintsProvider for inline annotations
│   ├── smellProviders.ts      # CodeLens + CodeAction providers for smell detection
│   └── testGapProviders.ts    # CodeLens + CodeAction providers for test coverage gaps
├── Infrastructure
│   ├── configManager.ts   # Cascading config system (project → global → VS Code → defaults)
│   ├── privacy.ts         # Privacy mode enforcement (offline/local/redacted/full)
│   ├── analysisCache.ts   # Symbol and reference caching for performance
│   ├── workspaceIndex.ts  # Background symbol prewarming for large repos
│   ├── runtimeTracing.ts  # Debug session exception capture (opt-in)
│   └── telemetry.ts       # Local-only telemetry logging
├── Team Intelligence (Phase 2)
│   ├── templates/         # Explanation templates (Junior Dev, Security Review, etc.)
│   ├── teamPins.ts        # Team-pinned symbols for onboarding
│   ├── explainDiff.ts     # Git diff explanations
│   ├── tours/             # Interactive onboarding tours
│   ├── subscriptions/     # Code change subscriptions
│   ├── cache/             # Shared explanation cache
│   └── graph/             # Team knowledge graph visualization
├── Enterprise (Phase 4)
│   ├── enterprise/
│   │   ├── ssoTypes.ts        # SSO type definitions
│   │   ├── ssoAuth.ts         # OAuth2/OIDC authentication
│   │   ├── customEndpointTypes.ts  # Custom endpoint types
│   │   └── customEndpointManager.ts # Self-hosted model management
```

## Core Flows

### Explain Selection
1. User selects code → `explainSelection.ts` parses via `ts.createSourceFile`
2. AST walk generates line-by-line explanations with citations
3. If AI enabled: enriched via `aiClient.ts` with prompt from `promptOptimizer.ts`
4. Citations verified against source range via `aiVerify.ts`
5. Output rendered to configured surface (output channel / panel / peek)

### AI Request Pipeline
1. Privacy check via `privacy.ts` (blocks if offline mode, restricts to localhost in local mode)
2. Prompt structured via `promptOptimizer.ts` (objective/constraints/evidence/output format)
3. Request sent via `aiClient.ts` with provider-specific headers and auth
4. Response verified for citations via `aiVerify.ts`
5. Verification notes added if citations don't match source

### Deep Dive Sidebar
1. User invokes on symbol → `deepDive.ts` gathers:
   - Symbol overview (signature, JSDoc)
   - Usages via `vscode.executeReferenceProvider`
   - Git blame and history via shell commands
   - Test file detection (heuristic)
   - Coverage data from parsed lcov/coverage-final.json
   - AI summary (if enabled)
2. TreeView displays collapsible sections with navigation links
3. Supports pinning, section filtering, and markdown export

## Key Patterns

- **Privacy-first**: All AI requests pass through `privacy.ts` which enforces mode restrictions and applies redaction patterns before any data leaves the device
- **Provider abstraction**: `aiClient.ts` normalizes 6 different AI providers behind a common interface with provider-specific auth headers and endpoints
- **Citation verification**: AI outputs include line citations that are validated against actual source ranges; unverifiable claims get flagged
- **Progressive enhancement**: Every feature works in static-only mode; AI adds richer explanations when available
- **Configurable surfaces**: Each command output can be routed to output channel, webview panel, or peek view via settings

## Design Principles

- Keep changes minimal and focused
- Prefer clear, plain-English explanations over verbose output
- JS/TS first; design for future language adapters
- Avoid adding extra UI beyond Output Channel and hover text unless requested
- Privacy modes must be respected—never send code externally in offline/local modes

## Phase 2: Team Intelligence Features

| Feature | Command | Description |
|---------|---------|-------------|
| **Explanation Templates** | `Code Coach: Explain Selection` | Choose from templates (Junior Dev, Security Review, Performance, etc.) |
| **Team Pinned Symbols** | Right-click → `Pin for Team` | Mark important symbols for team visibility |
| **Explain Diff** | `Code Coach: Explain Diff` | Explain git changes in plain English |
| **Onboarding Tours** | `Code Coach: Create Tour` | Create interactive codebase tours |
| **Change Subscriptions** | `Code Coach: Subscribe to File Changes` | Get notified when specific files change |
| **Shared Explanation Cache** | Automatic | Cache AI explanations for team reuse |
| **Knowledge Graph** | `Code Coach: Show Knowledge Graph` | Visualize codebase dependencies |

## Phase 4: Enterprise Features

| Feature | Command | Description |
|---------|---------|-------------|
| **SSO Integration** | `Code Coach: Enterprise SSO Login` | OAuth2/OIDC with Azure AD, Okta, Auth0, Google |
| **Custom Model Endpoints** | `Code Coach: Add Custom Model Endpoint` | Configure Azure OpenAI, AWS Bedrock, vLLM, etc. |
| **Endpoint Management** | `Code Coach: Manage Custom Endpoints` | List, test, set default endpoints |

### Supported SSO Providers
- Microsoft Entra ID (Azure AD)
- Okta
- Auth0
- Google Workspace
- Custom OIDC

### Supported Custom Endpoints
- Azure OpenAI Service
- AWS Bedrock
- Google Vertex AI
- vLLM
- Text Generation Inference (TGI)
- Ollama
- OpenAI-compatible APIs
- Anthropic-compatible APIs

## Key Settings

**AI Configuration** (`codeCoach.ai.*`):
- `enabled`, `provider`, `baseUrl`, `model`, `temperature`, `maxTokens`
- `promptOptimizer`, `promptOptimizerMode`, `strictJson`

**Privacy** (`codeCoach.privacy.*`):
- `mode` (offline | local | redacted | full)
- `allowedDomains`, `redactPatterns`, `maxContextChars`

**UI Surfaces** (`codeCoach.ui.*`):
- Per-command output routing: `explainSelection`, `explainDiagnostic`, `codeSmells`, `testGaps`, etc.

**Performance** (`codeCoach.performance.*`):
- `prewarmSymbols`, `prewarmFileLimit`, `prewarmDelayMs`, `prewarmGlob`

## Testing the Extension

1. `npm run compile` in `extension/`
2. Press F5 to launch Extension Host
3. Open a JS/TS file in the new VS Code window
4. Test commands via Command Palette (Ctrl/Cmd+Shift+P → "Code Coach: ...")

## Documentation

- Vision and roadmap: `PRODUCT_PROPOSAL.md`
- Implementation plan: `docs/IMPLEMENTATION_PLAN.md`
- Gap analysis: `docs/IMPLEMENTATION_PLAN_GAPS.md`
- Coverage status: `docs/PROPOSAL_STATUS.md`
- Monetization: `docs/MONETIZATION.md`
- Competitive analysis: `docs/COMPETITIVE_MOAT.md`
- **Cascading config system: `docs/CASCADING_CONFIG.md`** (team-shareable settings)
