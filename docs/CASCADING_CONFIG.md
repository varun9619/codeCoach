# Cascading Configuration System

Code Coach uses a cascading configuration system that allows teams to share settings via git while keeping sensitive data secure in VS Code's Secret Storage.

---

## Quick Start

1. **Command Palette** (Cmd/Ctrl+Shift+P) → **"Code Coach: Init Config"**
2. Select a template (Minimal, Team Standard, or Enterprise)
3. Choose a privacy mode
4. Commit `.code-coach/config.json` to git

Your team now shares the same Code Coach settings!

---

## How It Works

### Resolution Order (highest priority wins)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Project Config    .code-coach/config.json   (git-tracked)│
├─────────────────────────────────────────────────────────────┤
│ 2. Global Config     ~/.code-coach/config.json (personal)   │
├─────────────────────────────────────────────────────────────┤
│ 3. VS Code Settings  Settings UI / settings.json            │
├─────────────────────────────────────────────────────────────┤
│ 4. Defaults          Built-in fallbacks                     │
└─────────────────────────────────────────────────────────────┘
```

**Example**: If your project config sets `ai.provider: "anthropic"` but your VS Code settings have `ai.provider: "openai"`, the project config wins.

---

## Configuration Templates

When you run **"Code Coach: Init Config"**, you'll choose from these templates:

### 1. Minimal

Best for: Teams not using AI features, privacy-first environments

```json
{
  "version": 1,
  "ai": {
    "enabled": false
  },
  "privacy": {
    "mode": "offline"
  }
}
```

**What you get:**
- AI disabled by default
- Offline privacy mode (no network requests)
- Static analysis features only

---

### 2. Team Standard

Best for: Most development teams using AI-assisted explanations

```json
{
  "version": 1,
  "ai": {
    "enabled": true,
    "provider": "openrouter",
    "responseStyle": "concise",
    "temperature": 0.2,
    "maxTokens": 800
  },
  "privacy": {
    "mode": "redacted",
    "redactPatterns": [
      "API_KEY=.*",
      "SECRET=.*",
      "PASSWORD=.*",
      "TOKEN=.*"
    ]
  },
  "ui": {
    "explainSelection": "panel",
    "explainDiagnostic": "panel"
  },
  "deepDive": {
    "aiSummary": true,
    "historyLimit": 10
  }
}
```

**What you get:**
- AI enabled with sensible defaults
- Redacted mode strips secrets before sending to AI
- Panel-based UI for explanations
- AI summaries in Deep Dive sidebar

---

### 3. Enterprise

Best for: Large teams with compliance requirements

```json
{
  "version": 1,
  "ai": {
    "enabled": true,
    "provider": "openrouter",
    "responseStyle": "detailed",
    "temperature": 0.1,
    "maxTokens": 1200,
    "promptOptimizer": true,
    "promptOptimizerMode": "strict"
  },
  "privacy": {
    "mode": "redacted",
    "redactPatterns": [
      "API_KEY=.*",
      "SECRET=.*",
      "PASSWORD=.*",
      "TOKEN=.*",
      "PRIVATE_KEY=.*",
      "CREDENTIAL=.*"
    ],
    "maxContextChars": 8000
  },
  "ui": {
    "explainSelection": "panel",
    "explainWhyWorks": "panel",
    "explainDiagnostic": "panel",
    "traceDiagnosticOrigin": "panel",
    "codeSmells": "panel",
    "testGaps": "panel"
  },
  "deepDive": {
    "aiSummary": true,
    "historyLimit": 20
  },
  "performance": {
    "prewarmSymbols": true,
    "prewarmFileLimit": 500
  },
  "enterprise": {
    "allowedAiProviders": ["openrouter", "anthropic", "openai"]
  }
}
```

**What you get:**
- Strict prompt optimization for consistent outputs
- Extended redaction patterns
- All UI features enabled
- Symbol prewarming for large repos
- Provider allowlist for compliance

---

### 4. Copy from Global

Copies your personal `~/.code-coach/config.json` to the project. Useful when you've tuned settings you want to share.

---

## Settings Classification

### Shareable Settings (can be in config.json)

These settings are safe to commit to git and share with your team:

| Category | Settings |
|----------|----------|
| **AI Behavior** | `ai.enabled`, `ai.provider`, `ai.model`, `ai.responseStyle`, `ai.temperature`, `ai.maxTokens`, `ai.promptOptimizer`, `ai.promptOptimizerMode` |
| **Privacy** | `privacy.mode`, `privacy.allowedDomains`, `privacy.redactPatterns`, `privacy.maxContextChars` |
| **UI Surfaces** | `ui.explainSelection`, `ui.explainWhyWorks`, `ui.explainDiagnostic`, `ui.traceDiagnosticOrigin`, `ui.runtimeException`, `ui.codeSmells`, `ui.testGaps` |
| **Deep Dive** | `deepDive.sections`, `deepDive.aiSummary`, `deepDive.historyLimit` |
| **Performance** | `performance.prewarmSymbols`, `performance.prewarmFileLimit`, `performance.prewarmDelayMs`, `performance.prewarmGlob`, `performance.prewarmExclude` |
| **Coach Mode** | `coachMode.enabled`, `coachMode.maxHints` |
| **Test Gaps** | `testGaps.coveragePaths` |
| **Enterprise** | `enterprise.allowedAiProviders`, `enterprise.auditLogPath` |

---

### VS Code-Only Settings (NEVER in config.json)

These settings contain sensitive or personal data and **must stay in VS Code settings**:

| Setting | Why it's VS Code-only |
|---------|----------------------|
| `ai.baseUrl` | May contain internal URLs |
| `ai.endpointPath` | API routing info |
| `ai.authHeader` | Authentication config |
| `ai.authScheme` | Auth scheme details |
| `ai.extraHeaders` | May contain tokens |
| `ai.openrouter.referer` | Personal app info |
| `ai.openrouter.title` | Personal app info |
| `ai.promptDebug` | Debug mode (personal) |
| `ai.strictJson` | Personal preference |
| `runtime.enabled` | Debug feature |
| `runtime.autoExplainOnException` | Debug feature |
| `runtime.maxVariables` | Debug config |
| `telemetry.enabled` | Personal choice |

---

## API Keys: Security Guarantee

**API keys are NEVER stored in config.json files.**

API keys use VS Code's Secret Storage, which:
- Encrypts keys using OS-level secure storage (Keychain on macOS, Credential Manager on Windows)
- Never writes keys to disk in plain text
- Is not accessible to other extensions

### Setting API Keys

```
Command Palette → "Code Coach: Set AI API Key"
```

This stores the key in VS Code Secret Storage, not in any config file.

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    Config Resolution                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Shareable Settings          Sensitive Settings            │
│  ─────────────────           ──────────────────            │
│  .code-coach/config.json     VS Code Secret Storage        │
│  ~/.code-coach/config.json   VS Code settings.json         │
│                                                             │
│  ✓ Committed to git          ✗ Never in git                │
│  ✓ Shared with team          ✓ Personal only               │
│                                                             │
│  Examples:                   Examples:                      │
│  • ai.provider               • API keys (Secret Storage)   │
│  • ai.model                  • ai.baseUrl                  │
│  • privacy.mode              • ai.authHeader               │
│  • ui.explainSelection       • telemetry.enabled           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Commands

| Command | Description |
|---------|-------------|
| **Code Coach: Init Config** | Create a new project config from template |
| **Code Coach: Open Project Config** | Open `.code-coach/config.json` |
| **Code Coach: Open Global Config** | Open `~/.code-coach/config.json` |
| **Code Coach: Show Resolved Config** | See merged config from all sources |
| **Code Coach: Validate Config** | Check configs for errors |
| **Code Coach: Reset Project Config** | Delete project config |

---

## File Locations

| Config | Location | Purpose |
|--------|----------|---------|
| **Project** | `.code-coach/config.json` | Team settings (git-tracked) |
| **Global** | `~/.code-coach/config.json` | Personal defaults |
| **VS Code** | Settings UI or `settings.json` | Sensitive/personal settings |

---

## Example Workflow

### New Team Member Onboarding

1. Clone the repo (includes `.code-coach/config.json`)
2. Install Code Coach extension
3. Set their personal API key: `Code Coach: Set AI API Key`
4. Done! They inherit all team settings automatically.

### Changing Team Settings

1. Open project config: `Code Coach: Open Project Config`
2. Edit settings (e.g., change `ai.model`)
3. Commit and push
4. Team members get new settings on `git pull`

### Personal Overrides

Want different settings than your team? Use VS Code settings—they're checked before config files for non-sensitive settings... wait, no. Actually project config wins.

To use personal settings that override project config:
1. Create `~/.code-coach/config.json` with your preferences
2. These only apply when there's no project config

**Note**: Project config always wins over global config. This ensures team consistency.

---

## JSON Schema

For autocomplete and validation in VS Code, the config uses a JSON schema at:

```
extension/schemas/config.schema.json
```

Add to your `.code-coach/config.json`:

```json
{
  "$schema": "../extension/schemas/config.schema.json",
  "version": 1,
  ...
}
```

---

## Privacy Modes Quick Reference

| Mode | Network | What's sent |
|------|---------|-------------|
| `offline` | None | Nothing—static analysis only |
| `local` | localhost | Full context to local LLM (Ollama/LM Studio) |
| `redacted` | Cloud | Code with comments/strings stripped + pattern redaction |
| `full` | Cloud | Full context (use with trusted providers) |

---

## FAQ

**Q: Can my team use different AI providers?**
A: The project config sets the default provider, but each developer needs their own API key set via `Code Coach: Set AI API Key`.

**Q: What if I don't want to use the team's settings?**
A: Project config takes priority. You can't override with personal settings. This is intentional—it ensures team consistency for code explanations.

**Q: How do I see what settings are actually being used?**
A: Run `Code Coach: Show Resolved Config` to see the merged result from all config sources.

**Q: Can I use environment variables in config?**
A: Not currently. API keys should use VS Code Secret Storage, not environment variables.

**Q: What happens if config.json has invalid JSON?**
A: Code Coach shows an error and falls back to VS Code settings. Run `Code Coach: Validate Config` to check for issues.
