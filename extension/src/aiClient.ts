import * as vscode from 'vscode';
import { AiConfig, AiProvider, getAiApiKey, getAiConfig } from './aiSettings';
import { buildOptimizedPrompt, PromptOptimizerMode } from './promptOptimizer';
import { AiExplainInput, AiExplainResult } from './aiTypes';
import { enforcePrivacyPolicy, getPrivacyConfig, sanitizeAiInput } from './privacy';
import { trackEvent } from './telemetry';
import { ExplanationCache } from './cache/explanationCache';
import { CacheLookupRequest, CacheStoreRequest } from './cache/cacheTypes';

export type { AiExplainInput, AiExplainResult } from './aiTypes';

let promptDebugChannel: vscode.OutputChannel | undefined;

export async function aiExplain(context: vscode.ExtensionContext, input: AiExplainInput): Promise<AiExplainResult> {
  const cfg = getAiConfig();
  if (!cfg.enabled) throw new Error('AI is disabled (codeCoach.ai.enabled=false).');
  if (!cfg.baseUrl) throw new Error('AI base URL is empty (codeCoach.ai.baseUrl).');
  if (!cfg.endpointPath) throw new Error('AI endpoint path is empty (codeCoach.ai.endpointPath).');
  if (!cfg.model) throw new Error('AI model/deployment is empty (codeCoach.ai.model).');
  if (!isProviderAllowed(cfg.provider)) {
    throw new Error(`AI provider ${cfg.provider} is disabled by policy.`);
  }

  const privacy = getPrivacyConfig();

  // Check cache before making API call
  const cache = ExplanationCache.getInstance();
  const canCache = input.kind === 'explain' && input.filePath && input.sourceCode;
  const cacheRequest: CacheLookupRequest | undefined = canCache ? {
    filePath: input.filePath!,
    startLine: input.startLine ?? 1,
    endLine: input.endLine ?? 1,
    sourceCode: input.sourceCode!,
    templateId: input.templateId ?? 'default',
    privacyMode: privacy.mode === 'redacted' ? 'redacted' : 'full'
  } : undefined;

  if (cacheRequest) {
    const cacheResult = cache.lookup(cacheRequest);
    if (cacheResult.hit && cacheResult.entry) {
      trackEvent('llm.cacheHit', {
        kind: input.kind,
        templateId: cacheRequest.templateId,
        cachedBy: cacheResult.entry.createdBy
      });
      return {
        explanationMarkdown: cacheResult.entry.explanation,
        confidence: 'high',
        cached: true,
        cachedBy: cacheResult.entry.createdBy,
        cachedAt: cacheResult.entry.createdAt
      };
    }
  }
  const decision = enforcePrivacyPolicy(privacy, cfg.provider, cfg.baseUrl);
  if (!decision.allowed) {
    trackEvent('llm.blocked', {
      provider: cfg.provider,
      mode: privacy.mode,
      reason: decision.reason ?? 'policy'
    });
    throw new Error(decision.reason ?? 'AI request blocked by privacy settings.');
  }

  const apiKey = await getAiApiKey(context, cfg.provider);
  if (!apiKey && requiresApiKey(cfg.provider, cfg)) {
    throw new Error(`No API key stored for ${cfg.provider}. Run "Code Coach: Set AI API Key".`);
  }

  const sanitizedInput = sanitizeAiInput(input, privacy);

  const url = joinUrl(cfg.baseUrl, resolveEndpointPath(cfg));
  const headers = buildHeaders(cfg, apiKey ?? '');
  const systemPrompt = buildSystemPrompt(cfg.responseStyle);
  const userPrompt = buildUserPrompt(sanitizedInput, cfg.responseStyle);
  const optimizedPrompt = cfg.promptOptimizer
    ? buildOptimizedPrompt(userPrompt, {
        includeDebugHeader: cfg.promptDebug,
        mode: cfg.promptOptimizerMode as PromptOptimizerMode
      })
    : buildPlainPrompt(userPrompt);

  const requestStart = Date.now();
  trackEvent('llm.request', {
    provider: cfg.provider,
    kind: input.kind,
    mode: privacy.mode,
    promptChars: optimizedPrompt.length,
    strictJson: cfg.strictJson
  });

  if (cfg.promptDebug) {
    const channel = getPromptDebugChannel();
    channel.clear();
    channel.appendLine(optimizedPrompt);
    channel.show(true);
  }

  const body = buildProviderBody(cfg.provider, {
    model: cfg.model,
    temperature: cfg.temperature,
    maxTokens: cfg.maxTokens,
    systemPrompt,
    userPrompt: optimizedPrompt,
    strictJson: cfg.strictJson
  });

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await safeReadText(res);
    trackEvent('llm.error', {
      provider: cfg.provider,
      kind: input.kind,
      latencyMs: Date.now() - requestStart,
      status: res.status
    });
    throw new Error(`AI request failed (${res.status}): ${text}`);
  }

  const raw: any = await res.json();
  const content = extractProviderText(cfg.provider, raw);
  if (!content || !content.trim()) {
    throw new Error(`AI response missing text content for provider ${cfg.provider}.`);
  }

  // Many models ignore the "JSON only" instruction and wrap JSON in ```json fences.
  // Try hard to extract/parse JSON; if we can't, treat the content as plain markdown.
  const parsed = tryParseAiExplainResultFromText(content);
  if (parsed) {
    trackEvent('llm.response', {
      provider: cfg.provider,
      kind: input.kind,
      latencyMs: Date.now() - requestStart,
      responseChars: content.length,
      parsed: true
    });

    // Store in cache if applicable
    if (cacheRequest && parsed.explanationMarkdown) {
      storeCacheEntry(cache, cacheRequest, parsed.explanationMarkdown, cfg);
    }

    return parsed;
  }

  if (cfg.strictJson) {
    trackEvent('llm.response', {
      provider: cfg.provider,
      kind: input.kind,
      latencyMs: Date.now() - requestStart,
      responseChars: content.length,
      parsed: false
    });
    throw new Error('AI response was not valid JSON, and strict JSON mode is enabled.');
  }

  trackEvent('llm.response', {
    provider: cfg.provider,
    kind: input.kind,
    latencyMs: Date.now() - requestStart,
    responseChars: content.length,
    parsed: false
  });

  const result = {
    explanationMarkdown: content.trim(),
    confidence: 'low' as const
  };

  // Store in cache if applicable
  if (cacheRequest && result.explanationMarkdown) {
    storeCacheEntry(cache, cacheRequest, result.explanationMarkdown, cfg);
  }

  return result;
}

/**
 * Store an explanation in the cache
 */
async function storeCacheEntry(
  cache: ExplanationCache,
  request: CacheLookupRequest,
  explanation: string,
  cfg: AiConfig
): Promise<void> {
  const author = await cache.getDefaultAuthor();
  const storeRequest: CacheStoreRequest = {
    ...request,
    explanation,
    author,
    provider: cfg.provider,
    model: cfg.model
  };
  cache.store(storeRequest).catch(err => {
    console.error('[Code Coach] Failed to cache explanation:', err);
  });
}

type ProviderBodyInput = {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  userPrompt: string;
  strictJson: boolean;
};

function buildProviderBody(provider: AiProvider, input: ProviderBodyInput): Record<string, unknown> {
  switch (provider) {
    case 'anthropic':
      return {
        model: input.model,
        max_tokens: input.maxTokens,
        temperature: input.temperature,
        system: input.systemPrompt,
        messages: [{ role: 'user', content: input.userPrompt }]
      };
    case 'gemini':
      return {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${input.systemPrompt}\n\n${input.userPrompt}` }]
          }
        ],
        generationConfig: {
          temperature: input.temperature,
          maxOutputTokens: input.maxTokens
        }
      };
    case 'openai':
    case 'openrouter':
    case 'ollama':
    case 'lmstudio':
    default:
      return {
        model: input.model,
        temperature: input.temperature,
        max_tokens: input.maxTokens,
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.userPrompt }
        ],
        ...(input.strictJson ? { response_format: { type: 'json_object' } } : {})
      };
  }
}

function buildHeaders(cfg: AiConfig, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...cfg.extraHeaders
  };

  if (cfg.authHeader && apiKey) {
    const headerValue = cfg.authScheme ? `${cfg.authScheme} ${apiKey}` : apiKey;
    headers[cfg.authHeader || 'Authorization'] = headerValue;
  }
  return headers;
}

function resolveEndpointPath(cfg: AiConfig): string {
  if (cfg.endpointPath.includes('{model}')) {
    return cfg.endpointPath.replace('{model}', encodeURIComponent(cfg.model));
  }
  return cfg.endpointPath;
}

function extractProviderText(provider: AiProvider, raw: any): string | undefined {
  switch (provider) {
    case 'anthropic':
      return raw?.content?.[0]?.text;
    case 'gemini': {
      const parts = raw?.candidates?.[0]?.content?.parts;
      if (!Array.isArray(parts)) return undefined;
      return parts
        .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
        .filter(Boolean)
        .join('\n')
        .trim();
    }
    case 'openai':
    case 'openrouter':
    case 'ollama':
    case 'lmstudio':
    default:
      return raw?.choices?.[0]?.message?.content;
  }
}

function buildSystemPrompt(responseStyle: 'concise' | 'detailed'): string {
  const styleInstruction =
    responseStyle === 'detailed'
      ? 'Write 1–2 short paragraphs (Copilot-like), then optionally 2–4 bullets for key steps. Avoid fluff.'
      : 'Write concise bullets (3–8 bullets). Keep it short.';
  return (
    'You are Code Coach. Output MUST be valid JSON matching this TypeScript type: ' +
    '{ explanationMarkdown: string; claims?: { diagnosticCodes?: number[]; localVariables?: string[] }; confidence?: "high"|"medium"|"low" }. ' +
    'No extra keys. No prose outside JSON. Do not wrap JSON in markdown code fences. Do not include chain-of-thought. ' +
    `Style: ${styleInstruction} ` +
    'Use plain-English explanations.'
  );
}

function requiresApiKey(provider: AiProvider, cfg: AiConfig): boolean {
  if (provider === 'ollama' || provider === 'lmstudio') return false;
  return Boolean(cfg.authHeader);
}

function isProviderAllowed(provider: AiProvider): boolean {
  const raw = vscode.workspace.getConfiguration('codeCoach').get<string[]>('enterprise.allowedAiProviders');
  if (!raw || raw.length === 0) return true;
  return raw.map(value => value.trim().toLowerCase()).includes(provider);
}

function getPromptDebugChannel(): vscode.OutputChannel {
  if (!promptDebugChannel) {
    promptDebugChannel = vscode.window.createOutputChannel('Code Coach: Prompt Debug');
  }
  return promptDebugChannel;
}

function tryParseAiExplainResultFromText(text: string): AiExplainResult | undefined {
  const trimmed = text.trim();

  // 1) ```json\n{...}\n``` or ```\n{...}\n```
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(trimmed);
  if (fenced && fenced[1]) {
    const fromFence = tryParseJsonObject(fenced[1]);
    if (fromFence) return fromFence;
  }

  // 2) Raw JSON
  const direct = tryParseJsonObject(trimmed);
  if (direct) return direct;

  // 3) Best-effort: extract first {...} block from surrounding prose
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const slice = trimmed.slice(firstBrace, lastBrace + 1);
    const extracted = tryParseJsonObject(slice);
    if (extracted) return extracted;
  }

  return undefined;
}

function tryParseJsonObject(candidate: string): AiExplainResult | undefined {
  try {
    const parsed: unknown = JSON.parse(candidate);
    return normalizeAiExplainResult(parsed);
  } catch {
    return undefined;
  }
}

type OptimizerPayload = {
  task: string;
  audience: string;
  outputFormat: string;
  style: string[];
  constraints: string[];
  evidence: string[];
  codeBlock?: string;
};

function buildUserPrompt(input: AiExplainInput, responseStyle: 'concise' | 'detailed'): OptimizerPayload {
  const lines: string[] = [];
  let task = `Explain the ${input.kind} so a developer can understand what it does and why it fails (if applicable).`;
  const audience = 'A developer reading code inside VS Code who wants fast, accurate understanding.';
  let outputFormat =
    'Return JSON only (no markdown fences). explanationMarkdown: human-readable explanation. ' +
    'claims.diagnosticCodes: include only codes you explicitly used. ' +
    'claims.localVariables: include only runtime locals you explicitly used (omit if none provided). ' +
    'confidence: high|medium|low based on evidence coverage.';
  const style = [
    responseStyle === 'detailed'
      ? '1–2 short paragraphs; optional 2–4 bullets.'
      : 'Concise bullets (3–8).',
    'Tone: professional, direct, no fluff.'
  ];
  const constraints = [
    'Use only the evidence provided below.',
    'Do not invent runtime values or missing files.',
    'If unsure, state what evidence is missing.',
    'Include line citations for any code claim.',
    'Only cite lines that appear in the provided snippet.'
  ];

  if (input.kind === 'diagnostic') {
    task = 'Explain this diagnostic in plain English and propose fixes with citations.';
    constraints.push('Provide 2-3 fix options ranked by preference.');
  }

  if (input.kind === 'deepDive') {
    task = 'Summarize the symbol for a deep dive panel: intent, responsibilities, risks.';
  }

  if (input.kind === 'why') {
    task = 'Explain why this code works: assumptions, edge cases, what could break.';
    outputFormat =
      'Return JSON only (no markdown fences). explanationMarkdown: include sections for Assumptions, ' +
      'Edge cases handled, Edge cases not handled, and What could break. ' +
      'claims.diagnosticCodes: include only codes you explicitly used. ' +
      'claims.localVariables: include only runtime locals you explicitly used (omit if none provided). ' +
      'confidence: high|medium|low based on evidence coverage.';
    constraints.push('Be explicit about uncertainty; do not guess missing behaviors.');
  }

  const evidence: string[] = [];
  if (input.context && input.context.length > 0) {
    evidence.push('Context:');
    for (const line of input.context.slice(0, 20)) {
      evidence.push(`- ${line}`);
    }
  }
  if (input.filePath) {
    evidence.push(`File: ${input.filePath}`);
  }
  if (typeof input.startLineNumber === 'number' && typeof input.endLineNumber === 'number') {
    evidence.push(`Line range: ${input.startLineNumber}-${input.endLineNumber}`);
  }
  if (input.filePath || typeof input.startLineNumber === 'number') {
    evidence.push('Citation format: "path:line" (preferred) or "L<line>" if no file path provided.');
  }

  if (input.diagnostics && input.diagnostics.length > 0) {
    evidence.push('Diagnostics (facts from editor):');
    for (const d of input.diagnostics.slice(0, 10)) {
      const c = d.code !== undefined ? ` (code ${String(d.code)})` : '';
      evidence.push(`- ${d.message}${c}`);
    }
  }

  if (input.runtime) {
    if (input.runtime.stoppedAt) evidence.push(`Runtime stop location: ${input.runtime.stoppedAt}`);
    if (input.runtime.locals && input.runtime.locals.length > 0) {
      evidence.push('Runtime locals (facts):');
      for (const v of input.runtime.locals.slice(0, 30)) {
        const typeSuffix = v.type ? `: ${v.type}` : '';
        evidence.push(`- ${v.name}${typeSuffix} = ${v.value}`);
      }
    }
  }

  evidence.push(`Language: ${input.languageId}`);

  const codeBlock = formatCodeWithLineNumbers(input.code, input.startLineNumber);

  return {
    task,
    audience,
    outputFormat,
    style,
    constraints,
    evidence,
    codeBlock
  };
}

function formatCodeWithLineNumbers(code: string, startLineNumber?: number): string {
  const normalized = code.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  if (typeof startLineNumber !== 'number') {
    return lines.join('\n');
  }
  return lines
    .map((line, idx) => {
      const lineNumber = startLineNumber + idx;
      return `L${lineNumber}: ${line}`;
    })
    .join('\n');
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

function buildPlainPrompt(input: OptimizerPayload): string {
  const out: string[] = [];
  out.push(`Objective: ${input.task}`);
  out.push(`Audience: ${input.audience}`);
  out.push(`Output: ${input.outputFormat}`);
  if (input.style.length > 0) out.push(`Style: ${input.style.join(' ')}`);
  if (input.constraints.length > 0) out.push(`Constraints: ${input.constraints.join(' ')}`);
  if (input.evidence.length > 0) {
    out.push('Evidence:');
    for (const line of input.evidence) out.push(line);
  }
  if (input.codeBlock) {
    out.push('Code:');
    out.push(input.codeBlock);
  }
  return out.join('\n').trim();
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '<unable to read response body>';
  }
}

function normalizeAiExplainResult(x: any): AiExplainResult | undefined {
  if (!x || typeof x !== 'object' || typeof x.explanationMarkdown !== 'string') return undefined;
  const explanationMarkdown = x.explanationMarkdown.trim();
  if (!explanationMarkdown) return undefined;

  const claims: AiExplainResult['claims'] = {};
  const diagnosticCodes = Array.isArray(x.claims?.diagnosticCodes)
    ? x.claims.diagnosticCodes.filter((c: unknown) => typeof c === 'number')
    : undefined;
  if (diagnosticCodes && diagnosticCodes.length > 0) claims.diagnosticCodes = diagnosticCodes;

  const localVariables = Array.isArray(x.claims?.localVariables)
    ? x.claims.localVariables.filter((v: unknown) => typeof v === 'string')
    : undefined;
  if (localVariables && localVariables.length > 0) claims.localVariables = localVariables;

  const confidence =
    x.confidence === 'high' || x.confidence === 'medium' || x.confidence === 'low' ? x.confidence : undefined;

  return {
    explanationMarkdown,
    ...(Object.keys(claims).length > 0 ? { claims } : {}),
    ...(confidence ? { confidence } : {})
  };
}
