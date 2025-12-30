export type PromptOptimizerInput = {
  task: string;
  audience: string;
  outputFormat: string;
  style: string[];
  constraints: string[];
  evidence: string[];
  codeBlock?: string;
};

export type PromptOptimizerOptions = {
  includeDebugHeader?: boolean;
  maxEvidenceLines?: number;
};

export function buildOptimizedPrompt(
  input: PromptOptimizerInput,
  options: PromptOptimizerOptions = {}
): string {
  const maxEvidence = options.maxEvidenceLines ?? 200;
  const out: string[] = [];

  if (options.includeDebugHeader) {
    out.push('--- PROMPT OPTIMIZER (Code Coach) ---');
  }

  out.push('Objective:');
  out.push(`- ${input.task}`);
  out.push('');

  out.push('Audience:');
  out.push(`- ${input.audience}`);
  out.push('');

  out.push('Output requirements:');
  out.push(`- ${input.outputFormat}`);
  out.push('');

  if (input.style.length > 0) {
    out.push('Style:');
    for (const line of input.style) out.push(`- ${line}`);
    out.push('');
  }

  if (input.constraints.length > 0) {
    out.push('Constraints:');
    for (const line of input.constraints) out.push(`- ${line}`);
    out.push('');
  }

  if (input.evidence.length > 0) {
    out.push('Evidence:');
    const sliced = input.evidence.slice(0, maxEvidence);
    for (const line of sliced) out.push(line);
    if (input.evidence.length > maxEvidence) {
      out.push(`(Truncated ${input.evidence.length - maxEvidence} evidence lines)`);
    }
    out.push('');
  }

  if (input.codeBlock) {
    out.push('Code:');
    out.push('```');
    out.push(input.codeBlock);
    out.push('```');
  }

  return out.join('\n').trim();
}
