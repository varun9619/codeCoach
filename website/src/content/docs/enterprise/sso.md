---
title: SSO Integration
description: Configure single sign-on with your identity provider
---

**SSO Integration** enables authentication through your organization's identity provider.

## Supported Providers

| Provider | Configuration Required |
|----------|----------------------|
| Microsoft Entra ID | Tenant ID, Client ID |
| Okta | Domain, Client ID |
| Auth0 | Domain, Client ID |
| Google Workspace | Client ID |
| Custom OIDC | Issuer URL, Client ID |

## Setup Guide

### Step 1: Register Application

#### Microsoft Entra ID

1. Go to Azure Portal → Entra ID → App registrations
2. Click **New registration**
3. Configure:
   - Name: `Code Coach`
   - Redirect URI: `http://localhost:54321/callback`
   - Supported account types: Your organization
4. Note the **Application (client) ID** and **Directory (tenant) ID**

#### Okta

1. Go to Okta Admin Console → Applications
2. Click **Create App Integration**
3. Select **OIDC - OpenID Connect** and **Web Application**
4. Configure:
   - Name: `Code Coach`
   - Sign-in redirect URIs: `http://localhost:54321/callback`
5. Note the **Client ID**

#### Auth0

1. Go to Auth0 Dashboard → Applications
2. Click **Create Application**
3. Choose **Regular Web Application**
4. Configure:
   - Allowed Callback URLs: `http://localhost:54321/callback`
5. Note the **Domain** and **Client ID**

### Step 2: Configure Code Coach

Run the setup wizard:

```bash
Code Coach: Enterprise SSO Login
```

Enter your provider details when prompted.

Or configure manually in `.code-coach/sso.json`:

```json
{
  "provider": "azure-ad",
  "config": {
    "tenantId": "your-tenant-id",
    "clientId": "your-client-id"
  }
}
```

### Step 3: Login

```bash
Code Coach: Enterprise SSO Login
```

1. Browser opens to your IdP login page
2. Authenticate with your organization credentials
3. Redirected back to VS Code
4. Session established

## Session Management

### Check Status

```bash
Code Coach: Enterprise SSO Status
```

Shows:
- Login state
- User email
- Token expiration
- Refresh status

### Logout

```bash
Code Coach: Enterprise SSO Logout
```

Clears all tokens and session data.

### Token Refresh

Tokens refresh automatically before expiration. No action needed.

## Configuration Reference

### Azure AD

```json
{
  "provider": "azure-ad",
  "config": {
    "tenantId": "your-tenant-id",
    "clientId": "your-client-id",
    "scopes": ["openid", "profile", "email"]
  }
}
```

### Okta

```json
{
  "provider": "okta",
  "config": {
    "domain": "your-org.okta.com",
    "clientId": "your-client-id",
    "scopes": ["openid", "profile", "email"]
  }
}
```

### Auth0

```json
{
  "provider": "auth0",
  "config": {
    "domain": "your-tenant.auth0.com",
    "clientId": "your-client-id",
    "audience": "optional-api-audience"
  }
}
```

### Custom OIDC

```json
{
  "provider": "custom-oidc",
  "config": {
    "issuerUrl": "https://your-idp.com",
    "clientId": "your-client-id",
    "authorizationEndpoint": "https://your-idp.com/authorize",
    "tokenEndpoint": "https://your-idp.com/token",
    "userInfoEndpoint": "https://your-idp.com/userinfo"
  }
}
```

## Security

### PKCE

All OAuth flows use PKCE (Proof Key for Code Exchange) for security.

### Token Storage

- Access tokens stored in VS Code SecretStorage
- Refresh tokens stored securely
- Tokens cleared on logout

### Callback Server

- Local server on port 54321
- Only accepts localhost connections
- Server closes after callback received

## Troubleshooting

### "Invalid redirect URI"

Ensure your IdP's redirect URI exactly matches:
```
http://localhost:54321/callback
```

### "Token expired"

Run login again:
```bash
Code Coach: Enterprise SSO Login
```

### "Network error"

Check firewall allows:
- Outbound to your IdP
- Localhost port 54321

## Related Features

- [Custom Endpoints](/enterprise/endpoints/) - Use SSO with custom AI
- [Privacy Modes](/config/privacy/) - Control data flow
