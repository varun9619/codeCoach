export type PromptOptimizerInput = {
  task: string;
  audience: string;
  outputFormat: string;
  style: string[];
  constraints: string[];
  evidence: string[];
  codeBlock?: string;
};

export type PromptOptimizerMode = 'strict' | 'balanced' | 'compact';

export type PromptOptimizerOptions = {
  includeDebugHeader?: boolean;
  maxEvidenceLines?: number;
  mode?: PromptOptimizerMode;
};

export function buildOptimizedPrompt(
  input: PromptOptimizerInput,
  options: PromptOptimizerOptions = {}
): string {
  const mode: PromptOptimizerMode = options.mode ?? 'strict';
  const maxEvidence =
    options.maxEvidenceLines ?? (mode === 'compact' ? 80 : mode === 'balanced' ? 120 : 200);
  const out: string[] = [];

  if (options.includeDebugHeader) {
    out.push('--- PROMPT OPTIMIZER (Code Coach) ---');
  }

  if (mode === 'compact') {
    out.push(`Objective: ${input.task}`);
    out.push(`Audience: ${input.audience}`);
    out.push(`Output: ${input.outputFormat}`);
    if (input.style.length > 0) {
      out.push(`Style: ${input.style.join(' ')}`);
    }
    if (input.constraints.length > 0) {
      out.push(`Constraints: ${input.constraints.join(' ')}`);
    }
  } else {
    out.push('Objective:');
    out.push(`- ${input.task}`);
    out.push('');

    if (mode === 'strict') {
      out.push('Audience:');
      out.push(`- ${input.audience}`);
      out.push('');
    }

    out.push('Output requirements:');
    out.push(`- ${input.outputFormat}`);
    out.push('');

    if (mode === 'balanced') {
      out.push('Audience:');
      out.push(`- ${input.audience}`);
      out.push('');
    }
  }

  if (input.style.length > 0) {
    if (mode === 'compact') {
      // already included above
    } else {
      out.push('Style:');
      for (const line of input.style) out.push(`- ${line}`);
      out.push('');
    }
  }

  if (input.constraints.length > 0) {
    if (mode === 'compact') {
      // already included above
    } else {
      out.push('Constraints:');
      for (const line of input.constraints) out.push(`- ${line}`);
      out.push('');
    }
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
