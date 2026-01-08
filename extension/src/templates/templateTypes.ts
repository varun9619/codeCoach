/**
 * Template Types for Code Coach Explanation Templates
 *
 * Templates customize AI explanations for different audiences and purposes.
 * Built-in templates are provided, and teams can create custom templates
 * stored in .code-coach/templates/*.json (git-tracked).
 */

/**
 * An explanation template that customizes AI output for a specific audience/purpose.
 */
export interface ExplanationTemplate {
    /** Unique identifier (e.g., 'junior-dev', 'security-audit') */
    id: string;

    /** Display name shown in picker (e.g., 'Junior Developer') */
    name: string;

    /** Icon shown in picker (emoji) */
    icon: string;

    /** Brief description of what this template does */
    description: string;

    /** Who created this template (for custom templates) */
    author?: string;

    /** When this template was created (ISO 8601) */
    createdAt?: string;

    /** Target audience description for the AI */
    audience: string;

    /** Style guidelines for the explanation */
    style: string[];

    /** What aspects to focus on */
    focus: string[];

    /** Constraints or things to avoid */
    constraints: string[];

    /** Optional: maximum response length hint */
    maxLength?: 'brief' | 'standard' | 'detailed';

    /** Optional: include code examples in explanation */
    includeExamples?: boolean;

    /** Optional: include glossary of terms */
    includeGlossary?: boolean;

    /** Optional: include prerequisites section */
    includePrerequisites?: boolean;

    /** Whether this is a built-in template (not user-editable) */
    isBuiltIn?: boolean;
}

/**
 * Template selection result from the quick pick.
 */
export interface TemplateSelection {
    /** Selected template */
    template: ExplanationTemplate;

    /** Whether to remember this choice for future explains */
    remember: boolean;
}

/**
 * Context passed to template when generating explanation.
 */
export interface TemplateContext {
    /** The code being explained */
    code: string;

    /** Language ID (typescript, javascript, python, etc.) */
    languageId: string;

    /** File path */
    filePath: string;

    /** Selection range */
    selection: {
        startLine: number;
        endLine: number;
    };

    /** Any diagnostics in the selection */
    diagnostics?: string[];

    /** Symbol name if applicable */
    symbolName?: string;
}

/**
 * Template configuration stored in .code-coach/config.json
 */
export interface TemplateConfig {
    /** Default template ID to use */
    default: string;

    /** Whether to show template picker on every explain */
    showPicker: boolean;

    /** Path to custom templates directory (relative to .code-coach/) */
    customTemplatesPath: string;

    /** Recently used templates (for quick access) */
    recentTemplates?: string[];

    /** Maximum recent templates to remember */
    maxRecentTemplates?: number;
}

/**
 * Custom template file format (.code-coach/templates/*.json)
 */
export interface CustomTemplateFile {
    /** Schema version */
    version: 1;

    /** The template definition */
    template: Omit<ExplanationTemplate, 'isBuiltIn'>;
}

/**
 * Template validation result
 */
export interface TemplateValidationResult {
    /** Whether the template is valid */
    valid: boolean;

    /** Validation errors */
    errors: string[];

    /** Validation warnings */
    warnings: string[];
}
