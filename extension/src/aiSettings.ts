import * as vscode from 'vscode';
import { ConfigManager } from './configManager';

const LEGACY_SECRET_KEY_NAME = 'codeCoach.ai.apiKey';
const SECRET_KEY_PREFIX = 'codeCoach.ai.apiKey';

export type AiProvider = 'openrouter' | 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'lmstudio';

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
  promptOptimizer: boolean;
  promptOptimizerMode: 'strict' | 'balanced' | 'compact';
  promptDebug: boolean;
  strictJson: boolean;
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
  },
  ollama: {
    baseUrl: 'http://localhost:11434',
    endpointPath: '/v1/chat/completions',
    model: 'llama3.1',
    authHeader: '',
    authScheme: ''
  },
  lmstudio: {
    baseUrl: 'http://localhost:1234',
    endpointPath: '/v1/chat/completions',
    model: 'local-model',
    authHeader: '',
    authScheme: ''
  }
};

export function getAiConfig(): AiConfig {
  const configManager = ConfigManager.getInstance();
  const vsConfig = vscode.workspace.getConfiguration('codeCoach');

  // Shareable settings from ConfigManager (cascading: project → global → VS Code → defaults)
  const provider = normalizeProvider(configManager.get<string>('ai.provider', 'openrouter'));
  const defaults = PROVIDER_DEFAULTS[provider];
  const responseStyleRaw = configManager.get<string>('ai.responseStyle', 'concise').trim();
  const responseStyle: 'concise' | 'detailed' = responseStyleRaw === 'detailed' ? 'detailed' : 'concise';
  const temperature = clampNumber(configManager.get<number>('ai.temperature', 0.2), 0, 2, 0.2);
  const maxTokens = clampNumber(configManager.get<number>('ai.maxTokens', 800), 64, 4000, 800);

  // VS Code-only settings (personal/sensitive - never in config files)
  const extraHeaders: Record<string, string> = {
    ...(defaults.extraHeaders ?? {})
  };

  if (provider === 'openrouter') {
    const referer = (vsConfig.get<string>('ai.openrouter.referer', '') ?? '').trim();
    const title = (vsConfig.get<string>('ai.openrouter.title', '') ?? '').trim();
    if (referer) extraHeaders['HTTP-Referer'] = referer;
    if (title) extraHeaders['X-Title'] = title;
  }

  const configuredExtra = vsConfig.get<Record<string, string>>('ai.extraHeaders', {});
  if (configuredExtra && typeof configuredExtra === 'object') {
    for (const [key, value] of Object.entries(configuredExtra)) {
      if (typeof value === 'string' && value.trim()) {
        extraHeaders[key] = value.trim();
      }
    }
  }

  return {
    // Shareable settings (from ConfigManager)
    enabled: configManager.get<boolean>('ai.enabled', false),
    provider,
    model: configManager.get<string>('ai.model', '').trim() || defaults.model,
    responseStyle,
    temperature,
    maxTokens,
    promptOptimizer: configManager.get<boolean>('ai.promptOptimizer', true),
    promptOptimizerMode: normalizeOptimizerMode(configManager.get<string>('ai.promptOptimizerMode', 'strict')),
    // VS Code-only settings (personal/sensitive)
    baseUrl: (vsConfig.get<string>('ai.baseUrl', '') ?? '').trim() || defaults.baseUrl,
    endpointPath: (vsConfig.get<string>('ai.endpointPath', '') ?? '').trim() || defaults.endpointPath,
    authHeader: (vsConfig.get<string>('ai.authHeader', '') ?? '').trim() || defaults.authHeader,
    authScheme: (vsConfig.get<string>('ai.authScheme', '') ?? '').trim() || defaults.authScheme,
    extraHeaders,
    promptDebug: vsConfig.get<boolean>('ai.promptDebug', false),
    strictJson: vsConfig.get<boolean>('ai.strictJson', false)
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
    case 'ollama':
      return 'ollama';
    case 'lmstudio':
      return 'lmstudio';
    case 'openrouter':
    default:
      return 'openrouter';
  }
}

function normalizeOptimizerMode(raw: string): 'strict' | 'balanced' | 'compact' {
  switch (raw.trim().toLowerCase()) {
    case 'balanced':
      return 'balanced';
    case 'compact':
      return 'compact';
    case 'strict':
    default:
      return 'strict';
  }
}

function clampNumber(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}
