/**
 * Explain Diff Type Definitions
 *
 * Types for parsing and explaining git diffs, commits, and PRs.
 */

/** A single file change in a diff */
export interface DiffFile {
  /** Old file path (null for new files) */
  oldPath: string | null;
  /** New file path (null for deleted files) */
  newPath: string | null;
  /** Change type */
  status: 'added' | 'deleted' | 'modified' | 'renamed' | 'copied';
  /** Lines added */
  additions: number;
  /** Lines removed */
  deletions: number;
  /** The hunks (change blocks) in this file */
  hunks: DiffHunk[];
  /** Whether this is a binary file */
  isBinary?: boolean;
}

/** A hunk (block of changes) within a file diff */
export interface DiffHunk {
  /** Starting line in old file */
  oldStart: number;
  /** Number of lines in old file */
  oldLines: number;
  /** Starting line in new file */
  newStart: number;
  /** Number of lines in new file */
  newLines: number;
  /** The actual changes */
  changes: DiffChange[];
  /** Optional header context (e.g., function name) */
  header?: string;
}

/** A single line change within a hunk */
export interface DiffChange {
  /** Change type */
  type: 'add' | 'delete' | 'context';
  /** Line content (without +/- prefix) */
  content: string;
  /** Line number in old file (for delete/context) */
  oldLine?: number;
  /** Line number in new file (for add/context) */
  newLine?: number;
}

/** Parsed diff result */
export interface ParsedDiff {
  /** All files in the diff */
  files: DiffFile[];
  /** Total additions across all files */
  totalAdditions: number;
  /** Total deletions across all files */
  totalDeletions: number;
  /** Summary statistics */
  stats: {
    filesChanged: number;
    insertions: number;
    deletions: number;
  };
}

/** Diff source type */
export type DiffSource =
  | { type: 'working'; staged: boolean }
  | { type: 'commit'; hash: string }
  | { type: 'range'; fromRef: string; toRef: string }
  | { type: 'pr'; number: number; base: string; head: string };

/** Request to explain a diff */
export interface ExplainDiffRequest {
  /** The source of the diff */
  source: DiffSource;
  /** Parsed diff data */
  diff: ParsedDiff;
  /** Repository root path */
  repoRoot: string;
  /** Optional: focus on specific files */
  focusFiles?: string[];
  /** Include potential concerns analysis */
  includeConcerns?: boolean;
}

/** A single file explanation in the diff */
export interface DiffFileExplanation {
  /** File path */
  filePath: string;
  /** Brief summary of changes */
  summary: string;
  /** Detailed changes with citations */
  changes: DiffChangeExplanation[];
}

/** Explanation of a specific change within a file */
export interface DiffChangeExplanation {
  /** Description of what changed */
  description: string;
  /** Line range in the new file (for citations) */
  lineRange?: { start: number; end: number };
  /** The change type this explains */
  changeType: 'addition' | 'modification' | 'deletion';
}

/** A potential concern identified in the diff */
export interface DiffConcern {
  /** Severity level */
  severity: 'warning' | 'info';
  /** The concern description */
  message: string;
  /** File path if applicable */
  filePath?: string;
  /** Line number if applicable */
  line?: number;
  /** Category of concern */
  category: 'security' | 'performance' | 'logic' | 'style' | 'other';
}

/** Complete diff explanation result */
export interface DiffExplanation {
  /** Overall summary of the diff */
  summary: string;
  /** Per-file explanations */
  files: DiffFileExplanation[];
  /** Potential concerns (if requested) */
  concerns?: DiffConcern[];
  /** Metadata about the explanation */
  metadata: {
    /** Total files analyzed */
    filesAnalyzed: number;
    /** Whether AI was used */
    aiUsed: boolean;
    /** Generation timestamp */
    generatedAt: string;
    /** Diff source description */
    sourceDescription: string;
  };
}

/** Configuration for diff explanation */
export interface ExplainDiffConfig {
  /** Maximum files to analyze */
  maxFiles: number;
  /** Include test files in analysis */
  includeTestFiles: boolean;
  /** Show potential concerns */
  showPotentialConcerns: boolean;
  /** Maximum lines of diff to process */
  maxDiffLines: number;
}

/** Default configuration */
export const DEFAULT_EXPLAIN_DIFF_CONFIG: ExplainDiffConfig = {
  maxFiles: 20,
  includeTestFiles: true,
  showPotentialConcerns: true,
  maxDiffLines: 5000
};
