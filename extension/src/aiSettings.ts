import * as vscode from 'vscode';

const LEGACY_SECRET_KEY_NAME = 'codeCoach.ai.apiKey';
const SECRET_KEY_PREFIX = 'codeCoach.ai.apiKey';

export type AiProvider = 'openrouter' | 'openai' | 'anthropic' | 'gemini';

export type AiConfig = {
  enabled: boolean;
  provider: AiProvider;
  baseUrl: string;
  endpointPath: string;
  model: string;
  responseStyle: 'concise' | 'detailed';
  authHeader: string;
  authScheme: string;
  extraHeaders: Record<string, string>;
  temperature: number;
  maxTokens: number;
};

type ProviderDefaults = {
  baseUrl: string;
  endpointPath: string;
  model: string;
  authHeader: string;
  authScheme: string;
  extraHeaders?: Record<string, string>;
};

const PROVIDER_DEFAULTS: Record<AiProvider, ProviderDefaults> = {
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    endpointPath: '/chat/completions',
    model: 'anthropic/claude-3.5-sonnet',
    authHeader: 'Authorization',
    authScheme: 'Bearer'
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    endpointPath: '/chat/completions',
    model: 'gpt-4o-mini',
    authHeader: 'Authorization',
    authScheme: 'Bearer'
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    endpointPath: '/v1/messages',
    model: 'claude-3-5-sonnet-20240620',
    authHeader: 'x-api-key',
    authScheme: '',
    extraHeaders: {
      'anthropic-version': '2023-06-01'
    }
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    endpointPath: '/models/{model}:generateContent',
    model: 'gemini-1.5-pro',
    authHeader: 'x-goog-api-key',
    authScheme: ''
  }
};

export function getAiConfig(): AiConfig {
  const config = vscode.workspace.getConfiguration('codeCoach');
  const provider = normalizeProvider(config.get<string>('ai.provider', 'openrouter') ?? 'openrouter');
  const defaults = PROVIDER_DEFAULTS[provider];
  const responseStyleRaw = (config.get<string>('ai.responseStyle', 'concise') ?? 'concise').trim();
  const responseStyle: 'concise' | 'detailed' = responseStyleRaw === 'detailed' ? 'detailed' : 'concise';
  const temperature = clampNumber(config.get<number>('ai.temperature', 0.2), 0, 2, 0.2);
  const maxTokens = clampNumber(config.get<number>('ai.maxTokens', 800), 64, 4000, 800);

  const extraHeaders: Record<string, string> = {
    ...(defaults.extraHeaders ?? {})
  };

  if (provider === 'openrouter') {
    const referer = (config.get<string>('ai.openrouter.referer', '') ?? '').trim();
    const title = (config.get<string>('ai.openrouter.title', '') ?? '').trim();
    if (referer) extraHeaders['HTTP-Referer'] = referer;
    if (title) extraHeaders['X-Title'] = title;
  }

  const configuredExtra = config.get<Record<string, string>>('ai.extraHeaders', {});
  if (configuredExtra && typeof configuredExtra === 'object') {
    for (const [key, value] of Object.entries(configuredExtra)) {
      if (typeof value === 'string' && value.trim()) {
        extraHeaders[key] = value.trim();
      }
    }
  }

  return {
    enabled: config.get<boolean>('ai.enabled', false),
    provider,
    baseUrl: (config.get<string>('ai.baseUrl', '') ?? '').trim() || defaults.baseUrl,
    endpointPath: (config.get<string>('ai.endpointPath', '') ?? '').trim() || defaults.endpointPath,
    model: (config.get<string>('ai.model', '') ?? '').trim() || defaults.model,
    responseStyle,
    authHeader: (config.get<string>('ai.authHeader', '') ?? '').trim() || defaults.authHeader,
    authScheme: (config.get<string>('ai.authScheme', '') ?? '').trim() || defaults.authScheme,
    extraHeaders,
    temperature,
    maxTokens
  };
}

export async function setAiApiKey(
  context: vscode.ExtensionContext,
  provider: AiProvider,
  apiKey: string
): Promise<void> {
  await context.secrets.store(getSecretKeyName(provider), apiKey);
}

export async function clearAiApiKey(context: vscode.ExtensionContext, provider: AiProvider): Promise<void> {
  await context.secrets.delete(getSecretKeyName(provider));
  await context.secrets.delete(LEGACY_SECRET_KEY_NAME);
}

export async function hasAiApiKey(context: vscode.ExtensionContext, provider: AiProvider): Promise<boolean> {
  const key = await getAiApiKey(context, provider);
  return Boolean(key && key.trim().length > 0);
}

export async function getAiApiKey(context: vscode.ExtensionContext, provider: AiProvider): Promise<string | undefined> {
  const providerKey = await context.secrets.get(getSecretKeyName(provider));
  if (providerKey?.trim()) return providerKey.trim();
  const legacyKey = await context.secrets.get(LEGACY_SECRET_KEY_NAME);
  return legacyKey?.trim() ? legacyKey.trim() : undefined;
}

function getSecretKeyName(provider: AiProvider): string {
  return `${SECRET_KEY_PREFIX}.${provider}`;
}

function normalizeProvider(raw: string): AiProvider {
  switch (raw.trim().toLowerCase()) {
    case 'openai':
      return 'openai';
    case 'anthropic':
      return 'anthropic';
    case 'gemini':
      return 'gemini';
    case 'openrouter':
    default:
      return 'openrouter';
  }
}

function clampNumber(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}
