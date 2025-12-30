import * as vscode from 'vscode';
import { AiConfig, AiProvider, getAiApiKey, getAiConfig } from './aiSettings';
import { buildOptimizedPrompt } from './promptOptimizer';

export type AiExplainInput = {
  kind: 'selection' | 'exception';
  languageId: string;
  code: string;
  filePath?: string;
  startLineNumber?: number;
  endLineNumber?: number;
  diagnostics?: Array<{ message: string; code?: string | number }>;
  runtime?: {
    stoppedAt?: string;
    locals?: Array<{ name: string; value: string; type?: string }>;
  };
};

export type AiExplainResult = {
  explanationMarkdown: string;
  claims?: {
    diagnosticCodes?: number[];
    localVariables?: string[];
  };
  confidence?: 'high' | 'medium' | 'low';
};

let promptDebugChannel: vscode.OutputChannel | undefined;

export async function aiExplain(context: vscode.ExtensionContext, input: AiExplainInput): Promise<AiExplainResult> {
  const cfg = getAiConfig();
  if (!cfg.enabled) throw new Error('AI is disabled (codeCoach.ai.enabled=false).');
  if (!cfg.baseUrl) throw new Error('AI base URL is empty (codeCoach.ai.baseUrl).');
  if (!cfg.endpointPath) throw new Error('AI endpoint path is empty (codeCoach.ai.endpointPath).');
  if (!cfg.model) throw new Error('AI model/deployment is empty (codeCoach.ai.model).');

  const apiKey = await getAiApiKey(context, cfg.provider);
  if (!apiKey) throw new Error(`No API key stored for ${cfg.provider}. Run "Code Coach: Set AI API Key".`);

  const url = joinUrl(cfg.baseUrl, resolveEndpointPath(cfg));
  const headers = buildHeaders(cfg, apiKey);
  const systemPrompt = buildSystemPrompt(cfg.responseStyle);
  const userPrompt = buildUserPrompt(input, cfg.responseStyle);
  const optimizedPrompt = cfg.promptOptimizer
    ? buildOptimizedPrompt(userPrompt, { includeDebugHeader: cfg.promptDebug })
    : buildOptimizedPrompt(userPrompt);

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
    userPrompt: optimizedPrompt
  });

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await safeReadText(res);
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
  if (parsed) return parsed;

  if (cfg.strictJson) {
    throw new Error('AI response was not valid JSON, and strict JSON mode is enabled.');
  }

  return {
    explanationMarkdown: content.trim(),
    confidence: 'low'
  };
}

type ProviderBodyInput = {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  userPrompt: string;
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
    default:
      return {
        model: input.model,
        temperature: input.temperature,
        max_tokens: input.maxTokens,
        messages: [
          { role: 'system', content: input.systemPrompt },
          { role: 'user', content: input.userPrompt }
        ]
      };
  }
}

function buildHeaders(cfg: AiConfig, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...cfg.extraHeaders
  };

  const headerValue = cfg.authScheme ? `${cfg.authScheme} ${apiKey}` : apiKey;
  headers[cfg.authHeader || 'Authorization'] = headerValue;
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
    if (isAiExplainResult(parsed)) return parsed;
    return undefined;
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
  const task = `Explain the ${input.kind} so a developer can understand what it does and why it fails (if applicable).`;
  const audience = 'A developer reading code inside VS Code who wants fast, accurate understanding.';
  const outputFormat =
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

  const evidence: string[] = [];
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

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '<unable to read response body>';
  }
}

function isAiExplainResult(x: any): x is AiExplainResult {
  return (
    x &&
    typeof x === 'object' &&
    typeof x.explanationMarkdown === 'string' &&
    (x.confidence === undefined || x.confidence === 'high' || x.confidence === 'medium' || x.confidence === 'low')
  );
}
