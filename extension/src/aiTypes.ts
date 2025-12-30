export type AiExplainInput = {
  kind: 'selection' | 'exception' | 'deepDive' | 'why';
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
};

export type AiExplainResult = {
  explanationMarkdown: string;
  claims?: {
    diagnosticCodes?: number[];
    localVariables?: string[];
  };
  confidence?: 'high' | 'medium' | 'low';
};
