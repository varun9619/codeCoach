/**
 * SSO Integration Types for Code Coach Enterprise
 *
 * Supports OAuth2/OIDC authentication for enterprise identity providers:
 * - Azure AD (Microsoft Entra)
 * - Okta
 * - Auth0
 * - Google Workspace
 * - Custom OIDC providers
 */

/**
 * Supported SSO providers
 */
export type SsoProvider =
  | 'azure-ad'      // Microsoft Entra ID
  | 'okta'          // Okta
  | 'auth0'         // Auth0
  | 'google'        // Google Workspace
  | 'custom-oidc';  // Custom OIDC provider

/**
 * SSO configuration for an identity provider
 */
export interface SsoConfig {
  /** Provider type */
  provider: SsoProvider;

  /** Display name for the provider */
  displayName: string;

  /** OAuth2/OIDC settings */
  oauth: {
    /** Authorization endpoint */
    authorizationUrl: string;
    /** Token endpoint */
    tokenUrl: string;
    /** Client ID (public, can be in config) */
    clientId: string;
    /** Scopes to request */
    scopes: string[];
    /** Redirect URI (usually localhost callback) */
    redirectUri?: string;
  };

  /** Optional: User info endpoint for profile data */
  userInfoUrl?: string;

  /** Optional: Logout endpoint */
  logoutUrl?: string;

  /** Whether this is the default provider */
  isDefault?: boolean;
}

/**
 * SSO session representing an authenticated user
 */
export interface SsoSession {
  /** Unique session ID */
  id: string;

  /** Provider used for authentication */
  provider: SsoProvider;

  /** User information */
  user: SsoUser;

  /** OAuth tokens */
  tokens: SsoTokens;

  /** When the session was created */
  createdAt: string;

  /** When the session expires (based on access token) */
  expiresAt: string;

  /** Whether session is still valid */
  isValid: boolean;
}

/**
 * Authenticated user information
 */
export interface SsoUser {
  /** Unique user ID from provider */
  id: string;

  /** User's email */
  email: string;

  /** User's display name */
  name: string;

  /** Optional: User's organization/tenant */
  organization?: string;

  /** Optional: User's groups/roles */
  groups?: string[];

  /** Optional: User's avatar URL */
  avatarUrl?: string;
}

/**
 * OAuth2 tokens
 */
export interface SsoTokens {
  /** Access token for API calls */
  accessToken: string;

  /** Token type (usually "Bearer") */
  tokenType: string;

  /** When the access token expires */
  expiresAt: string;

  /** Refresh token for getting new access tokens */
  refreshToken?: string;

  /** ID token (for OIDC) */
  idToken?: string;
}

/**
 * SSO authentication state
 */
export type SsoAuthState =
  | { status: 'unauthenticated' }
  | { status: 'authenticating'; provider: SsoProvider }
  | { status: 'authenticated'; session: SsoSession }
  | { status: 'expired'; session: SsoSession }
  | { status: 'error'; error: string };

/**
 * SSO event types for logging/audit
 */
export type SsoEventType =
  | 'login_started'
  | 'login_success'
  | 'login_failed'
  | 'token_refreshed'
  | 'logout'
  | 'session_expired';

/**
 * SSO event for audit logging
 */
export interface SsoEvent {
  type: SsoEventType;
  timestamp: string;
  provider: SsoProvider;
  userId?: string;
  email?: string;
  organization?: string;
  error?: string;
  metadata?: Record<string, string>;
}

/**
 * Provider presets for common identity providers
 */
export const SSO_PROVIDER_PRESETS: Record<Exclude<SsoProvider, 'custom-oidc'>, Partial<SsoConfig>> = {
  'azure-ad': {
    provider: 'azure-ad',
    displayName: 'Microsoft Entra ID',
    oauth: {
      // Tenant ID placeholder - user must configure
      authorizationUrl: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token',
      clientId: '', // User must configure
      scopes: ['openid', 'profile', 'email', 'User.Read']
    },
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me'
  },
  'okta': {
    provider: 'okta',
    displayName: 'Okta',
    oauth: {
      // Domain placeholder - user must configure
      authorizationUrl: 'https://{domain}.okta.com/oauth2/default/v1/authorize',
      tokenUrl: 'https://{domain}.okta.com/oauth2/default/v1/token',
      clientId: '', // User must configure
      scopes: ['openid', 'profile', 'email']
    },
    userInfoUrl: 'https://{domain}.okta.com/oauth2/default/v1/userinfo'
  },
  'auth0': {
    provider: 'auth0',
    displayName: 'Auth0',
    oauth: {
      // Domain placeholder - user must configure
      authorizationUrl: 'https://{domain}.auth0.com/authorize',
      tokenUrl: 'https://{domain}.auth0.com/oauth/token',
      clientId: '', // User must configure
      scopes: ['openid', 'profile', 'email']
    },
    userInfoUrl: 'https://{domain}.auth0.com/userinfo'
  },
  'google': {
    provider: 'google',
    displayName: 'Google Workspace',
    oauth: {
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      clientId: '', // User must configure
      scopes: ['openid', 'profile', 'email']
    },
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo'
  }
};

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `sso-${timestamp}-${random}`;
}

/**
 * Check if a session is expired
 */
export function isSessionExpired(session: SsoSession): boolean {
  const expiresAt = new Date(session.expiresAt);
  // Add 30 second buffer for token refresh
  const bufferMs = 30 * 1000;
  return Date.now() > (expiresAt.getTime() - bufferMs);
}

/**
 * Generate PKCE code verifier and challenge for OAuth2
 */
export function generatePkce(): { verifier: string; challenge: string } {
  // Generate 32 random bytes as code verifier
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = base64UrlEncode(array);

  // For simplicity, use plain challenge method
  // In production, should use S256 (SHA-256 hash)
  const challenge = verifier;

  return { verifier, challenge };
}

/**
 * Base64 URL encode (without padding)
 */
function base64UrlEncode(buffer: Uint8Array): string {
  let str = '';
  for (let i = 0; i < buffer.length; i++) {
    str += String.fromCharCode(buffer[i]);
  }
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate a random state parameter for OAuth2
 */
export function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}
