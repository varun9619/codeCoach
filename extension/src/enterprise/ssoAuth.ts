/**
 * SSO Authentication Manager for Code Coach Enterprise
 *
 * Handles OAuth2/OIDC authentication flow using VS Code's authentication API
 * and a localhost callback server for token exchange.
 */

import * as vscode from 'vscode';
import * as http from 'http';
import * as url from 'url';
import {
  SsoConfig,
  SsoSession,
  SsoTokens,
  SsoUser,
  SsoProvider,
  SsoAuthState,
  SsoEvent,
  SSO_PROVIDER_PRESETS,
  generateSessionId,
  generateState,
  generatePkce,
  isSessionExpired
} from './ssoTypes';
import { trackEvent } from '../telemetry';

const CALLBACK_PORT = 54321;
const CALLBACK_PATH = '/callback';
const SESSION_STORAGE_KEY = 'codeCoach.enterprise.ssoSession';
const CONFIG_STORAGE_KEY = 'codeCoach.enterprise.ssoConfig';

/**
 * Singleton SSO Authentication Manager
 */
export class SsoAuthManager {
  private static instance: SsoAuthManager | undefined;

  private context: vscode.ExtensionContext | undefined;
  private currentSession: SsoSession | undefined;
  private authState: SsoAuthState = { status: 'unauthenticated' };
  private callbackServer: http.Server | undefined;
  private pendingAuth: {
    state: string;
    verifier: string;
    config: SsoConfig;
    resolve: (tokens: SsoTokens) => void;
    reject: (error: Error) => void;
  } | undefined;

  private onAuthStateChangedEmitter = new vscode.EventEmitter<SsoAuthState>();
  public readonly onAuthStateChanged = this.onAuthStateChangedEmitter.event;

  private onSsoEventEmitter = new vscode.EventEmitter<SsoEvent>();
  public readonly onSsoEvent = this.onSsoEventEmitter.event;

  private constructor() {}

  public static getInstance(): SsoAuthManager {
    if (!SsoAuthManager.instance) {
      SsoAuthManager.instance = new SsoAuthManager();
    }
    return SsoAuthManager.instance;
  }

  /**
   * Initialize the SSO manager with extension context
   */
  public async initialize(context: vscode.ExtensionContext): Promise<void> {
    this.context = context;

    // Try to restore session from secure storage
    await this.restoreSession();
  }

  /**
   * Get current authentication state
   */
  public getAuthState(): SsoAuthState {
    return this.authState;
  }

  /**
   * Get current session (if authenticated)
   */
  public getSession(): SsoSession | undefined {
    return this.currentSession;
  }

  /**
   * Check if user is authenticated with valid session
   */
  public isAuthenticated(): boolean {
    return (
      this.authState.status === 'authenticated' &&
      this.currentSession !== undefined &&
      !isSessionExpired(this.currentSession)
    );
  }

  /**
   * Get access token for API calls (refreshes if needed)
   */
  public async getAccessToken(): Promise<string | undefined> {
    if (!this.currentSession) {
      return undefined;
    }

    // Check if token needs refresh
    if (isSessionExpired(this.currentSession)) {
      const config = await this.getStoredConfig();
      if (config && this.currentSession.tokens.refreshToken) {
        try {
          await this.refreshTokens(config);
        } catch {
          this.setAuthState({ status: 'expired', session: this.currentSession });
          return undefined;
        }
      } else {
        this.setAuthState({ status: 'expired', session: this.currentSession });
        return undefined;
      }
    }

    return this.currentSession.tokens.accessToken;
  }

  /**
   * Start SSO login flow
   */
  public async login(config: SsoConfig): Promise<SsoSession> {
    this.setAuthState({ status: 'authenticating', provider: config.provider });
    this.emitEvent('login_started', config.provider);

    try {
      // Store config for later use
      await this.storeConfig(config);

      // Generate PKCE and state
      const { verifier, challenge } = generatePkce();
      const state = generateState();

      // Build authorization URL
      const redirectUri = config.oauth.redirectUri || `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`;
      const authUrl = this.buildAuthorizationUrl(config, state, challenge, redirectUri);

      // Start callback server
      const tokens = await this.startAuthFlow(config, state, verifier, authUrl, redirectUri);

      // Fetch user info
      const user = await this.fetchUserInfo(config, tokens.accessToken);

      // Create session
      const session: SsoSession = {
        id: generateSessionId(),
        provider: config.provider,
        user,
        tokens,
        createdAt: new Date().toISOString(),
        expiresAt: tokens.expiresAt,
        isValid: true
      };

      // Store and set session
      await this.storeSession(session);
      this.currentSession = session;
      this.setAuthState({ status: 'authenticated', session });
      this.emitEvent('login_success', config.provider, user);

      trackEvent('sso.login', {
        provider: config.provider,
        organization: user.organization
      });

      return session;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.setAuthState({ status: 'error', error: errorMessage });
      this.emitEvent('login_failed', config.provider, undefined, errorMessage);

      trackEvent('sso.loginFailed', {
        provider: config.provider,
        error: errorMessage
      });

      throw error;
    }
  }

  /**
   * Login with a preset provider (requires additional configuration)
   */
  public async loginWithProvider(
    provider: Exclude<SsoProvider, 'custom-oidc'>,
    overrides: {
      clientId: string;
      tenant?: string; // For Azure AD
      domain?: string; // For Okta/Auth0
    }
  ): Promise<SsoSession> {
    const preset = SSO_PROVIDER_PRESETS[provider];
    if (!preset.oauth) {
      throw new Error(`Invalid preset for provider: ${provider}`);
    }

    // Apply overrides to URLs
    let authUrl = preset.oauth.authorizationUrl;
    let tokenUrl = preset.oauth.tokenUrl;
    let userInfoUrl = preset.userInfoUrl;

    if (overrides.tenant) {
      authUrl = authUrl.replace('{tenant}', overrides.tenant);
      tokenUrl = tokenUrl.replace('{tenant}', overrides.tenant);
    }

    if (overrides.domain) {
      authUrl = authUrl.replace('{domain}', overrides.domain);
      tokenUrl = tokenUrl.replace('{domain}', overrides.domain);
      if (userInfoUrl) {
        userInfoUrl = userInfoUrl.replace('{domain}', overrides.domain);
      }
    }

    const config: SsoConfig = {
      provider,
      displayName: preset.displayName!,
      oauth: {
        authorizationUrl: authUrl,
        tokenUrl: tokenUrl,
        clientId: overrides.clientId,
        scopes: preset.oauth.scopes
      },
      userInfoUrl
    };

    return this.login(config);
  }

  /**
   * Logout and clear session
   */
  public async logout(): Promise<void> {
    const provider = this.currentSession?.provider;
    const user = this.currentSession?.user;

    // Clear stored session
    await this.clearSession();

    this.currentSession = undefined;
    this.setAuthState({ status: 'unauthenticated' });

    if (provider) {
      this.emitEvent('logout', provider, user);
      trackEvent('sso.logout', { provider });
    }

    vscode.window.showInformationMessage('Signed out from Code Coach Enterprise.');
  }

  /**
   * Show SSO configuration wizard
   */
  public async showConfigWizard(): Promise<SsoConfig | undefined> {
    // Step 1: Choose provider
    const providerChoice = await vscode.window.showQuickPick(
      [
        { label: 'Microsoft Entra ID', description: 'Azure Active Directory', value: 'azure-ad' as SsoProvider },
        { label: 'Okta', description: 'Okta Identity Cloud', value: 'okta' as SsoProvider },
        { label: 'Auth0', description: 'Auth0 by Okta', value: 'auth0' as SsoProvider },
        { label: 'Google Workspace', description: 'Google Cloud Identity', value: 'google' as SsoProvider },
        { label: 'Custom OIDC', description: 'Custom OpenID Connect provider', value: 'custom-oidc' as SsoProvider }
      ],
      { title: 'Select SSO Provider', placeHolder: 'Choose your identity provider' }
    );

    if (!providerChoice) {
      return undefined;
    }

    const provider = providerChoice.value;

    // Step 2: Get client ID
    const clientId = await vscode.window.showInputBox({
      title: 'Client ID',
      prompt: 'Enter the OAuth2 Client ID from your identity provider',
      placeHolder: 'e.g., 12345678-abcd-efgh-ijkl-mnopqrstuvwx',
      validateInput: (value) => value.trim() ? null : 'Client ID is required'
    });

    if (!clientId) {
      return undefined;
    }

    // Step 3: Provider-specific configuration
    if (provider === 'azure-ad') {
      const tenant = await vscode.window.showInputBox({
        title: 'Tenant ID',
        prompt: 'Enter your Azure AD Tenant ID',
        placeHolder: 'e.g., your-tenant-id or common',
        validateInput: (value) => value.trim() ? null : 'Tenant ID is required'
      });

      if (!tenant) {
        return undefined;
      }

      const preset = SSO_PROVIDER_PRESETS['azure-ad'];
      return {
        provider: 'azure-ad',
        displayName: 'Microsoft Entra ID',
        oauth: {
          authorizationUrl: preset.oauth!.authorizationUrl.replace('{tenant}', tenant),
          tokenUrl: preset.oauth!.tokenUrl.replace('{tenant}', tenant),
          clientId: clientId.trim(),
          scopes: preset.oauth!.scopes
        },
        userInfoUrl: preset.userInfoUrl
      };
    }

    if (provider === 'okta' || provider === 'auth0') {
      const domain = await vscode.window.showInputBox({
        title: 'Domain',
        prompt: `Enter your ${providerChoice.label} domain`,
        placeHolder: provider === 'okta' ? 'e.g., your-company' : 'e.g., your-tenant',
        validateInput: (value) => value.trim() ? null : 'Domain is required'
      });

      if (!domain) {
        return undefined;
      }

      const preset = SSO_PROVIDER_PRESETS[provider];
      return {
        provider,
        displayName: preset.displayName!,
        oauth: {
          authorizationUrl: preset.oauth!.authorizationUrl.replace('{domain}', domain),
          tokenUrl: preset.oauth!.tokenUrl.replace('{domain}', domain),
          clientId: clientId.trim(),
          scopes: preset.oauth!.scopes
        },
        userInfoUrl: preset.userInfoUrl?.replace('{domain}', domain)
      };
    }

    if (provider === 'google') {
      const preset = SSO_PROVIDER_PRESETS['google'];
      return {
        provider: 'google',
        displayName: 'Google Workspace',
        oauth: {
          authorizationUrl: preset.oauth!.authorizationUrl,
          tokenUrl: preset.oauth!.tokenUrl,
          clientId: clientId.trim(),
          scopes: preset.oauth!.scopes
        },
        userInfoUrl: preset.userInfoUrl
      };
    }

    // Custom OIDC
    const authUrl = await vscode.window.showInputBox({
      title: 'Authorization URL',
      prompt: 'Enter the OAuth2 authorization endpoint',
      placeHolder: 'e.g., https://your-provider.com/oauth2/authorize',
      validateInput: (value) => {
        if (!value.trim()) return 'Authorization URL is required';
        try {
          new URL(value);
          return null;
        } catch {
          return 'Invalid URL format';
        }
      }
    });

    if (!authUrl) {
      return undefined;
    }

    const tokenUrl = await vscode.window.showInputBox({
      title: 'Token URL',
      prompt: 'Enter the OAuth2 token endpoint',
      placeHolder: 'e.g., https://your-provider.com/oauth2/token',
      validateInput: (value) => {
        if (!value.trim()) return 'Token URL is required';
        try {
          new URL(value);
          return null;
        } catch {
          return 'Invalid URL format';
        }
      }
    });

    if (!tokenUrl) {
      return undefined;
    }

    const userInfoUrl = await vscode.window.showInputBox({
      title: 'User Info URL (optional)',
      prompt: 'Enter the user info endpoint (leave empty to skip)',
      placeHolder: 'e.g., https://your-provider.com/oauth2/userinfo'
    });

    return {
      provider: 'custom-oidc',
      displayName: 'Custom OIDC Provider',
      oauth: {
        authorizationUrl: authUrl.trim(),
        tokenUrl: tokenUrl.trim(),
        clientId: clientId.trim(),
        scopes: ['openid', 'profile', 'email']
      },
      userInfoUrl: userInfoUrl?.trim() || undefined
    };
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.stopCallbackServer();
    this.onAuthStateChangedEmitter.dispose();
    this.onSsoEventEmitter.dispose();
  }

  // Private methods

  private setAuthState(state: SsoAuthState): void {
    this.authState = state;
    this.onAuthStateChangedEmitter.fire(state);
  }

  private emitEvent(
    type: SsoEvent['type'],
    provider: SsoProvider,
    user?: SsoUser,
    error?: string
  ): void {
    const event: SsoEvent = {
      type,
      timestamp: new Date().toISOString(),
      provider,
      userId: user?.id,
      email: user?.email,
      organization: user?.organization,
      error
    };
    this.onSsoEventEmitter.fire(event);
  }

  private buildAuthorizationUrl(
    config: SsoConfig,
    state: string,
    codeChallenge: string,
    redirectUri: string
  ): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.oauth.clientId,
      redirect_uri: redirectUri,
      scope: config.oauth.scopes.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'plain' // Use 'S256' for production
    });

    return `${config.oauth.authorizationUrl}?${params.toString()}`;
  }

  private async startAuthFlow(
    config: SsoConfig,
    state: string,
    verifier: string,
    authUrl: string,
    redirectUri: string
  ): Promise<SsoTokens> {
    return new Promise((resolve, reject) => {
      // Store pending auth info
      this.pendingAuth = { state, verifier, config, resolve, reject };

      // Start callback server
      this.startCallbackServer(redirectUri);

      // Open browser for authentication
      vscode.env.openExternal(vscode.Uri.parse(authUrl));

      // Set timeout (5 minutes)
      setTimeout(() => {
        if (this.pendingAuth) {
          this.pendingAuth.reject(new Error('Authentication timed out'));
          this.pendingAuth = undefined;
          this.stopCallbackServer();
        }
      }, 5 * 60 * 1000);
    });
  }

  private startCallbackServer(redirectUri: string): void {
    this.stopCallbackServer();

    this.callbackServer = http.createServer(async (req, res) => {
      const parsedUrl = url.parse(req.url || '', true);

      if (parsedUrl.pathname === CALLBACK_PATH) {
        const code = parsedUrl.query.code as string;
        const state = parsedUrl.query.state as string;
        const error = parsedUrl.query.error as string;

        if (error) {
          this.handleAuthError(res, error);
          return;
        }

        if (!code || !state) {
          this.handleAuthError(res, 'Missing code or state');
          return;
        }

        if (!this.pendingAuth || state !== this.pendingAuth.state) {
          this.handleAuthError(res, 'Invalid state parameter');
          return;
        }

        try {
          const tokens = await this.exchangeCodeForTokens(
            this.pendingAuth.config,
            code,
            this.pendingAuth.verifier,
            redirectUri
          );

          // Success response
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <!DOCTYPE html>
            <html>
              <head><title>Code Coach - SSO Success</title></head>
              <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1e1e1e; color: #fff;">
                <div style="text-align: center;">
                  <h1>Authentication Successful</h1>
                  <p>You can close this window and return to VS Code.</p>
                </div>
              </body>
            </html>
          `);

          this.pendingAuth.resolve(tokens);
          this.pendingAuth = undefined;
          this.stopCallbackServer();
        } catch (err) {
          this.handleAuthError(res, err instanceof Error ? err.message : 'Token exchange failed');
        }
      }
    });

    this.callbackServer.listen(CALLBACK_PORT);
  }

  private handleAuthError(res: http.ServerResponse, error: string): void {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head><title>Code Coach - SSO Error</title></head>
        <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1e1e1e; color: #ff6b6b;">
          <div style="text-align: center;">
            <h1>Authentication Failed</h1>
            <p>${error}</p>
            <p>You can close this window and try again.</p>
          </div>
        </body>
      </html>
    `);

    if (this.pendingAuth) {
      this.pendingAuth.reject(new Error(error));
      this.pendingAuth = undefined;
    }
    this.stopCallbackServer();
  }

  private stopCallbackServer(): void {
    if (this.callbackServer) {
      this.callbackServer.close();
      this.callbackServer = undefined;
    }
  }

  private async exchangeCodeForTokens(
    config: SsoConfig,
    code: string,
    verifier: string,
    redirectUri: string
  ): Promise<SsoTokens> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.oauth.clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier
    });

    const response = await fetch(config.oauth.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const data = await response.json() as {
      access_token: string;
      token_type: string;
      expires_in: number;
      refresh_token?: string;
      id_token?: string;
    };

    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

    return {
      accessToken: data.access_token,
      tokenType: data.token_type || 'Bearer',
      expiresAt,
      refreshToken: data.refresh_token,
      idToken: data.id_token
    };
  }

  private async refreshTokens(config: SsoConfig): Promise<void> {
    if (!this.currentSession?.tokens.refreshToken) {
      throw new Error('No refresh token available');
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.oauth.clientId,
      refresh_token: this.currentSession.tokens.refreshToken
    });

    const response = await fetch(config.oauth.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json() as {
      access_token: string;
      token_type: string;
      expires_in: number;
      refresh_token?: string;
    };

    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

    this.currentSession.tokens = {
      ...this.currentSession.tokens,
      accessToken: data.access_token,
      tokenType: data.token_type || 'Bearer',
      expiresAt,
      refreshToken: data.refresh_token || this.currentSession.tokens.refreshToken
    };
    this.currentSession.expiresAt = expiresAt;

    await this.storeSession(this.currentSession);
    this.emitEvent('token_refreshed', config.provider, this.currentSession.user);
  }

  private async fetchUserInfo(config: SsoConfig, accessToken: string): Promise<SsoUser> {
    if (!config.userInfoUrl) {
      // Extract basic info from ID token if available
      return {
        id: 'unknown',
        email: 'unknown@example.com',
        name: 'Unknown User'
      };
    }

    const response = await fetch(config.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    const data = await response.json() as Record<string, unknown>;

    // Map common OIDC claims to our user model
    return {
      id: String(data.sub || data.id || 'unknown'),
      email: String(data.email || 'unknown@example.com'),
      name: String(data.name || data.preferred_username || data.email || 'Unknown User'),
      organization: data.hd || data.tenant_id || data.org_id
        ? String(data.hd || data.tenant_id || data.org_id)
        : undefined,
      groups: Array.isArray(data.groups) ? data.groups.map(String) : undefined,
      avatarUrl: typeof data.picture === 'string' ? data.picture : undefined
    };
  }

  private async storeSession(session: SsoSession): Promise<void> {
    if (!this.context) return;
    await this.context.secrets.store(SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  private async restoreSession(): Promise<void> {
    if (!this.context) return;

    try {
      const stored = await this.context.secrets.get(SESSION_STORAGE_KEY);
      if (stored) {
        const session = JSON.parse(stored) as SsoSession;
        if (!isSessionExpired(session)) {
          this.currentSession = session;
          this.setAuthState({ status: 'authenticated', session });
        } else if (session.tokens.refreshToken) {
          this.currentSession = session;
          this.setAuthState({ status: 'expired', session });
        }
      }
    } catch {
      // Ignore restore errors
    }
  }

  private async clearSession(): Promise<void> {
    if (!this.context) return;
    await this.context.secrets.delete(SESSION_STORAGE_KEY);
  }

  private async storeConfig(config: SsoConfig): Promise<void> {
    if (!this.context) return;
    // Store config without sensitive data
    const safeConfig = {
      ...config,
      oauth: {
        ...config.oauth,
        // Don't store client ID in plain storage - it's in the config file
      }
    };
    await this.context.globalState.update(CONFIG_STORAGE_KEY, safeConfig);
  }

  private async getStoredConfig(): Promise<SsoConfig | undefined> {
    if (!this.context) return undefined;
    return this.context.globalState.get<SsoConfig>(CONFIG_STORAGE_KEY);
  }
}

/**
 * Get the SSO auth manager singleton
 */
export function getSsoAuthManager(): SsoAuthManager {
  return SsoAuthManager.getInstance();
}
