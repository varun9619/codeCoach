import { ExplanationTemplate, TemplateContext } from './templates/templateTypes';

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

/**
 * Apply an explanation template to create a PromptOptimizerInput
 *
 * @param template The template to apply
 * @param context Context about the code being explained
 * @param baseTask The base task description (e.g., "Explain what this code does")
 * @returns A PromptOptimizerInput ready for buildOptimizedPrompt
 */
export function applyTemplate(
  template: ExplanationTemplate,
  context: TemplateContext,
  baseTask: string
): PromptOptimizerInput {
  // Build the task with focus areas
  const focusAreas = template.focus.length > 0
    ? `Focus on: ${template.focus.join(', ')}.`
    : '';

  const task = focusAreas
    ? `${baseTask} ${focusAreas}`
    : baseTask;

  // Build output format based on template settings
  const outputFormatParts: string[] = ['Markdown format with line citations'];

  if (template.maxLength === 'brief') {
    outputFormatParts.push('Keep response to one paragraph maximum');
  } else if (template.maxLength === 'detailed') {
    outputFormatParts.push('Provide detailed explanation with sections');
  }

  if (template.includeGlossary) {
    outputFormatParts.push('Include a glossary of technical terms');
  }

  if (template.includePrerequisites) {
    outputFormatParts.push('Include prerequisites section if needed');
  }

  if (template.includeExamples) {
    outputFormatParts.push('Include usage examples if helpful');
  }

  // Combine template constraints with citation requirement
  const constraints = [
    ...template.constraints,
    'Cite specific line numbers (e.g., "line 12-14") for every claim'
  ];

  // Build evidence from context
  const evidence: string[] = [];

  if (context.filePath) {
    evidence.push(`File: ${context.filePath}`);
  }

  if (context.languageId) {
    evidence.push(`Language: ${context.languageId}`);
  }

  if (context.symbolName) {
    evidence.push(`Symbol: ${context.symbolName}`);
  }

  if (context.selection) {
    evidence.push(`Lines: ${context.selection.startLine}-${context.selection.endLine}`);
  }

  if (context.diagnostics && context.diagnostics.length > 0) {
    evidence.push(`Diagnostics: ${context.diagnostics.join(', ')}`);
  }

  return {
    task,
    audience: template.audience,
    outputFormat: outputFormatParts.join('. '),
    style: template.style,
    constraints,
    evidence,
    codeBlock: context.code
  };
}

/**
 * Get the recommended PromptOptimizerMode for a template
 */
export function getPromptModeForTemplate(template: ExplanationTemplate): PromptOptimizerMode {
  if (template.maxLength === 'brief') {
    return 'compact';
  } else if (template.maxLength === 'detailed') {
    return 'strict';
  }
  return 'balanced';
}
