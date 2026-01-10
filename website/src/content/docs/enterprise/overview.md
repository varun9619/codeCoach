---
title: Enterprise Overview
description: Enterprise features for organizations
---

**Enterprise Features** provide SSO integration and custom model endpoints for organizations with compliance requirements.

## Enterprise Capabilities

| Feature | Description |
|---------|-------------|
| [SSO Integration](/enterprise/sso/) | OAuth2/OIDC with major identity providers |
| [Custom Endpoints](/enterprise/endpoints/) | Self-hosted AI models (Azure OpenAI, Bedrock, vLLM) |
| Audit Logging | Track all AI interactions (coming soon) |
| Role-Based Access | Team permissions (coming soon) |

## Supported Identity Providers

| Provider | Protocol | Status |
|----------|----------|--------|
| Microsoft Entra ID | OIDC | ✅ Supported |
| Okta | OIDC | ✅ Supported |
| Auth0 | OIDC | ✅ Supported |
| Google Workspace | OIDC | ✅ Supported |
| Custom OIDC | OIDC | ✅ Supported |

## Supported Model Endpoints

| Provider | Type | Status |
|----------|------|--------|
| Azure OpenAI | Cloud | ✅ Supported |
| AWS Bedrock | Cloud | ✅ Supported |
| Google Vertex AI | Cloud | ✅ Supported |
| vLLM | Self-hosted | ✅ Supported |
| Text Generation Inference | Self-hosted | ✅ Supported |
| Ollama | Local | ✅ Supported |
| OpenAI-compatible | Any | ✅ Supported |
| Anthropic-compatible | Any | ✅ Supported |

## Quick Start

### 1. Configure SSO

```bash
Code Coach: Enterprise SSO Login
```

Select your provider and authenticate.

### 2. Add Custom Endpoint

```bash
Code Coach: Add Custom Model Endpoint
```

Choose endpoint type and enter configuration.

### 3. Verify Setup

```bash
Code Coach: Enterprise SSO Status
Code Coach: Manage Custom Endpoints
```

## Enterprise Pricing

Contact us for enterprise pricing:

- Unlimited team seats
- SSO integration
- Custom model endpoints
- Dedicated support
- Custom deployment options

**Email**: enterprise@codecoach.dev

## Data Handling

### With SSO

- Authentication tokens stored securely in VS Code
- Tokens refresh automatically
- Logout clears all session data

### With Custom Endpoints

- Code sent only to your configured endpoints
- No data sent to Code Coach servers
- Full audit trail available

## Next Steps

- [SSO Integration Guide](/enterprise/sso/)
- [Custom Endpoint Setup](/enterprise/endpoints/)
- [Configuration Reference](/config/settings/)
