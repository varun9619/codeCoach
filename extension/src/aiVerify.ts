import { AiExplainResult } from './aiClient';

export type VerificationEvidence = {
  diagnosticCodes?: number[];
  localVariables?: string[];
  lineRange?: { start: number; end: number };
  requireCitations?: boolean;
};

export type VerificationResult = {
  verified: boolean;
  notes: string[];
};

export function verifyAiResult(result: AiExplainResult, evidence: VerificationEvidence): VerificationResult {
  const notes: string[] = [];

  const claimedCodes = result.claims?.diagnosticCodes ?? [];
  if (claimedCodes.length > 0) {
    const present = new Set((evidence.diagnosticCodes ?? []).filter((n): n is number => typeof n === 'number'));
    const missing = claimedCodes.filter(c => !present.has(c));
    if (missing.length > 0) {
      notes.push(`AI mentioned diagnostic codes not present in this file: ${missing.join(', ')}`);
    }
  }

  const claimedVars = result.claims?.localVariables ?? [];
  if (claimedVars.length > 0 && (evidence.localVariables ?? []).length > 0) {
    const present = new Set((evidence.localVariables ?? []).map(v => v));
    const missing = claimedVars.filter(v => !present.has(v));
    if (missing.length > 0) {
      notes.push(`AI mentioned runtime locals not present in the captured snapshot: ${missing.join(', ')}`);
    }
  }

  const lineRefs = extractLineReferences(result.explanationMarkdown);
  if (evidence.requireCitations && lineRefs.length === 0) {
    notes.push('AI response did not include line citations.');
  }

  if (evidence.lineRange && lineRefs.length > 0) {
    const { start, end } = evidence.lineRange;
    const outOfRange = lineRefs.filter(line => line < start || line > end);
    if (outOfRange.length > 0) {
      notes.push(`AI cited lines outside the provided range (${start}-${end}): ${outOfRange.join(', ')}`);
    }
  }

  return {
    verified: notes.length === 0,
    notes
  };
}

function extractLineReferences(markdown: string): number[] {
  const refs = new Set<number>();
  if (!markdown) return [];

  const lMatches = markdown.match(/\bL(\d{1,6})\b/g);
  if (lMatches) {
    for (const match of lMatches) {
      const num = Number(match.slice(1));
      if (!Number.isNaN(num)) refs.add(num);
    }
  }

  const colonMatches = markdown.match(/:(\d{1,6})\b/g);
  if (colonMatches) {
    for (const match of colonMatches) {
      const num = Number(match.slice(1));
      if (!Number.isNaN(num)) refs.add(num);
    }
  }

  return Array.from(refs).sort((a, b) => a - b);
}
