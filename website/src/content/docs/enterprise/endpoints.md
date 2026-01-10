---
title: Custom Model Endpoints
description: Configure self-hosted AI models
---

**Custom Model Endpoints** let you use your organization's AI infrastructure instead of public APIs.

## Supported Endpoints

| Type | Description |
|------|-------------|
| Azure OpenAI | Azure-hosted OpenAI models |
| AWS Bedrock | Amazon's managed AI service |
| Google Vertex AI | Google Cloud AI Platform |
| vLLM | High-performance inference server |
| Text Generation Inference | Hugging Face's inference server |
| Ollama | Local model runner |
| OpenAI-compatible | Any OpenAI API-compatible server |
| Anthropic-compatible | Any Anthropic API-compatible server |

## Adding an Endpoint

### Using the Wizard

```bash
Code Coach: Add Custom Model Endpoint
```

1. Select endpoint type
2. Enter configuration details
3. Test connection
4. Save endpoint

### Manual Configuration

Add to `.code-coach/endpoints.json`:

```json
{
  "endpoints": [
    {
      "id": "azure-prod",
      "name": "Azure Production",
      "type": "azure-openai",
      "config": {
        "baseUrl": "https://your-resource.openai.azure.com",
        "deployment": "gpt-4",
        "apiVersion": "2024-02-15-preview"
      },
      "isDefault": true
    }
  ]
}
```

## Endpoint Configuration

### Azure OpenAI

```json
{
  "type": "azure-openai",
  "config": {
    "baseUrl": "https://your-resource.openai.azure.com",
    "deployment": "gpt-4",
    "apiVersion": "2024-02-15-preview"
  },
  "auth": {
    "type": "api-key",
    "headerName": "api-key"
  }
}
```

### AWS Bedrock

```json
{
  "type": "aws-bedrock",
  "config": {
    "region": "us-east-1",
    "model": "anthropic.claude-3-sonnet"
  },
  "auth": {
    "type": "aws-credentials",
    "profile": "default"
  }
}
```

### vLLM

```json
{
  "type": "vllm",
  "config": {
    "baseUrl": "http://localhost:8000",
    "model": "meta-llama/Llama-2-70b-chat-hf"
  },
  "auth": {
    "type": "none"
  }
}
```

### Text Generation Inference

```json
{
  "type": "tgi",
  "config": {
    "baseUrl": "http://localhost:8080",
    "model": "codellama/CodeLlama-34b-Instruct-hf"
  }
}
```

### Ollama

```json
{
  "type": "ollama",
  "config": {
    "baseUrl": "http://localhost:11434",
    "model": "codellama:34b"
  }
}
```

### OpenAI-Compatible

```json
{
  "type": "openai-compatible",
  "config": {
    "baseUrl": "https://your-server.com",
    "model": "your-model-name"
  },
  "auth": {
    "type": "bearer-token"
  }
}
```

## Authentication Methods

| Method | Use For |
|--------|---------|
| `api-key` | Azure OpenAI, custom APIs |
| `bearer-token` | Most REST APIs |
| `aws-credentials` | AWS Bedrock |
| `none` | Local servers (vLLM, Ollama) |

### API Key

```json
{
  "auth": {
    "type": "api-key",
    "headerName": "api-key"
  }
}
```

Key stored in VS Code SecretStorage:
```bash
Code Coach: Set AI API Key
```

### Bearer Token

```json
{
  "auth": {
    "type": "bearer-token"
  }
}
```

### AWS Credentials

```json
{
  "auth": {
    "type": "aws-credentials",
    "profile": "production",
    "region": "us-east-1"
  }
}
```

Uses AWS CLI credentials from `~/.aws/credentials`.

## Managing Endpoints

### List Endpoints

```bash
Code Coach: Manage Custom Endpoints
```

Shows all configured endpoints with status.

### Test Endpoint

```bash
Code Coach: Test Default Endpoint
```

Sends a test request to verify configuration.

### Set Default

In endpoint configuration:

```json
{
  "id": "azure-prod",
  "isDefault": true
}
```

Or via command palette.

### Remove Endpoint

```bash
Code Coach: Manage Custom Endpoints
```

Select endpoint → Remove.

## Health Monitoring

Code Coach monitors endpoint health:

- **Healthy**: Last request succeeded
- **Degraded**: Intermittent failures
- **Unhealthy**: Consecutive failures

Health checked every 5 minutes when endpoint is in use.

## Troubleshooting

### "Connection refused"

Check endpoint is running and accessible:
```bash
curl http://your-endpoint:port/health
```

### "Authentication failed"

Verify API key/credentials:
```bash
Code Coach: Set AI API Key
```

### "Model not found"

Verify model name matches exactly:
- Azure: Use deployment name
- Bedrock: Use full model ID
- vLLM/TGI: Use model path

### "Timeout"

Increase timeout in settings:
```json
{
  "codeCoach.ai.timeout": 60000
}
```

## Related Features

- [SSO Integration](/enterprise/sso/) - Authenticate with IdP
- [AI Providers](/config/ai-providers/) - Public AI options
- [Privacy Modes](/config/privacy/) - Control data flow
