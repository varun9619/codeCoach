---
title: Privacy Modes
description: Control what data leaves your machine
---

Code Coach is privacy-first. You control exactly what data leaves your machine.

## Privacy Modes

| Mode | Network Requests | Best For |
|------|------------------|----------|
| `offline` | None | Classified code, air-gapped systems |
| `local` | Localhost only | Privacy-conscious with local AI |
| `redacted` | Yes, with secrets stripped | Normal use with sensitive code |
| `full` | Yes, code as-is | Public/non-sensitive code |

## Configuration

```json
{
  "codeCoach.privacy.mode": "offline"
}
```

## Mode Details

### Offline Mode

**No network requests at all.**

- All features work via static analysis
- AI features disabled
- Maximum privacy

```json
{
  "codeCoach.privacy.mode": "offline"
}
```

### Local Mode

**Only localhost connections.**

Use with Ollama or LM Studio for local AI:

```json
{
  "codeCoach.privacy.mode": "local",
  "codeCoach.ai.provider": "ollama",
  "codeCoach.ai.baseUrl": "http://localhost:11434"
}
```

### Redacted Mode

**Network allowed, but secrets stripped.**

Before sending code to AI:
- API keys removed
- Passwords stripped
- Custom patterns redacted

```json
{
  "codeCoach.privacy.mode": "redacted",
  "codeCoach.privacy.redactPatterns": [
    "API_KEY=.*",
    "SECRET=.*",
    "PASSWORD=.*",
    "Bearer .*"
  ]
}
```

### Full Mode

**Code sent as-is.**

For public or non-sensitive code:

```json
{
  "codeCoach.privacy.mode": "full"
}
```

## Allowed Domains

Restrict which domains can receive data:

```json
{
  "codeCoach.privacy.allowedDomains": [
    "api.openai.com",
    "api.anthropic.com",
    "openrouter.ai"
  ]
}
```

## Redaction Patterns

Custom regex patterns to strip:

```json
{
  "codeCoach.privacy.redactPatterns": [
    "API_KEY=.*",
    "SECRET=.*",
    "PASSWORD=.*",
    "Bearer [A-Za-z0-9-_]+",
    "sk-[A-Za-z0-9]+",
    "ghp_[A-Za-z0-9]+",
    "PRIVATE_KEY=.*"
  ]
}
```

Example:

```javascript
// Before redaction
const API_KEY = "sk-1234567890abcdef";
const DATABASE_URL = "postgres://user:password@host/db";

// After redaction
const API_KEY = "[REDACTED]";
const DATABASE_URL = "postgres://user:[REDACTED]@host/db";
```

## Context Limits

Limit how much code is sent:

```json
{
  "codeCoach.privacy.maxContextChars": 4000
}
```

Larger selections are truncated.

## Feature Availability by Mode

| Feature | Offline | Local | Redacted | Full |
|---------|---------|-------|----------|------|
| Explain Selection (static) | ✅ | ✅ | ✅ | ✅ |
| Deep Dive | ✅ | ✅ | ✅ | ✅ |
| Code Smells | ✅ | ✅ | ✅ | ✅ |
| Test Gaps | ✅ | ✅ | ✅ | ✅ |
| AI Explanations | ❌ | ✅ | ✅ | ✅ |
| Shared Cache | ❌ | ❌ | ✅ | ✅ |

## Audit Trail

When `auditLogPath` is set, all AI requests are logged:

```json
{
  "codeCoach.enterprise.auditLogPath": "./ai-audit.log"
}
```

Log entry:
```json
{
  "timestamp": "2025-01-05T10:30:00Z",
  "user": "alice@company.com",
  "action": "explain-selection",
  "provider": "openai",
  "model": "gpt-4",
  "inputChars": 1500,
  "redactedPatterns": 2
}
```

## Best Practices

### For Enterprise

1. Start with `redacted` mode
2. Add company-specific patterns
3. Limit allowed domains
4. Enable audit logging

### For Personal Use

1. Use `local` with Ollama for privacy
2. Or `redacted` for cloud AI with safety

### For Public Code

1. `full` mode is fine
2. Faster (no redaction overhead)

## Related Features

- [AI Providers](/config/ai-providers/) - Choose your AI
- [Custom Endpoints](/enterprise/endpoints/) - Self-hosted AI
- [Settings Reference](/config/settings/) - All options
