import * as vscode from 'vscode';
import { getAiApiKey, getAiConfig } from './aiSettings';

export type AiExplainInput = {
  kind: 'selection' | 'exception';
  languageId: string;
  code: string;
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

export async function aiExplain(context: vscode.ExtensionContext, input: AiExplainInput): Promise<AiExplainResult> {
  const cfg = getAiConfig();
  if (!cfg.enabled) throw new Error('AI is disabled (codeCoach.ai.enabled=false).');
  if (!cfg.baseUrl) throw new Error('AI base URL is empty (codeCoach.ai.baseUrl).');
  if (!cfg.endpointPath) throw new Error('AI endpoint path is empty (codeCoach.ai.endpointPath).');
  if (!cfg.model) throw new Error('AI model/deployment is empty (codeCoach.ai.model).');

  const apiKey = await getAiApiKey(context);
  if (!apiKey) throw new Error('No API key stored. Run "Code Coach: Set AI API Key" first.');

  const url = joinUrl(cfg.baseUrl, cfg.endpointPath);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  const headerValue = cfg.authScheme ? `${cfg.authScheme} ${apiKey}` : apiKey;
  headers[cfg.authHeader || 'Authorization'] = headerValue;

  // OpenAI-compatible "chat/completions" request.
  const styleInstruction =
    cfg.responseStyle === 'detailed'
      ? 'Write 1–2 short paragraphs (Copilot-like), then optionally 2–4 bullets for key steps. Avoid fluff.'
      : 'Write concise bullets (3–8 bullets). Keep it short.';
  const body = {
    model: cfg.model,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          'You are Code Coach. Output MUST be valid JSON matching this TypeScript type: ' +
          '{ explanationMarkdown: string; claims?: { diagnosticCodes?: number[]; localVariables?: string[] }; confidence?: "high"|"medium"|"low" }. ' +
          'No extra keys. No prose outside JSON. Do not wrap JSON in markdown code fences. Do not include chain-of-thought. ' +
          `Style: ${styleInstruction} ` +
          'Use plain-English explanations.'
      },
      {
        role: 'user',
        content: buildUserPrompt(input, cfg.responseStyle)
      }
    ]
  };

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
  const content: unknown = raw?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('AI response missing choices[0].message.content.');
  }

  // Many models ignore the "JSON only" instruction and wrap JSON in ```json fences.
  // Try hard to extract/parse JSON; if we can't, treat the content as plain markdown.
  const parsed = tryParseAiExplainResultFromText(content);
  if (parsed) return parsed;

  return {
    explanationMarkdown: content.trim(),
    confidence: 'low'
  };
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

function buildUserPrompt(input: AiExplainInput, responseStyle: 'concise' | 'detailed'): string {
  const lines: string[] = [];
  lines.push(`Task: Explain ${input.kind} in plain English.`);
  lines.push(`Output style: ${responseStyle === 'detailed' ? 'detailed paragraphs' : 'concise bullets'}.`);
  lines.push('Constraints:');
  lines.push('- Be specific, but do not invent runtime values.');
  lines.push('- If you are unsure, say what evidence is missing.');
  if (responseStyle === 'detailed') {
    lines.push('- Prefer 1–2 paragraphs; you may add a short bullet list at the end.');
  } else {
    lines.push('- Keep it concise; prefer bullets.');
  }
  lines.push('');

  if (input.diagnostics && input.diagnostics.length > 0) {
    lines.push('Diagnostics (facts from editor):');
    for (const d of input.diagnostics.slice(0, 10)) {
      const c = d.code !== undefined ? ` (code ${String(d.code)})` : '';
      lines.push(`- ${d.message}${c}`);
    }
    lines.push('');
  }

  if (input.runtime) {
    if (input.runtime.stoppedAt) lines.push(`Runtime stop location: ${input.runtime.stoppedAt}`);
    if (input.runtime.locals && input.runtime.locals.length > 0) {
      lines.push('Runtime locals (facts):');
      for (const v of input.runtime.locals.slice(0, 30)) {
        const typeSuffix = v.type ? `: ${v.type}` : '';
        lines.push(`- ${v.name}${typeSuffix} = ${v.value}`);
      }
      lines.push('');
    }
  }

  lines.push(`Language: ${input.languageId}`);
  lines.push('Code:');
  lines.push('```');
  lines.push(input.code);
  lines.push('```');

  lines.push('');
  lines.push('Required output JSON rules:');
  lines.push('- explanationMarkdown: markdown string for the user');
  lines.push('- claims.diagnosticCodes: include ONLY numeric codes you relied on (if any)');
  lines.push('- claims.localVariables: include ONLY variable names you relied on from runtime locals (if any)');

  return lines.join('\n');
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
