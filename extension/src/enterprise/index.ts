/**
 * Enterprise Features for Code Coach
 *
 * This module provides enterprise-grade features:
 * - SSO Integration: OAuth2/OIDC authentication
 * - Custom Model Endpoints: Self-hosted AI models
 * - Audit Logging: Compliance and tracking (future)
 * - Role-Based Access: Team permissions (future)
 */

// SSO Integration
export {
  SsoAuthManager,
  getSsoAuthManager
} from './ssoAuth';

export {
  SsoProvider,
  SsoConfig,
  SsoSession,
  SsoUser,
  SsoTokens,
  SsoAuthState,
  SsoEvent,
  SsoEventType,
  SSO_PROVIDER_PRESETS,
  generateSessionId,
  isSessionExpired,
  generatePkce,
  generateState
} from './ssoTypes';

// Custom Model Endpoints
export {
  CustomEndpointManager,
  getCustomEndpointManager
} from './customEndpointManager';

export {
  EndpointType,
  EndpointAuthMethod,
  CustomEndpoint,
  EndpointAuth,
  EndpointHealth,
  EndpointTestResult,
  ENDPOINT_PRESETS,
  generateEndpointId,
  createEndpointFromPreset,
  validateEndpoint,
  buildEndpointUrl
} from './customEndpointTypes';
