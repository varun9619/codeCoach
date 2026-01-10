---
title: AI Providers
description: Configure AI providers for enhanced explanations
---

Code Coach works with multiple AI providers. Choose based on your needs.

## Supported Providers

| Provider | Best For | Pricing |
|----------|----------|---------|
| **OpenRouter** | Access to many models | Pay per token |
| **OpenAI** | GPT-4, reliable | Pay per token |
| **Anthropic** | Claude, great reasoning | Pay per token |
| **Google Gemini** | Gemini Pro | Free tier available |
| **Ollama** | Local, private | Free (your hardware) |
| **LM Studio** | Local, easy setup | Free (your hardware) |

## Quick Setup

### 1. Enable AI

```json
{
  "codeCoach.ai.enabled": true
}
```

### 2. Set Provider

```json
{
  "codeCoach.ai.provider": "openrouter"
}
```

### 3. Add API Key

```bash
Code Coach: Set AI API Key
```

## Provider Configurations

### OpenRouter (Recommended)

Access to OpenAI, Anthropic, and many other models through one API.

```json
{
  "codeCoach.ai.provider": "openrouter",
  "codeCoach.ai.model": "anthropic/claude-3-sonnet"
}
```

Get key: [openrouter.ai](https://openrouter.ai)

### OpenAI

Direct access to GPT-4 and GPT-3.5.

```json
{
  "codeCoach.ai.provider": "openai",
  "codeCoach.ai.model": "gpt-4-turbo-preview"
}
```

Get key: [platform.openai.com](https://platform.openai.com)

### Anthropic

Direct access to Claude models.

```json
{
  "codeCoach.ai.provider": "anthropic",
  "codeCoach.ai.model": "claude-3-sonnet-20240229"
}
```

Get key: [anthropic.com](https://www.anthropic.com)

### Google Gemini

Access to Gemini Pro with generous free tier.

```json
{
  "codeCoach.ai.provider": "gemini",
  "codeCoach.ai.model": "gemini-pro"
}
```

Get key: [ai.google.dev](https://ai.google.dev)

### Ollama (Local)

Run models locally for complete privacy.

```json
{
  "codeCoach.ai.provider": "ollama",
  "codeCoach.ai.baseUrl": "http://localhost:11434",
  "codeCoach.ai.model": "codellama:34b"
}
```

Install: [ollama.ai](https://ollama.ai)

No API key required for local use.

### LM Studio (Local)

User-friendly local model running.

```json
{
  "codeCoach.ai.provider": "lmstudio",
  "codeCoach.ai.baseUrl": "http://localhost:1234"
}
```

Install: [lmstudio.ai](https://lmstudio.ai)

## Advanced Configuration

### Custom Base URL

Override the default API endpoint:

```json
{
  "codeCoach.ai.baseUrl": "https://your-proxy.com"
}
```

### Custom Endpoint Path

Override the API path:

```json
{
  "codeCoach.ai.endpointPath": "/v1/chat/completions"
}
```

### Temperature

Control response creativity (0 = deterministic, 2 = creative):

```json
{
  "codeCoach.ai.temperature": 0.2
}
```

### Max Tokens

Limit response length:

```json
{
  "codeCoach.ai.maxTokens": 800
}
```

### Custom Headers

Add extra headers to requests:

```json
{
  "codeCoach.ai.extraHeaders": {
    "X-Custom-Header": "value"
  }
}
```

### OpenRouter-Specific

```json
{
  "codeCoach.ai.openrouter.referer": "https://your-site.com",
  "codeCoach.ai.openrouter.title": "Code Coach"
}
```

## Model Recommendations

### For Code Explanation

| Task | Recommended Model |
|------|-------------------|
| General | Claude 3 Sonnet |
| Detailed | GPT-4 Turbo |
| Fast | Claude 3 Haiku |
| Local | CodeLlama 34B |

### For Security Review

- Claude 3 Opus (best reasoning)
- GPT-4 Turbo (good detail)

### For Quick Summaries

- Claude 3 Haiku (fast, cheap)
- GPT-3.5 Turbo (fast, cheap)

## Troubleshooting

### "API key not set"

```bash
Code Coach: Set AI API Key
```

### "Rate limited"

- Wait and retry
- Consider upgrading plan
- Use a different provider

### "Model not found"

Check exact model ID for your provider:
- OpenRouter: `provider/model-name`
- OpenAI: `gpt-4-turbo-preview`
- Anthropic: `claude-3-sonnet-20240229`

## Related Features

- [Privacy Modes](/config/privacy/) - Control what data leaves your machine
- [Custom Endpoints](/enterprise/endpoints/) - Self-hosted AI
- [Response Style](/config/settings/) - Concise vs detailed
