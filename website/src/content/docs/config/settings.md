---
title: Settings Reference
description: Complete list of all Code Coach settings
---

All available settings with their defaults and descriptions.

## AI Configuration

```json
{
  // Enable AI features
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

  // Enable prompt optimizer
  "codeCoach.ai.promptOptimizer": true,

  // Optimizer mode: strict | balanced | compact
  "codeCoach.ai.promptOptimizerMode": "strict",

  // Show optimized prompts in debug output
  "codeCoach.ai.promptDebug": false,

  // Require JSON-only responses
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

## Privacy Configuration

```json
{
  // Privacy mode: offline | local | redacted | full
  "codeCoach.privacy.mode": "offline",

  // Allowed API domains
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

## UI Configuration

```json
{
  // Output surface for each command: output | panel | peek
  "codeCoach.ui.explainSelection": "output",
  "codeCoach.ui.explainWhyWorks": "output",
  "codeCoach.ui.explainDiagnostic": "output",
  "codeCoach.ui.traceDiagnosticOrigin": "output",
  "codeCoach.ui.runtimeException": "output",
  "codeCoach.ui.codeSmells": "output",
  "codeCoach.ui.testGaps": "output",
  "codeCoach.ui.explainDiff": "panel"
}
```

## Deep Dive Configuration

```json
{
  // Visible sections
  "codeCoach.deepDive.sections": [
    "overview",
    "usages",
    "blame",
    "history",
    "tests",
    "coverage",
    "summary"
  ],

  // Include AI summary
  "codeCoach.deepDive.aiSummary": true,

  // Max commits to show in history
  "codeCoach.deepDive.historyLimit": 10
}
```

## Template Configuration

```json
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

## Coach Mode Configuration

```json
{
  // Enable inline hints
  "codeCoach.coachMode.enabled": false,

  // Maximum hints per file
  "codeCoach.coachMode.maxHints": 50
}
```

## Cache Configuration

```json
{
  // Enable explanation caching
  "codeCoach.cache.enabled": true,

  // Share cache with team
  "codeCoach.cache.shareWithTeam": true,

  // Cache TTL in days
  "codeCoach.cache.ttlDays": 7,

  // Maximum cache entries
  "codeCoach.cache.maxEntries": 500
}
```

## Performance Configuration

```json
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

## Test Gaps Configuration

```json
{
  // Paths to search for coverage files
  "codeCoach.testGaps.coveragePaths": [
    "coverage/lcov.info",
    "coverage/coverage-final.json"
  ]
}
```

## Explain Diff Configuration

```json
{
  // Maximum files to analyze
  "codeCoach.explainDiff.maxFiles": 20,

  // Include test files in analysis
  "codeCoach.explainDiff.includeTestFiles": true,

  // Show potential concerns
  "codeCoach.explainDiff.showPotentialConcerns": true
}
```

## Subscriptions Configuration

```json
{
  // Enable change subscriptions
  "codeCoach.subscriptions.enabled": true,

  // Check for changes on git pull
  "codeCoach.subscriptions.checkOnPull": true,

  // Notification style: modal | toast
  "codeCoach.subscriptions.notificationStyle": "toast"
}
```

## Enterprise Configuration

```json
{
  // Allowed AI providers (empty = all allowed)
  "codeCoach.enterprise.allowedAiProviders": [],

  // Path for audit log file
  "codeCoach.enterprise.auditLogPath": ""
}
```

## Runtime Configuration

```json
{
  // Enable debug session exception capture
  "codeCoach.runtime.enabled": false,

  // Auto-explain caught exceptions
  "codeCoach.runtime.autoExplainOnException": false,

  // Max variables to capture per exception
  "codeCoach.runtime.maxVariables": 10
}
```

## Telemetry Configuration

```json
{
  // Enable local-only telemetry
  "codeCoach.telemetry.enabled": false
}
```

## Related

- [AI Providers](/config/ai-providers/) - Provider setup
- [Privacy Modes](/config/privacy/) - Privacy configuration
- [Team Config](/config/team-config/) - Shareable settings
