/**
 * Custom Model Endpoint Types for Code Coach Enterprise
 *
 * Supports self-hosted and enterprise AI model deployments:
 * - Azure OpenAI Service
 * - AWS Bedrock
 * - Google Vertex AI
 * - vLLM
 * - Text Generation Inference (TGI)
 * - Ollama (local)
 * - Custom OpenAI-compatible endpoints
 */

/**
 * Supported custom endpoint types
 */
export type EndpointType =
  | 'azure-openai'     // Azure OpenAI Service
  | 'aws-bedrock'      // AWS Bedrock
  | 'vertex-ai'        // Google Vertex AI
  | 'vllm'             // vLLM server
  | 'tgi'              // Text Generation Inference
  | 'ollama'           // Ollama local
  | 'openai-compatible' // Generic OpenAI-compatible API
  | 'anthropic-compatible'; // Generic Anthropic-compatible API

/**
 * Authentication method for the endpoint
 */
export type EndpointAuthMethod =
  | 'none'           // No authentication (local endpoints)
  | 'api-key'        // API key in header
  | 'bearer-token'   // Bearer token authentication
  | 'azure-ad'       // Azure AD token
  | 'aws-sigv4'      // AWS Signature V4
  | 'gcp-token'      // GCP access token
  | 'sso-token';     // Use SSO session token

/**
 * Custom model endpoint configuration
 */
export interface CustomEndpoint {
  /** Unique identifier for the endpoint */
  id: string;

  /** Display name */
  name: string;

  /** Endpoint type */
  type: EndpointType;

  /** Description */
  description?: string;

  /** Base URL for the API */
  baseUrl: string;

  /** API endpoint path (e.g., /v1/chat/completions) */
  endpointPath: string;

  /** Default model to use */
  defaultModel: string;

  /** Available models at this endpoint */
  availableModels?: string[];

  /** Authentication configuration */
  auth: EndpointAuth;

  /** Additional headers to send with requests */
  extraHeaders?: Record<string, string>;

  /** Whether this endpoint is enabled */
  enabled: boolean;

  /** Whether this is the default endpoint for its type */
  isDefault?: boolean;

  /** Health check configuration */
  healthCheck?: {
    /** URL to ping for health check */
    url?: string;
    /** Expected status code */
    expectedStatus?: number;
    /** Timeout in milliseconds */
    timeoutMs?: number;
  };

  /** Request body format customization */
  requestFormat?: {
    /** Field name for model */
    modelField?: string;
    /** Field name for messages */
    messagesField?: string;
    /** Field name for max tokens */
    maxTokensField?: string;
    /** Field name for temperature */
    temperatureField?: string;
    /** Additional fields to include */
    extraFields?: Record<string, unknown>;
  };

  /** Response parsing configuration */
  responseFormat?: {
    /** Path to content in response */
    contentPath?: string;
    /** Path to usage info */
    usagePath?: string;
  };

  /** Created timestamp */
  createdAt: string;

  /** Last modified timestamp */
  updatedAt: string;
}

/**
 * Authentication configuration for an endpoint
 */
export interface EndpointAuth {
  /** Authentication method */
  method: EndpointAuthMethod;

  /** Header name for the auth token (default: Authorization) */
  headerName?: string;

  /** Prefix for the token (e.g., "Bearer", "Api-Key") */
  tokenPrefix?: string;

  /** For Azure: resource URL */
  azureResource?: string;

  /** For AWS: region */
  awsRegion?: string;

  /** For AWS: service name */
  awsService?: string;
}

/**
 * Endpoint health status
 */
export interface EndpointHealth {
  endpointId: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastChecked: string;
  latencyMs?: number;
  error?: string;
  modelCount?: number;
}

/**
 * Endpoint test result
 */
export interface EndpointTestResult {
  success: boolean;
  latencyMs: number;
  error?: string;
  response?: {
    model: string;
    content: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
    };
  };
}

/**
 * Preset configurations for common enterprise providers
 */
export const ENDPOINT_PRESETS: Record<EndpointType, Partial<CustomEndpoint>> = {
  'azure-openai': {
    type: 'azure-openai',
    name: 'Azure OpenAI',
    description: 'Azure OpenAI Service with your deployment',
    endpointPath: '/openai/deployments/{deployment}/chat/completions?api-version=2024-02-15-preview',
    auth: {
      method: 'api-key',
      headerName: 'api-key',
      tokenPrefix: ''
    },
    requestFormat: {
      modelField: undefined, // Model is in the URL path for Azure
      messagesField: 'messages',
      maxTokensField: 'max_tokens',
      temperatureField: 'temperature'
    },
    responseFormat: {
      contentPath: 'choices.0.message.content',
      usagePath: 'usage'
    }
  },
  'aws-bedrock': {
    type: 'aws-bedrock',
    name: 'AWS Bedrock',
    description: 'Amazon Bedrock with Claude or other models',
    baseUrl: 'https://bedrock-runtime.{region}.amazonaws.com',
    endpointPath: '/model/{model}/invoke',
    auth: {
      method: 'aws-sigv4',
      awsService: 'bedrock'
    }
  },
  'vertex-ai': {
    type: 'vertex-ai',
    name: 'Google Vertex AI',
    description: 'Google Cloud Vertex AI with Gemini or Claude',
    baseUrl: 'https://{location}-aiplatform.googleapis.com',
    endpointPath: '/v1/projects/{project}/locations/{location}/publishers/{publisher}/models/{model}:predict',
    auth: {
      method: 'gcp-token'
    }
  },
  'vllm': {
    type: 'vllm',
    name: 'vLLM Server',
    description: 'Self-hosted vLLM inference server',
    baseUrl: 'http://localhost:8000',
    endpointPath: '/v1/chat/completions',
    defaultModel: 'default',
    auth: {
      method: 'none'
    },
    requestFormat: {
      modelField: 'model',
      messagesField: 'messages',
      maxTokensField: 'max_tokens',
      temperatureField: 'temperature'
    },
    responseFormat: {
      contentPath: 'choices.0.message.content',
      usagePath: 'usage'
    }
  },
  'tgi': {
    type: 'tgi',
    name: 'Text Generation Inference',
    description: 'Hugging Face TGI server',
    baseUrl: 'http://localhost:8080',
    endpointPath: '/v1/chat/completions',
    defaultModel: 'tgi',
    auth: {
      method: 'none'
    },
    requestFormat: {
      modelField: 'model',
      messagesField: 'messages',
      maxTokensField: 'max_tokens',
      temperatureField: 'temperature'
    },
    responseFormat: {
      contentPath: 'choices.0.message.content'
    }
  },
  'ollama': {
    type: 'ollama',
    name: 'Ollama',
    description: 'Local Ollama server',
    baseUrl: 'http://localhost:11434',
    endpointPath: '/v1/chat/completions',
    defaultModel: 'llama3.1',
    auth: {
      method: 'none'
    },
    requestFormat: {
      modelField: 'model',
      messagesField: 'messages',
      maxTokensField: 'max_tokens',
      temperatureField: 'temperature'
    },
    responseFormat: {
      contentPath: 'choices.0.message.content'
    }
  },
  'openai-compatible': {
    type: 'openai-compatible',
    name: 'OpenAI-Compatible API',
    description: 'Any OpenAI-compatible endpoint',
    endpointPath: '/v1/chat/completions',
    auth: {
      method: 'bearer-token',
      headerName: 'Authorization',
      tokenPrefix: 'Bearer'
    },
    requestFormat: {
      modelField: 'model',
      messagesField: 'messages',
      maxTokensField: 'max_tokens',
      temperatureField: 'temperature'
    },
    responseFormat: {
      contentPath: 'choices.0.message.content',
      usagePath: 'usage'
    }
  },
  'anthropic-compatible': {
    type: 'anthropic-compatible',
    name: 'Anthropic-Compatible API',
    description: 'Any Anthropic-compatible endpoint',
    endpointPath: '/v1/messages',
    auth: {
      method: 'api-key',
      headerName: 'x-api-key',
      tokenPrefix: ''
    },
    extraHeaders: {
      'anthropic-version': '2023-06-01'
    },
    requestFormat: {
      modelField: 'model',
      messagesField: 'messages',
      maxTokensField: 'max_tokens',
      temperatureField: 'temperature'
    },
    responseFormat: {
      contentPath: 'content.0.text'
    }
  }
};

/**
 * Generate a unique endpoint ID
 */
export function generateEndpointId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ep-${timestamp}-${random}`;
}

/**
 * Create a new endpoint from a preset
 */
export function createEndpointFromPreset(
  type: EndpointType,
  overrides: Partial<CustomEndpoint>
): CustomEndpoint {
  const preset = ENDPOINT_PRESETS[type];
  const now = new Date().toISOString();

  return {
    id: generateEndpointId(),
    name: preset.name || type,
    type,
    description: preset.description,
    baseUrl: overrides.baseUrl || preset.baseUrl || '',
    endpointPath: overrides.endpointPath || preset.endpointPath || '',
    defaultModel: overrides.defaultModel || preset.defaultModel || '',
    availableModels: overrides.availableModels,
    auth: {
      ...preset.auth,
      ...overrides.auth
    } as EndpointAuth,
    extraHeaders: {
      ...preset.extraHeaders,
      ...overrides.extraHeaders
    },
    enabled: true,
    isDefault: false,
    healthCheck: overrides.healthCheck,
    requestFormat: {
      ...preset.requestFormat,
      ...overrides.requestFormat
    },
    responseFormat: {
      ...preset.responseFormat,
      ...overrides.responseFormat
    },
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

/**
 * Validate an endpoint configuration
 */
export function validateEndpoint(endpoint: CustomEndpoint): string[] {
  const errors: string[] = [];

  if (!endpoint.id) {
    errors.push('Endpoint ID is required');
  }

  if (!endpoint.name || endpoint.name.trim().length === 0) {
    errors.push('Endpoint name is required');
  }

  if (!endpoint.baseUrl || endpoint.baseUrl.trim().length === 0) {
    errors.push('Base URL is required');
  } else {
    try {
      new URL(endpoint.baseUrl);
    } catch {
      errors.push('Base URL is not a valid URL');
    }
  }

  if (!endpoint.endpointPath || endpoint.endpointPath.trim().length === 0) {
    errors.push('Endpoint path is required');
  }

  if (!endpoint.auth) {
    errors.push('Authentication configuration is required');
  }

  return errors;
}

/**
 * Build the full URL for an endpoint
 */
export function buildEndpointUrl(
  endpoint: CustomEndpoint,
  params?: Record<string, string>
): string {
  let baseUrl = endpoint.baseUrl.replace(/\/+$/, '');
  let path = endpoint.endpointPath;

  // Replace placeholders in base URL
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      baseUrl = baseUrl.replace(`{${key}}`, encodeURIComponent(value));
      path = path.replace(`{${key}}`, encodeURIComponent(value));
    }
  }

  // Ensure path starts with /
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  return baseUrl + path;
}
