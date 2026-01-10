/**
 * Template Manager
 *
 * Handles loading, saving, and selecting explanation templates.
 * Templates come from two sources:
 * 1. Built-in templates (shipped with extension)
 * 2. Custom templates (stored in .code-coach/templates/*.json)
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
    ExplanationTemplate,
    TemplateConfig,
    TemplateValidationResult,
    CustomTemplateFile,
    TemplateSelection
} from './templateTypes';
import { BUILTIN_TEMPLATES, getBuiltInTemplate, getDefaultTemplate } from './builtInTemplates';
import { ConfigManager } from '../configManager';

const TEMPLATES_DIR = 'templates';
const TEMPLATE_FILE_EXTENSION = '.json';

/**
 * Template Manager singleton
 */
export class TemplateManager {
    private static instance: TemplateManager | undefined;
    private customTemplates: ExplanationTemplate[] = [];
    private recentTemplates: string[] = [];
    private fileWatcher: vscode.FileSystemWatcher | undefined;

    private constructor() {}

    public static getInstance(): TemplateManager {
        if (!TemplateManager.instance) {
            TemplateManager.instance = new TemplateManager();
        }
        return TemplateManager.instance;
    }

    /**
     * Initialize the template manager
     */
    public async initialize(context: vscode.ExtensionContext): Promise<void> {
        // Load custom templates
        await this.loadCustomTemplates();

        // Load recent templates from global state
        this.recentTemplates = context.globalState.get<string[]>('codeCoach.recentTemplates', []);

        // Set up file watcher for custom templates
        this.setupFileWatcher();
    }

    /**
     * Get all available templates (built-in + custom)
     */
    public getAllTemplates(): ExplanationTemplate[] {
        return [...BUILTIN_TEMPLATES, ...this.customTemplates];
    }

    /**
     * Get a template by ID
     */
    public getTemplate(id: string): ExplanationTemplate | undefined {
        // Check built-in first
        const builtIn = getBuiltInTemplate(id);
        if (builtIn) {
            return builtIn;
        }

        // Check custom templates
        return this.customTemplates.find(t => t.id === id);
    }

    /**
     * Get the default template based on config
     */
    public getDefaultTemplateForContext(): ExplanationTemplate {
        const config = this.getTemplateConfig();
        const template = this.getTemplate(config.default);
        return template || getDefaultTemplate();
    }

    /**
     * Get template configuration from ConfigManager
     */
    public getTemplateConfig(): TemplateConfig {
        const configManager = ConfigManager.getInstance();
        return {
            default: configManager.get<string>('templates.default', 'default'),
            showPicker: configManager.get<boolean>('templates.showPicker', true),
            customTemplatesPath: configManager.get<string>('templates.customTemplatesPath', 'templates'),
            recentTemplates: this.recentTemplates,
            maxRecentTemplates: configManager.get<number>('templates.maxRecentTemplates', 5)
        };
    }

    /**
     * Show template picker and return selected template
     */
    public async pickTemplate(context: vscode.ExtensionContext): Promise<TemplateSelection | undefined> {
        const templates = this.getAllTemplates();
        const config = this.getTemplateConfig();

        // Sort: recent first, then built-in, then custom
        const sortedTemplates = this.sortTemplatesForPicker(templates);

        const items: (vscode.QuickPickItem & { template: ExplanationTemplate })[] = sortedTemplates.map(t => ({
            label: `${t.icon} ${t.name}`,
            description: t.isBuiltIn ? 'Built-in' : 'Custom',
            detail: t.description,
            template: t
        }));

        // Add "Create new template" option
        const createOption: vscode.QuickPickItem = {
            label: '$(add) Create New Template...',
            description: '',
            detail: 'Create a custom template for your team'
        };

        const picked = await vscode.window.showQuickPick(
            [...items, createOption as any],
            {
                title: 'Select Explanation Template',
                placeHolder: 'Choose how you want the code explained',
                matchOnDescription: true,
                matchOnDetail: true
            }
        );

        if (!picked) {
            return undefined;
        }

        // Handle "Create new template"
        if (picked.label.includes('Create New Template')) {
            await this.createTemplateWizard();
            return undefined;
        }

        const selectedTemplate = (picked as any).template as ExplanationTemplate;

        // Update recent templates
        await this.addToRecentTemplates(selectedTemplate.id, context);

        return {
            template: selectedTemplate,
            remember: false // Could add a checkbox to the picker
        };
    }

    /**
     * Load custom templates from .code-coach/templates/
     */
    public async loadCustomTemplates(): Promise<void> {
        this.customTemplates = [];

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const templatesPath = path.join(
            workspaceFolder.uri.fsPath,
            '.code-coach',
            TEMPLATES_DIR
        );

        if (!fs.existsSync(templatesPath)) {
            return;
        }

        try {
            const files = fs.readdirSync(templatesPath);
            for (const file of files) {
                if (!file.endsWith(TEMPLATE_FILE_EXTENSION)) {
                    continue;
                }

                const filePath = path.join(templatesPath, file);
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const parsed = JSON.parse(content) as CustomTemplateFile;

                    const validation = this.validateTemplate(parsed.template);
                    if (validation.valid) {
                        this.customTemplates.push({
                            ...parsed.template,
                            isBuiltIn: false
                        });
                    } else {
                        console.warn(`Invalid template ${file}:`, validation.errors);
                    }
                } catch (err) {
                    console.warn(`Failed to load template ${file}:`, err);
                }
            }
        } catch (err) {
            console.warn('Failed to read templates directory:', err);
        }
    }

    /**
     * Save a custom template
     */
    public async saveCustomTemplate(template: Omit<ExplanationTemplate, 'isBuiltIn'>): Promise<string> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder open');
        }

        const templatesPath = path.join(
            workspaceFolder.uri.fsPath,
            '.code-coach',
            TEMPLATES_DIR
        );

        // Ensure directory exists
        if (!fs.existsSync(templatesPath)) {
            fs.mkdirSync(templatesPath, { recursive: true });
        }

        const fileName = `${template.id}${TEMPLATE_FILE_EXTENSION}`;
        const filePath = path.join(templatesPath, fileName);

        const fileContent: CustomTemplateFile = {
            version: 1,
            template
        };

        fs.writeFileSync(filePath, JSON.stringify(fileContent, null, 2), 'utf8');

        // Reload custom templates
        await this.loadCustomTemplates();

        return filePath;
    }

    /**
     * Delete a custom template
     */
    public async deleteCustomTemplate(id: string): Promise<boolean> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return false;
        }

        const filePath = path.join(
            workspaceFolder.uri.fsPath,
            '.code-coach',
            TEMPLATES_DIR,
            `${id}${TEMPLATE_FILE_EXTENSION}`
        );

        if (!fs.existsSync(filePath)) {
            return false;
        }

        fs.unlinkSync(filePath);
        await this.loadCustomTemplates();
        return true;
    }

    /**
     * Validate a template
     */
    public validateTemplate(template: Partial<ExplanationTemplate>): TemplateValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Required fields
        if (!template.id || typeof template.id !== 'string') {
            errors.push('Template must have a string "id"');
        } else if (!/^[a-z0-9-]+$/.test(template.id)) {
            errors.push('Template ID must be lowercase alphanumeric with hyphens');
        }

        if (!template.name || typeof template.name !== 'string') {
            errors.push('Template must have a string "name"');
        }

        if (!template.audience || typeof template.audience !== 'string') {
            errors.push('Template must have a string "audience"');
        }

        if (!Array.isArray(template.style) || template.style.length === 0) {
            errors.push('Template must have a non-empty "style" array');
        }

        if (!Array.isArray(template.focus) || template.focus.length === 0) {
            errors.push('Template must have a non-empty "focus" array');
        }

        if (!Array.isArray(template.constraints) || template.constraints.length === 0) {
            errors.push('Template must have a non-empty "constraints" array');
        }

        // Check for ID collision with built-in templates
        if (template.id && getBuiltInTemplate(template.id)) {
            errors.push(`Template ID "${template.id}" conflicts with a built-in template`);
        }

        // Warnings
        if (!template.icon) {
            warnings.push('Template has no icon - will use default');
        }

        if (!template.description) {
            warnings.push('Template has no description - may be unclear in picker');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Create a template via wizard
     */
    public async createTemplateWizard(): Promise<ExplanationTemplate | undefined> {
        // Step 1: Get template ID
        const id = await vscode.window.showInputBox({
            title: 'Create Template (1/5): ID',
            prompt: 'Enter a unique ID for your template (lowercase, hyphens allowed)',
            placeHolder: 'e.g., my-team-template',
            validateInput: (value) => {
                if (!/^[a-z0-9-]+$/.test(value)) {
                    return 'ID must be lowercase alphanumeric with hyphens';
                }
                if (this.getTemplate(value)) {
                    return 'A template with this ID already exists';
                }
                return undefined;
            }
        });

        if (!id) {
            return undefined;
        }

        // Step 2: Get name
        const name = await vscode.window.showInputBox({
            title: 'Create Template (2/5): Name',
            prompt: 'Enter a display name for your template',
            placeHolder: 'e.g., My Team Template'
        });

        if (!name) {
            return undefined;
        }

        // Step 3: Get description
        const description = await vscode.window.showInputBox({
            title: 'Create Template (3/5): Description',
            prompt: 'Describe what this template does',
            placeHolder: 'e.g., Explains code with focus on our team conventions'
        });

        if (!description) {
            return undefined;
        }

        // Step 4: Get audience
        const audience = await vscode.window.showInputBox({
            title: 'Create Template (4/5): Audience',
            prompt: 'Describe who this explanation is for',
            placeHolder: 'e.g., A developer familiar with our authentication system'
        });

        if (!audience) {
            return undefined;
        }

        // Step 5: Select base template to start from
        const baseTemplates = BUILTIN_TEMPLATES.map(t => ({
            label: `${t.icon} ${t.name}`,
            description: 'Start from this template',
            template: t
        }));

        const baseChoice = await vscode.window.showQuickPick(baseTemplates, {
            title: 'Create Template (5/5): Base Template',
            placeHolder: 'Select a template to base yours on'
        });

        if (!baseChoice) {
            return undefined;
        }

        const baseTemplate = baseChoice.template;

        // Create the new template
        const newTemplate: ExplanationTemplate = {
            id,
            name,
            icon: '🏷️', // Default icon for custom templates
            description,
            author: 'custom',
            createdAt: new Date().toISOString(),
            audience,
            style: [...baseTemplate.style],
            focus: [...baseTemplate.focus],
            constraints: [...baseTemplate.constraints],
            maxLength: baseTemplate.maxLength,
            includeExamples: baseTemplate.includeExamples,
            includeGlossary: baseTemplate.includeGlossary,
            includePrerequisites: baseTemplate.includePrerequisites,
            isBuiltIn: false
        };

        // Save and open for editing
        const filePath = await this.saveCustomTemplate(newTemplate);

        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);

        vscode.window.showInformationMessage(
            `Template "${name}" created! Edit the file to customize style, focus, and constraints.`
        );

        return newTemplate;
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this.fileWatcher?.dispose();
    }

    // Private methods

    private sortTemplatesForPicker(templates: ExplanationTemplate[]): ExplanationTemplate[] {
        return templates.sort((a, b) => {
            // Recent templates first
            const aRecent = this.recentTemplates.indexOf(a.id);
            const bRecent = this.recentTemplates.indexOf(b.id);

            if (aRecent !== -1 && bRecent === -1) return -1;
            if (aRecent === -1 && bRecent !== -1) return 1;
            if (aRecent !== -1 && bRecent !== -1) return aRecent - bRecent;

            // Then built-in before custom
            if (a.isBuiltIn && !b.isBuiltIn) return -1;
            if (!a.isBuiltIn && b.isBuiltIn) return 1;

            // Finally alphabetically
            return a.name.localeCompare(b.name);
        });
    }

    private async addToRecentTemplates(id: string, context: vscode.ExtensionContext): Promise<void> {
        const config = this.getTemplateConfig();
        const maxRecent = config.maxRecentTemplates || 5;

        // Remove if already in recent
        this.recentTemplates = this.recentTemplates.filter(t => t !== id);

        // Add to front
        this.recentTemplates.unshift(id);

        // Trim to max
        this.recentTemplates = this.recentTemplates.slice(0, maxRecent);

        // Save
        await context.globalState.update('codeCoach.recentTemplates', this.recentTemplates);
    }

    private setupFileWatcher(): void {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const templatesPath = path.join(
            workspaceFolder.uri.fsPath,
            '.code-coach',
            TEMPLATES_DIR
        );

        this.fileWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(templatesPath, '*.json')
        );

        this.fileWatcher.onDidChange(() => this.loadCustomTemplates());
        this.fileWatcher.onDidCreate(() => this.loadCustomTemplates());
        this.fileWatcher.onDidDelete(() => this.loadCustomTemplates());
    }
}

/**
 * Get the template manager singleton
 */
export function getTemplateManager(): TemplateManager {
    return TemplateManager.getInstance();
}
