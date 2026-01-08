/**
 * Built-in Explanation Templates
 *
 * These templates ship with Code Coach and cannot be modified by users.
 * Teams can create custom templates in .code-coach/templates/*.json
 */

import { ExplanationTemplate } from './templateTypes';

/**
 * Default template - standard technical explanation
 */
const DEFAULT_TEMPLATE: ExplanationTemplate = {
    id: 'default',
    name: 'Default',
    icon: '📝',
    description: 'Standard technical explanation',
    audience: 'A software developer familiar with the language being used',
    style: [
        'Clear and concise',
        'Use proper technical terminology',
        'Explain what the code does, not just describe syntax'
    ],
    focus: [
        'What each section accomplishes',
        'Key logic and control flow',
        'Important variables and their roles'
    ],
    constraints: [
        'Cite specific line numbers for every claim',
        'Do not include code that is not in the selection',
        'Be objective and factual'
    ],
    maxLength: 'standard',
    isBuiltIn: true
};

/**
 * Junior Developer template - extra context, no assumed knowledge
 */
const JUNIOR_DEV_TEMPLATE: ExplanationTemplate = {
    id: 'junior-dev',
    name: 'Junior Developer',
    icon: '👶',
    description: 'Extra context, step-by-step breakdown, defines technical terms',
    audience: 'A developer with 0-2 years of experience who may not be familiar with advanced patterns',
    style: [
        'Step-by-step breakdown',
        'Simple vocabulary where possible',
        'Include helpful analogies when concepts are abstract',
        'Explain "why" not just "what"'
    ],
    focus: [
        'What each line or block does',
        'Why specific patterns are used',
        'Common mistakes to avoid',
        'How this code fits into the bigger picture'
    ],
    constraints: [
        'Define technical terms when first used',
        'Avoid jargon without explanation',
        'Do not assume knowledge of advanced design patterns',
        'Cite specific line numbers for every claim'
    ],
    maxLength: 'detailed',
    includeGlossary: true,
    includePrerequisites: true,
    isBuiltIn: true
};

/**
 * Code Reviewer template - focus on issues and edge cases
 */
const CODE_REVIEWER_TEMPLATE: ExplanationTemplate = {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    icon: '🔍',
    description: 'Focus on potential issues, edge cases, and improvement suggestions',
    audience: 'An experienced developer reviewing this code for correctness and quality',
    style: [
        'Critical but constructive',
        'Prioritize issues by severity',
        'Suggest specific improvements'
    ],
    focus: [
        'Potential bugs or logic errors',
        'Edge cases that may not be handled',
        'Performance implications',
        'Code clarity and maintainability',
        'Missing error handling'
    ],
    constraints: [
        'Only flag issues you are confident about',
        'Provide actionable suggestions, not just criticism',
        'Cite specific line numbers for every issue',
        'Distinguish between must-fix and nice-to-have'
    ],
    maxLength: 'detailed',
    isBuiltIn: true
};

/**
 * Security Auditor template - security-focused analysis
 */
const SECURITY_AUDITOR_TEMPLATE: ExplanationTemplate = {
    id: 'security-auditor',
    name: 'Security Auditor',
    icon: '🔒',
    description: 'Highlight security implications, vulnerabilities, and risks',
    audience: 'A security-conscious developer or security engineer',
    style: [
        'Risk-focused and specific',
        'Use OWASP terminology where applicable',
        'Prioritize by severity (Critical, High, Medium, Low)'
    ],
    focus: [
        'Input validation and sanitization',
        'Authentication and authorization checks',
        'Data exposure risks',
        'Injection vulnerabilities (SQL, XSS, command)',
        'Cryptographic issues',
        'Sensitive data handling'
    ],
    constraints: [
        'Flag potential vulnerabilities with severity levels',
        'Suggest secure alternatives',
        'Do not provide exploit code',
        'Cite specific line numbers for every finding',
        'Note if something looks safe but needs verification'
    ],
    maxLength: 'detailed',
    isBuiltIn: true
};

/**
 * Performance Analyst template - performance-focused analysis
 */
const PERFORMANCE_ANALYST_TEMPLATE: ExplanationTemplate = {
    id: 'performance-analyst',
    name: 'Performance Analyst',
    icon: '⚡',
    description: 'Analyze time/space complexity, bottlenecks, and optimization opportunities',
    audience: 'A developer concerned with performance optimization',
    style: [
        'Use Big-O notation for complexity',
        'Be specific about bottlenecks',
        'Suggest concrete optimizations'
    ],
    focus: [
        'Time complexity of algorithms',
        'Space complexity and memory usage',
        'Potential bottlenecks',
        'Unnecessary allocations or copies',
        'Opportunities for caching or memoization',
        'Database or I/O considerations'
    ],
    constraints: [
        'Only make complexity claims you can justify',
        'Consider both average and worst case',
        'Cite specific line numbers for every observation',
        'Distinguish between micro-optimizations and significant improvements'
    ],
    maxLength: 'standard',
    isBuiltIn: true
};

/**
 * Quick Summary template - one paragraph max
 */
const QUICK_SUMMARY_TEMPLATE: ExplanationTemplate = {
    id: 'quick-summary',
    name: 'Quick Summary',
    icon: '⚡',
    description: 'One paragraph summary - just the essentials',
    audience: 'A developer who needs a quick understanding',
    style: [
        'Extremely concise',
        'One paragraph maximum',
        'Focus on the main purpose'
    ],
    focus: [
        'What this code does at a high level',
        'The main inputs and outputs',
        'One key insight or caveat if critical'
    ],
    constraints: [
        'Maximum one paragraph (3-5 sentences)',
        'No detailed line-by-line breakdown',
        'Skip minor details',
        'Only mention the most important aspects'
    ],
    maxLength: 'brief',
    isBuiltIn: true
};

/**
 * Documentation Writer template - JSDoc/docstring style
 */
const DOCUMENTATION_WRITER_TEMPLATE: ExplanationTemplate = {
    id: 'documentation-writer',
    name: 'Documentation Writer',
    icon: '📚',
    description: 'Generate documentation-style explanation suitable for docstrings',
    audience: 'Someone reading API documentation or code comments',
    style: [
        'Formal documentation style',
        'Suitable for JSDoc/docstring format',
        'Include parameter and return descriptions'
    ],
    focus: [
        'Function/method purpose',
        'Parameters and their expected types/values',
        'Return value description',
        'Side effects if any',
        'Usage examples'
    ],
    constraints: [
        'Use documentation conventions (@param, @returns, etc.)',
        'Be precise about types and expected values',
        'Include one example if the function is complex',
        'Mention any important caveats or limitations'
    ],
    maxLength: 'standard',
    includeExamples: true,
    isBuiltIn: true
};

/**
 * All built-in templates
 */
export const BUILTIN_TEMPLATES: ExplanationTemplate[] = [
    DEFAULT_TEMPLATE,
    JUNIOR_DEV_TEMPLATE,
    CODE_REVIEWER_TEMPLATE,
    SECURITY_AUDITOR_TEMPLATE,
    PERFORMANCE_ANALYST_TEMPLATE,
    QUICK_SUMMARY_TEMPLATE,
    DOCUMENTATION_WRITER_TEMPLATE
];

/**
 * Get a built-in template by ID
 */
export function getBuiltInTemplate(id: string): ExplanationTemplate | undefined {
    return BUILTIN_TEMPLATES.find(t => t.id === id);
}

/**
 * Get the default template
 */
export function getDefaultTemplate(): ExplanationTemplate {
    return DEFAULT_TEMPLATE;
}
