---
title: Team Configuration
description: Share Code Coach settings across your team
---

Code Coach supports team-shareable configuration through `.code-coach/` files.

## Configuration Hierarchy

Settings are merged in order (later wins):

1. **Built-in defaults**
2. **Global VS Code settings** (`settings.json`)
3. **Workspace settings** (`.vscode/settings.json`)
4. **Team config** (`.code-coach/config.json`)

## Team Config File

Create `.code-coach/config.json` in your project root:

```json
{
  "version": 1,
  "ai": {
    "provider": "openrouter",
    "model": "anthropic/claude-3-sonnet",
    "responseStyle": "concise"
  },
  "privacy": {
    "mode": "redacted",
    "redactPatterns": [
      "COMPANY_SECRET=.*",
      "INTERNAL_API=.*"
    ]
  },
  "templates": {
    "default": "junior-dev",
    "showPicker": true
  },
  "deepDive": {
    "sections": ["overview", "usages", "blame", "tests"],
    "historyLimit": 10
  }
}
```

## File Structure

```
.code-coach/
├── config.json           # Team settings
├── pins.json             # Team-pinned symbols
├── templates/            # Custom templates
│   ├── api-review.json
│   └── security.json
├── tours/                # Onboarding tours
│   ├── auth-overview.json
│   └── database-arch.json
├── endpoints.json        # Custom AI endpoints
└── cache/
    └── explanations.json # Shared explanation cache
```

## Git Strategy

### Commit team configuration:

```bash
# Add team-shareable files
git add .code-coach/config.json
git add .code-coach/pins.json
git add .code-coach/templates/
git add .code-coach/tours/
git add .code-coach/endpoints.json

git commit -m "Add Code Coach team configuration"
```

### Gitignore personal files:

`.gitignore`:
```
# Personal Code Coach data
.code-coach/subscriptions.json
.code-coach/tour-progress.json
.code-coach/cache/
```

## Configuration Reference

### AI Settings

```json
{
  "ai": {
    "enabled": true,
    "provider": "openrouter",
    "model": "anthropic/claude-3-sonnet",
    "temperature": 0.2,
    "maxTokens": 800,
    "responseStyle": "concise",
    "promptOptimizer": true,
    "promptOptimizerMode": "strict"
  }
}
```

### Privacy Settings

```json
{
  "privacy": {
    "mode": "redacted",
    "allowedDomains": ["api.openai.com", "openrouter.ai"],
    "redactPatterns": ["API_KEY=.*", "SECRET=.*"],
    "maxContextChars": 4000
  }
}
```

### UI Settings

```json
{
  "ui": {
    "explainSelection": "output",
    "explainDiagnostic": "panel",
    "deepDive": "sidebar"
  }
}
```

### Deep Dive Settings

```json
{
  "deepDive": {
    "sections": ["overview", "usages", "blame", "history", "tests"],
    "aiSummary": true,
    "historyLimit": 10
  }
}
```

### Template Settings

```json
{
  "templates": {
    "default": "general",
    "showPicker": true,
    "customTemplatesPath": ".code-coach/templates/"
  }
}
```

### Cache Settings

```json
{
  "cache": {
    "enabled": true,
    "shareWithTeam": true,
    "ttlDays": 7,
    "maxEntries": 500
  }
}
```

## Commands

### Create Config

```bash
Code Coach: Create Config
```

Creates `.code-coach/config.json` with defaults.

### Validate Config

```bash
Code Coach: Validate Config
```

Checks config for errors and warnings.

### Show Resolved Config

```bash
Code Coach: Show Resolved Config
```

Shows final merged configuration from all sources.

## Schema Validation

For IDE support, reference the schema:

```json
{
  "$schema": "https://codecoach.dev/schemas/config.schema.json",
  "version": 1,
  ...
}
```

## Related Features

- [Privacy Modes](/config/privacy/) - Team privacy settings
- [Templates](/team/templates/) - Team explanation templates
- [Settings Reference](/config/settings/) - All options
