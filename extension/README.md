# Code Coach VS Code Extension

A VS Code extension that explains code you didn't write. Provides plain-English explanations, debugging guidance, team collaboration features, and enterprise integrations.

## Features Overview

### Core Features (Static + AI)
- **Explain Selection**: Line-by-line code explanations with citations
- **Explain Why This Works**: Assumptions, edge cases, and breakpoints
- **Explain Diagnostic**: Plain-English error explanations with fixes
- **Trace Diagnostic Origin**: Find root causes through call chains
- **Deep Dive**: Comprehensive symbol analysis (usages, blame, tests)
- **Code Smells**: Detect and fix quality issues
- **Test Gap Finder**: Find untested code branches
- **Coach Mode**: Inline explanatory hints

### Team Intelligence (Phase 2)
- **Explanation Templates**: Junior Dev, Security, Performance, etc.
- **Team Pinned Symbols**: Mark important code for team visibility
- **Explain Diff**: Git change explanations
- **Onboarding Tours**: Interactive codebase tours
- **Change Subscriptions**: Notifications when files change
- **Shared Cache**: Team-wide explanation caching
- **Knowledge Graph**: Visual dependency map

### Enterprise (Phase 4)
- **SSO Integration**: Azure AD, Okta, Auth0, Google, Custom OIDC
- **Custom Endpoints**: Azure OpenAI, AWS Bedrock, vLLM, TGI, etc.

---

## All Commands

### Core Commands

| Command | Description |
|---------|-------------|
| `Code Coach: Explain Selection` | Explain highlighted code |
| `Code Coach: Explain Why This Works` | Analyze assumptions and edge cases |
| `Code Coach: Explain Diagnostic` | Explain error under cursor |
| `Code Coach: Trace Diagnostic Origin` | Find root cause of error |
| `Code Coach: Trace Stack Trace` | Parse and link stack trace |
| `Code Coach: Deep Dive` | Full symbol analysis |
| `Code Coach: Show Code Smells` | Run smell detection |
| `Code Coach: Show Test Gaps` | Find untested branches |
| `Code Coach: Run Onboarding` | Replay first-run walkthrough |

### Deep Dive Commands

| Command | Description |
|---------|-------------|
| `Code Coach: Pin Deep Dive` | Pin current symbol |
| `Code Coach: Unpin Deep Dive` | Remove pin |
| `Code Coach: Deep Dive Sections` | Filter visible sections |
| `Code Coach: Export Deep Dive` | Export as markdown |

### AI Commands

| Command | Description |
|---------|-------------|
| `Code Coach: Set AI API Key` | Store API key securely |
| `Code Coach: Clear AI API Key` | Remove stored key |

### Team Intelligence Commands

| Command | Description |
|---------|-------------|
| `Code Coach: Explain Diff` | Explain git changes |
| `Code Coach: Show Team Pins` | View all team pins |
| `Code Coach: Create Tour` | Start new onboarding tour |
| `Code Coach: Add Tour Stop` | Add stop to current tour |
| `Code Coach: Start Tour` | Run an existing tour |
| `Code Coach: Subscribe to File Changes` | Watch for changes |
| `Code Coach: Manage Subscriptions` | View/edit subscriptions |
| `Code Coach: Show Cache Statistics` | View cache stats |
| `Code Coach: Clear Explanation Cache` | Clear cached explanations |
| `Code Coach: Show Knowledge Graph` | Open dependency graph |
| `Code Coach: Focus Knowledge Graph on Current File` | Focus on current file |

### Enterprise Commands

| Command | Description |
|---------|-------------|
| `Code Coach: Enterprise SSO Login` | Authenticate with IdP |
| `Code Coach: Enterprise SSO Logout` | Sign out |
| `Code Coach: Enterprise SSO Status` | Check auth status |
| `Code Coach: Add Custom Model Endpoint` | Configure self-hosted AI |
| `Code Coach: Manage Custom Endpoints` | List/test/remove endpoints |
| `Code Coach: Test Default Endpoint` | Quick test default endpoint |

### Utility Commands

| Command | Description |
|---------|-------------|
| `Code Coach: Feedback (Helpful/Not Helpful)` | Rate explanations |
| `Code Coach: Create Config` | Generate config file |
| `Code Coach: Validate Config` | Check config for errors |
| `Code Coach: Show Resolved Config` | See merged config |

---

## All Settings

### AI Configuration

```jsonc
{
  // Enable AI features (default: false)
  "codeCoach.ai.enabled": false,

  // AI provider: openrouter | openai | anthropic | gemini | ollama | lmstudio
  "codeCoach.ai.provider": "openrouter",

  // Override provider's default model
  "codeCoach.ai.model": "",

  // Override base URL
  "codeCoach.ai.baseUrl": "",

  // Override endpoint path (supports {model} placeholder)
  "codeCoach.ai.endpointPath": "",

  // Temperature: 0 (deterministic) to 2 (creative)
  "codeCoach.ai.temperature": 0.2,

  // Maximum response tokens
  "codeCoach.ai.maxTokens": 800,

  // Response style: concise | detailed
  "codeCoach.ai.responseStyle": "concise",

  // Enable prompt optimizer (structures prompts for better results)
  "codeCoach.ai.promptOptimizer": true,

  // Optimizer mode: strict | balanced | compact
  "codeCoach.ai.promptOptimizerMode": "strict",

  // Show optimized prompts in debug output
  "codeCoach.ai.promptDebug": false,

  // Require JSON-only responses (uses provider's JSON mode)
  "codeCoach.ai.strictJson": false,

  // Override auth header name
  "codeCoach.ai.authHeader": "",

  // Override auth scheme (e.g., "Bearer")
  "codeCoach.ai.authScheme": "",

  // Additional headers to send
  "codeCoach.ai.extraHeaders": {},

  // OpenRouter-specific headers
  "codeCoach.ai.openrouter.referer": "",
  "codeCoach.ai.openrouter.title": ""
}
```

### Privacy Configuration

```jsonc
{
  // Privacy mode: offline | local | redacted | full
  "codeCoach.privacy.mode": "offline",

  // Allowed API domains (when mode is redacted/full)
  "codeCoach.privacy.allowedDomains": [],

  // Patterns to strip before sending (regex)
  "codeCoach.privacy.redactPatterns": [
    "API_KEY=.*",
    "SECRET=.*",
    "PASSWORD=.*"
  ],

  // Maximum context characters to send
  "codeCoach.privacy.maxContextChars": 4000
}
```

### UI Configuration

```jsonc
{
  // Output surface for each command: output | panel | peek
  "codeCoach.ui.explainSelection": "output",
  "codeCoach.ui.explainWhyWorks": "output",
  "codeCoach.ui.explainDiagnostic": "output",
  "codeCoach.ui.traceDiagnosticOrigin": "output",
  "codeCoach.ui.runtimeException": "output",
  "codeCoach.ui.codeSmells": "output",
  "codeCoach.ui.testGaps": "output"
}
```

### Deep Dive Configuration

```jsonc
{
  // Visible sections: overview, usages, blame, history, tests, coverage, summary
  "codeCoach.deepDive.sections": ["overview", "usages", "blame", "history", "tests", "coverage", "summary"],

  // Include AI summary (requires AI enabled)
  "codeCoach.deepDive.aiSummary": true,

  // Max commits to show in history
  "codeCoach.deepDive.historyLimit": 10
}
```

### Template Configuration

```jsonc
{
  // Default template ID
  "codeCoach.templates.default": "general",

  // Show template picker on explain
  "codeCoach.templates.showPicker": true,

  // Path to custom templates directory
  "codeCoach.templates.customTemplatesPath": "",

  // Number of recent templates to track
  "codeCoach.templates.maxRecentTemplates": 5
}
```

### Coach Mode Configuration

```jsonc
{
  // Enable inline hints
  "codeCoach.coachMode.enabled": false,

  // Maximum hints per file
  "codeCoach.coachMode.maxHints": 50
}
```

### Performance Configuration

```jsonc
{
  // Enable background symbol warming
  "codeCoach.performance.prewarmSymbols": false,

  // Maximum files to prewarm
  "codeCoach.performance.prewarmFileLimit": 200,

  // Delay before starting prewarm (ms)
  "codeCoach.performance.prewarmDelayMs": 5000,

  // Glob patterns for files to prewarm
  "codeCoach.performance.prewarmGlob": ["src/**/*.ts", "src/**/*.tsx"],

  // Glob pattern to exclude
  "codeCoach.performance.prewarmExclude": "**/node_modules/**"
}
```

### Test Gaps Configuration

```jsonc
{
  // Paths to search for coverage files
  "codeCoach.testGaps.coveragePaths": [
    "coverage/lcov.info",
    "coverage/coverage-final.json"
  ]
}
```

### Enterprise Configuration

```jsonc
{
  // Allowed AI providers (empty = all allowed)
  "codeCoach.enterprise.allowedAiProviders": [],

  // Path for audit log file
  "codeCoach.enterprise.auditLogPath": ""
}
```

### Runtime & Telemetry

```jsonc
{
  // Enable debug session exception capture
  "codeCoach.runtime.enabled": false,

  // Auto-explain caught exceptions
  "codeCoach.runtime.autoExplainOnException": false,

  // Max variables to capture per exception
  "codeCoach.runtime.maxVariables": 10,

  // Enable local-only telemetry
  "codeCoach.telemetry.enabled": false
}
```

---

## Context Menu Actions

Right-click in the editor to access:

| Menu Item | When Available |
|-----------|----------------|
| **Code Coach: Explain Selection** | When text is selected |
| **Code Coach: Explain Why This Works** | When text is selected |
| **Code Coach: Deep Dive** | Always (uses cursor position) |
| **Pin for Team** | Always (uses cursor position) |

---

## Team-Shareable Files

Code Coach stores team data in `.code-coach/` (add to git):

| File | Purpose |
|------|---------|
| `config.json` | Shared settings |
| `pins.json` | Team-pinned symbols |
| `tours/*.json` | Onboarding tours |
| `templates/*.md` | Custom explanation templates |
| `subscriptions.json` | Change subscriptions |
| `cache/explanations.json` | Shared AI cache |
| `endpoints.json` | Custom AI endpoints |

---

## Development

```bash
npm install
npm run compile
npm run watch  # For development
npm run lint   # Check code style
```

Press `F5` to launch the Extension Host.

---

## Architecture

```
src/
├── extension.ts           # Entry point
├── AI Layer
│   ├── aiClient.ts        # Multi-provider integration
│   ├── aiSettings.ts      # API key management
│   ├── aiTypes.ts         # Request/response types
│   ├── aiVerify.ts        # Citation verification
│   └── promptOptimizer.ts # Prompt structuring
├── Core Analysis
│   ├── explainSelection.ts
│   ├── explainDiagnostics.ts
│   ├── smells.ts
│   └── testGaps.ts
├── UI Providers
│   ├── deepDive.ts
│   ├── coachMode.ts
│   └── *Providers.ts
├── Team Intelligence
│   ├── templates/
│   ├── teamPins.ts
│   ├── explainDiff.ts
│   ├── tours/
│   ├── subscriptions/
│   ├── cache/
│   └── graph/
└── Enterprise
    ├── ssoAuth.ts
    ├── ssoTypes.ts
    ├── customEndpointManager.ts
    └── customEndpointTypes.ts
```

---

## License

MIT
