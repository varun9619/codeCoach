import { AiExplainResult } from './aiClient';

export type VerificationEvidence = {
  diagnosticCodes?: number[];
  localVariables?: string[];
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
  if (claimedVars.length > 0) {
    const present = new Set((evidence.localVariables ?? []).map(v => v));
    const missing = claimedVars.filter(v => !present.has(v));
    if (missing.length > 0) {
      notes.push(`AI mentioned runtime locals not present in the captured snapshot: ${missing.join(', ')}`);
    }
  }

  return {
    verified: notes.length === 0,
    notes
  };
}
