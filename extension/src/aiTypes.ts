export type AiExplainInput = {
  kind: 'selection' | 'exception' | 'diagnostic' | 'deepDive' | 'why' | 'explain';
  languageId: string;
  code: string;
  filePath?: string;
  startLineNumber?: number;
  endLineNumber?: number;
  context?: string[];
  diagnostics?: Array<{ message: string; code?: string | number }>;
  runtime?: {
    stoppedAt?: string;
    locals?: Array<{ name: string; value: string; type?: string }>;
  };
  /** Source code for cache key generation */
  sourceCode?: string;
  /** Start line (1-indexed) for cache key */
  startLine?: number;
  /** End line (1-indexed) for cache key */
  endLine?: number;
  /** Template ID for cache key */
  templateId?: string;
};

export type AiExplainResult = {
  explanationMarkdown: string;
  claims?: {
    diagnosticCodes?: number[];
    localVariables?: string[];
  };
  confidence?: 'high' | 'medium' | 'low';
  /** Whether this result came from cache */
  cached?: boolean;
  /** Who created the cached entry */
  cachedBy?: string;
  /** When the cached entry was created */
  cachedAt?: string;
};
