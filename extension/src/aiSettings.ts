import * as vscode from 'vscode';

const SECRET_KEY_NAME = 'codeCoach.ai.apiKey';

export type AiConfig = {
  enabled: boolean;
  baseUrl: string;
  endpointPath: string;
  model: string;
  responseStyle: 'concise' | 'detailed';
  authHeader: string;
  authScheme: string;
};

export function getAiConfig(): AiConfig {
  const config = vscode.workspace.getConfiguration('codeCoach');
  const responseStyleRaw = (config.get<string>('ai.responseStyle', 'concise') ?? 'concise').trim();
  const responseStyle: 'concise' | 'detailed' = responseStyleRaw === 'detailed' ? 'detailed' : 'concise';
  return {
    enabled: config.get<boolean>('ai.enabled', false),
    baseUrl: (config.get<string>('ai.baseUrl', '') ?? '').trim(),
    endpointPath: (config.get<string>('ai.endpointPath', '/chat/completions') ?? '/chat/completions').trim(),
    model: (config.get<string>('ai.model', '') ?? '').trim(),
    responseStyle,
    authHeader: (config.get<string>('ai.authHeader', 'Authorization') ?? 'Authorization').trim(),
    authScheme: (config.get<string>('ai.authScheme', 'Bearer') ?? 'Bearer').trim()
  };
}

export async function setAiApiKey(context: vscode.ExtensionContext, apiKey: string): Promise<void> {
  await context.secrets.store(SECRET_KEY_NAME, apiKey);
}

export async function clearAiApiKey(context: vscode.ExtensionContext): Promise<void> {
  await context.secrets.delete(SECRET_KEY_NAME);
}

export async function hasAiApiKey(context: vscode.ExtensionContext): Promise<boolean> {
  const key = await context.secrets.get(SECRET_KEY_NAME);
  return Boolean(key && key.trim().length > 0);
}

export async function getAiApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
  const key = await context.secrets.get(SECRET_KEY_NAME);
  return key?.trim() ? key.trim() : undefined;
}
