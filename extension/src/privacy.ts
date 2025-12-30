import * as vscode from 'vscode';
import { AiProvider } from './aiSettings';
import { AiExplainInput } from './aiTypes';

export type PrivacyMode = 'offline' | 'local' | 'redacted' | 'full';

export type PrivacyConfig = {
  mode: PrivacyMode;
  allowedDomains: string[];
  redactPatterns: string[];
  maxContextChars: number;
};

const INJECTION_PATTERNS = [
  /ignore previous/i,
  /system prompt/i,
  /developer message/i,
  /you are an ai/i,
  /act as/i,
  /instructions/i,
  /tooling/i,
  /function call/i,
  /do not obey/i
];

export function getPrivacyConfig(): PrivacyConfig {
  const config = vscode.workspace.getConfiguration('codeCoach');
  const mode = normalizePrivacyMode(config.get<string>('privacy.mode', 'offline') ?? 'offline');
  const allowedDomains = (config.get<string[]>('privacy.allowedDomains', []) ?? []).filter(Boolean);
  const redactPatterns = (config.get<string[]>('privacy.redactPatterns', []) ?? []).filter(Boolean);
  const maxContextChars = clampNumber(config.get<number>('privacy.maxContextChars', 4000), 500, 50000, 4000);

  return {
    mode,
    allowedDomains,
    redactPatterns,
    maxContextChars
  };
}

export function enforcePrivacyPolicy(
  config: PrivacyConfig,
  provider: AiProvider,
  baseUrl: string
): { allowed: boolean; reason?: string } {
  if (config.mode === 'offline') {
    return { allowed: false, reason: 'Privacy mode is offline. Enable local/redacted/full to use AI.' };
  }

  if (config.mode === 'local') {
    const isLocalProvider = provider === 'ollama' || provider === 'lmstudio';
    if (!isLocalProvider && !isLocalBaseUrl(baseUrl)) {
      return { allowed: false, reason: 'Privacy mode is local: only local endpoints are allowed.' };
    }
  }

  if (config.allowedDomains.length > 0) {
    const host = safeHostFromUrl(baseUrl);
    if (host && !config.allowedDomains.map(d => d.toLowerCase()).includes(host.toLowerCase())) {
      return { allowed: false, reason: `AI base URL host "${host}" is not in the allowed domains list.` };
    }
  }

  return { allowed: true };
}

export function sanitizeAiInput(input: AiExplainInput, config: PrivacyConfig): AiExplainInput {
  const redactionRegexes = compileRedactionPatterns(config.redactPatterns);

  const sanitizedCode =
    config.mode === 'redacted'
      ? redactAllCommentsAndStrings(input.code)
      : stripInjectionLines(input.code);

  const codeAfterRedaction =
    redactionRegexes.length > 0 ? applyRedactions(sanitizedCode, redactionRegexes) : sanitizedCode;

  const trimmedCode = truncateText(codeAfterRedaction, config.maxContextChars);

  const diagnostics =
    input.diagnostics?.map(diag => ({
      ...diag,
      message: applyRedactions(stripInjectionLines(diag.message), redactionRegexes)
    })) ?? undefined;

  const context =
    input.context?.map(line => applyRedactions(stripInjectionLines(line), redactionRegexes)) ?? undefined;

  const runtime =
    input.runtime &&
    (config.mode === 'redacted'
      ? {
          stoppedAt: input.runtime.stoppedAt ? '<redacted>' : undefined,
          locals: input.runtime.locals?.map(local => ({
            name: local.name,
            type: local.type,
            value: '<redacted>'
          }))
        }
      : {
          stoppedAt: input.runtime.stoppedAt
            ? applyRedactions(stripInjectionLines(input.runtime.stoppedAt), redactionRegexes)
            : undefined,
          locals: input.runtime.locals?.map(local => ({
            ...local,
            value: applyRedactions(stripInjectionLines(local.value), redactionRegexes)
          }))
        });

  return {
    ...input,
    filePath: config.mode === 'redacted' ? undefined : input.filePath,
    code: trimmedCode,
    context,
    diagnostics,
    runtime
  };
}

function normalizePrivacyMode(raw: string): PrivacyMode {
  switch (raw.trim().toLowerCase()) {
    case 'local':
      return 'local';
    case 'redacted':
      return 'redacted';
    case 'full':
      return 'full';
    case 'offline':
    default:
      return 'offline';
  }
}

function clampNumber(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function compileRedactionPatterns(patterns: string[]): RegExp[] {
  const regexes: RegExp[] = [];
  for (const pattern of patterns) {
    try {
      regexes.push(new RegExp(pattern, 'gi'));
    } catch {
      continue;
    }
  }
  return regexes;
}

function applyRedactions(text: string, patterns: RegExp[]): string {
  if (!text || patterns.length === 0) return text;
  let next = text;
  for (const regex of patterns) {
    next = next.replace(regex, '[REDACTED]');
  }
  return next;
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n/* ... truncated ... */`;
}

function safeHostFromUrl(baseUrl: string): string | undefined {
  try {
    const url = new URL(baseUrl);
    return url.host;
  } catch {
    return undefined;
  }
}

function isLocalBaseUrl(baseUrl: string): boolean {
  const host = safeHostFromUrl(baseUrl);
  if (!host) return false;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.local');
}

function stripInjectionLines(text: string): string {
  if (!text) return text;
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const filtered = lines.map(line => {
    const matches = INJECTION_PATTERNS.some(pattern => pattern.test(line));
    return matches ? '[redacted: prompt-injection]' : line;
  });
  return filtered.join('\n');
}

function redactAllCommentsAndStrings(code: string): string {
  let next = code;
  next = next.replace(/\/\*[\s\S]*?\*\//g, '/* [redacted] */');
  next = next.replace(/\/\/.*$/gm, '// [redacted]');
  next = next.replace(/'(?:\\.|[^'\\])*'/g, "'[redacted]'");
  next = next.replace(/"(?:\\.|[^"\\])*"/g, '"[redacted]"');
  next = next.replace(/`(?:\\.|[^`\\])*`/g, '`[redacted]`');
  return next;
}
