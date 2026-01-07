/**
 * ConfigManager: Cascading configuration system for Code Coach
 *
 * Resolution order (highest wins):
 * 1. VS Code Settings → for sensitive/personal settings only
 * 2. Project config → .code-coach/config.json
 * 3. Global config → ~/.code-coach/config.json
 * 4. Package.json defaults
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Keys that should NEVER be stored in config files (security-sensitive)
const VSCODE_ONLY_KEYS = new Set([
    'ai.baseUrl',
    'ai.endpointPath',
    'ai.authHeader',
    'ai.authScheme',
    'ai.extraHeaders',
    'ai.openrouter.referer',
    'ai.openrouter.title',
    'ai.promptDebug',
    'ai.strictJson',
    'runtime.enabled',
    'runtime.autoExplainOnException',
    'runtime.maxVariables',
    'telemetry.enabled'
]);

// Keys that CAN be stored in config files (shareable)
const SHAREABLE_KEYS = new Set([
    'ai.enabled',
    'ai.provider',
    'ai.model',
    'ai.responseStyle',
    'ai.temperature',
    'ai.maxTokens',
    'ai.promptOptimizer',
    'ai.promptOptimizerMode',
    'privacy.mode',
    'privacy.allowedDomains',
    'privacy.redactPatterns',
    'privacy.maxContextChars',
    'ui.explainSelection',
    'ui.explainWhyWorks',
    'ui.explainDiagnostic',
    'ui.traceDiagnosticOrigin',
    'ui.runtimeException',
    'ui.codeSmells',
    'ui.testGaps',
    'deepDive.sections',
    'deepDive.aiSummary',
    'deepDive.historyLimit',
    'performance.prewarmSymbols',
    'performance.prewarmFileLimit',
    'performance.prewarmDelayMs',
    'performance.prewarmGlob',
    'performance.prewarmExclude',
    'coachMode.enabled',
    'coachMode.maxHints',
    'testGaps.coveragePaths',
    'enterprise.allowedAiProviders',
    'enterprise.auditLogPath'
]);

export interface CodeCoachConfig {
    version: number;
    ai?: {
        enabled?: boolean;
        provider?: string;
        model?: string;
        responseStyle?: string;
        temperature?: number;
        maxTokens?: number;
        promptOptimizer?: boolean;
        promptOptimizerMode?: string;
    };
    privacy?: {
        mode?: string;
        allowedDomains?: string[];
        redactPatterns?: string[];
        maxContextChars?: number;
    };
    ui?: {
        explainSelection?: string;
        explainWhyWorks?: string;
        explainDiagnostic?: string;
        traceDiagnosticOrigin?: string;
        runtimeException?: string;
        codeSmells?: string;
        testGaps?: string;
    };
    deepDive?: {
        sections?: string[];
        aiSummary?: boolean;
        historyLimit?: number;
    };
    performance?: {
        prewarmSymbols?: boolean;
        prewarmFileLimit?: number;
        prewarmDelayMs?: number;
        prewarmGlob?: string[];
        prewarmExclude?: string;
    };
    coachMode?: {
        enabled?: boolean;
        maxHints?: number;
    };
    testGaps?: {
        coveragePaths?: string[];
    };
    enterprise?: {
        allowedAiProviders?: string[];
        auditLogPath?: string;
    };
}

export interface ConfigValidationError {
    key: string;
    message: string;
    severity: 'error' | 'warning';
}

export type ConfigTemplate = 'minimal' | 'team-standard' | 'enterprise' | 'copy-global';

const CONFIG_DIR_NAME = '.code-coach';
const CONFIG_FILE_NAME = 'config.json';

export class ConfigManager {
    private static instance: ConfigManager | undefined;

    private globalConfigPath: string;
    private projectConfigPath: string | undefined;
    private globalConfig: CodeCoachConfig | undefined;
    private projectConfig: CodeCoachConfig | undefined;
    private fileWatchers: vscode.FileSystemWatcher[] = [];
    private context: vscode.ExtensionContext | undefined;
    private onConfigChangedEmitter = new vscode.EventEmitter<void>();

    public readonly onConfigChanged = this.onConfigChangedEmitter.event;

    private constructor() {
        this.globalConfigPath = path.join(os.homedir(), CONFIG_DIR_NAME, CONFIG_FILE_NAME);
    }

    public static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    /**
     * Initialize the ConfigManager with the extension context
     */
    public async initialize(context: vscode.ExtensionContext): Promise<void> {
        this.context = context;

        // Determine project config path
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            this.projectConfigPath = path.join(
                workspaceFolder.uri.fsPath,
                CONFIG_DIR_NAME,
                CONFIG_FILE_NAME
            );
        }

        // Load configs
        await this.reload();

        // Set up file watchers
        this.setupFileWatchers();
    }

    /**
     * Reload all configuration files
     */
    public async reload(): Promise<void> {
        this.globalConfig = await this.loadConfigFile(this.globalConfigPath);

        if (this.projectConfigPath) {
            this.projectConfig = await this.loadConfigFile(this.projectConfigPath);
        }

        this.onConfigChangedEmitter.fire();
    }

    /**
     * Get a configuration value with cascading resolution
     */
    public get<T>(key: string, defaultValue?: T): T {
        // For VS Code-only keys, always use VS Code settings
        if (VSCODE_ONLY_KEYS.has(key)) {
            return this.getVSCodeSetting<T>(`codeCoach.${key}`, defaultValue as T);
        }

        // Cascading resolution: project → global → VS Code → default
        const projectValue = this.getNestedValue(this.projectConfig, key);
        if (projectValue !== undefined) {
            return projectValue as T;
        }

        const globalValue = this.getNestedValue(this.globalConfig, key);
        if (globalValue !== undefined) {
            return globalValue as T;
        }

        // Fall back to VS Code settings
        return this.getVSCodeSetting<T>(`codeCoach.${key}`, defaultValue as T);
    }

    /**
     * Check if a project config file exists
     */
    public hasProjectConfig(): boolean {
        return this.projectConfigPath !== undefined &&
               fs.existsSync(this.projectConfigPath);
    }

    /**
     * Check if a global config file exists
     */
    public hasGlobalConfig(): boolean {
        return fs.existsSync(this.globalConfigPath);
    }

    /**
     * Get the path to the project config
     */
    public getProjectConfigPath(): string | undefined {
        return this.projectConfigPath;
    }

    /**
     * Get the path to the global config
     */
    public getGlobalConfigPath(): string {
        return this.globalConfigPath;
    }

    /**
     * Create a config file from a template
     */
    public async createConfig(
        location: 'project' | 'global',
        template: ConfigTemplate,
        privacyMode?: string
    ): Promise<string> {
        const configPath = location === 'project'
            ? this.projectConfigPath
            : this.globalConfigPath;

        if (!configPath) {
            throw new Error('No workspace folder open');
        }

        // Ensure directory exists
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        // Generate config from template
        const config = this.generateConfigFromTemplate(template, privacyMode);

        // Write config file
        fs.writeFileSync(
            configPath,
            JSON.stringify(config, null, 2),
            'utf8'
        );

        // Reload configs
        await this.reload();

        return configPath;
    }

    /**
     * Reset project config to defaults
     */
    public async resetProjectConfig(): Promise<void> {
        if (!this.projectConfigPath) {
            throw new Error('No workspace folder open');
        }

        if (fs.existsSync(this.projectConfigPath)) {
            fs.unlinkSync(this.projectConfigPath);
        }

        this.projectConfig = undefined;
        this.onConfigChangedEmitter.fire();
    }

    /**
     * Get the merged/resolved config (for debugging)
     */
    public getResolvedConfig(): Record<string, unknown> {
        const resolved: Record<string, unknown> = {};

        for (const key of SHAREABLE_KEYS) {
            resolved[key] = this.get(key);
        }

        return resolved;
    }

    /**
     * Validate a config file
     */
    public validateConfig(config: CodeCoachConfig): ConfigValidationError[] {
        const errors: ConfigValidationError[] = [];

        // Check version
        if (config.version !== undefined && config.version !== 1) {
            errors.push({
                key: 'version',
                message: `Unsupported config version: ${config.version}. Expected: 1`,
                severity: 'error'
            });
        }

        // Validate AI settings
        if (config.ai) {
            if (config.ai.provider && !['openrouter', 'openai', 'anthropic', 'gemini', 'ollama', 'lmstudio'].includes(config.ai.provider)) {
                errors.push({
                    key: 'ai.provider',
                    message: `Invalid provider: ${config.ai.provider}`,
                    severity: 'error'
                });
            }

            if (config.ai.temperature !== undefined && (config.ai.temperature < 0 || config.ai.temperature > 2)) {
                errors.push({
                    key: 'ai.temperature',
                    message: `Temperature must be between 0 and 2`,
                    severity: 'error'
                });
            }

            if (config.ai.maxTokens !== undefined && (config.ai.maxTokens < 64 || config.ai.maxTokens > 4000)) {
                errors.push({
                    key: 'ai.maxTokens',
                    message: `maxTokens must be between 64 and 4000`,
                    severity: 'error'
                });
            }

            if (config.ai.responseStyle && !['concise', 'detailed'].includes(config.ai.responseStyle)) {
                errors.push({
                    key: 'ai.responseStyle',
                    message: `Invalid responseStyle: ${config.ai.responseStyle}`,
                    severity: 'error'
                });
            }

            if (config.ai.promptOptimizerMode && !['strict', 'balanced', 'compact'].includes(config.ai.promptOptimizerMode)) {
                errors.push({
                    key: 'ai.promptOptimizerMode',
                    message: `Invalid promptOptimizerMode: ${config.ai.promptOptimizerMode}`,
                    severity: 'error'
                });
            }
        }

        // Validate privacy settings
        if (config.privacy) {
            if (config.privacy.mode && !['offline', 'local', 'redacted', 'full'].includes(config.privacy.mode)) {
                errors.push({
                    key: 'privacy.mode',
                    message: `Invalid privacy mode: ${config.privacy.mode}`,
                    severity: 'error'
                });
            }

            if (config.privacy.maxContextChars !== undefined &&
                (config.privacy.maxContextChars < 500 || config.privacy.maxContextChars > 50000)) {
                errors.push({
                    key: 'privacy.maxContextChars',
                    message: `maxContextChars must be between 500 and 50000`,
                    severity: 'error'
                });
            }
        }

        // Validate UI settings
        if (config.ui) {
            const validUISurfaces = ['output', 'panel', 'peek'];
            for (const [key, value] of Object.entries(config.ui)) {
                if (value && !validUISurfaces.includes(value)) {
                    errors.push({
                        key: `ui.${key}`,
                        message: `Invalid UI surface: ${value}`,
                        severity: 'error'
                    });
                }
            }
        }

        // Validate deepDive settings
        if (config.deepDive) {
            if (config.deepDive.historyLimit !== undefined &&
                (config.deepDive.historyLimit < 1 || config.deepDive.historyLimit > 30)) {
                errors.push({
                    key: 'deepDive.historyLimit',
                    message: `historyLimit must be between 1 and 30`,
                    severity: 'error'
                });
            }

            if (config.deepDive.sections) {
                const validSections = ['overview', 'usages', 'blame', 'history', 'summary', 'tests', 'coverage'];
                for (const section of config.deepDive.sections) {
                    if (!validSections.includes(section)) {
                        errors.push({
                            key: 'deepDive.sections',
                            message: `Invalid section: ${section}`,
                            severity: 'warning'
                        });
                    }
                }
            }
        }

        // Validate performance settings
        if (config.performance) {
            if (config.performance.prewarmFileLimit !== undefined &&
                (config.performance.prewarmFileLimit < 10 || config.performance.prewarmFileLimit > 2000)) {
                errors.push({
                    key: 'performance.prewarmFileLimit',
                    message: `prewarmFileLimit must be between 10 and 2000`,
                    severity: 'error'
                });
            }

            if (config.performance.prewarmDelayMs !== undefined &&
                (config.performance.prewarmDelayMs < 0 || config.performance.prewarmDelayMs > 60000)) {
                errors.push({
                    key: 'performance.prewarmDelayMs',
                    message: `prewarmDelayMs must be between 0 and 60000`,
                    severity: 'error'
                });
            }
        }

        // Validate coachMode settings
        if (config.coachMode) {
            if (config.coachMode.maxHints !== undefined &&
                (config.coachMode.maxHints < 5 || config.coachMode.maxHints > 200)) {
                errors.push({
                    key: 'coachMode.maxHints',
                    message: `maxHints must be between 5 and 200`,
                    severity: 'error'
                });
            }
        }

        return errors;
    }

    /**
     * Validate the current project config file
     */
    public async validateProjectConfig(): Promise<ConfigValidationError[]> {
        if (!this.projectConfig) {
            return [{
                key: '',
                message: 'No project config file found',
                severity: 'warning'
            }];
        }
        return this.validateConfig(this.projectConfig);
    }

    /**
     * Validate the current global config file
     */
    public async validateGlobalConfig(): Promise<ConfigValidationError[]> {
        if (!this.globalConfig) {
            return [{
                key: '',
                message: 'No global config file found',
                severity: 'warning'
            }];
        }
        return this.validateConfig(this.globalConfig);
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        for (const watcher of this.fileWatchers) {
            watcher.dispose();
        }
        this.fileWatchers = [];
        this.onConfigChangedEmitter.dispose();
    }

    // Private helper methods

    private async loadConfigFile(configPath: string): Promise<CodeCoachConfig | undefined> {
        try {
            if (!fs.existsSync(configPath)) {
                return undefined;
            }

            const content = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(content) as CodeCoachConfig;

            // Validate on load
            const errors = this.validateConfig(config);
            const criticalErrors = errors.filter(e => e.severity === 'error');

            if (criticalErrors.length > 0) {
                const errorMessages = criticalErrors.map(e => `${e.key}: ${e.message}`).join('\n');
                vscode.window.showWarningMessage(
                    `Code Coach config has errors:\n${errorMessages}`,
                    'Open Config'
                ).then(selection => {
                    if (selection === 'Open Config') {
                        vscode.workspace.openTextDocument(configPath)
                            .then(doc => vscode.window.showTextDocument(doc));
                    }
                });
            }

            return config;
        } catch (error) {
            if (error instanceof SyntaxError) {
                vscode.window.showErrorMessage(
                    `Invalid JSON in Code Coach config: ${configPath}`,
                    'Open Config'
                ).then(selection => {
                    if (selection === 'Open Config') {
                        vscode.workspace.openTextDocument(configPath)
                            .then(doc => vscode.window.showTextDocument(doc));
                    }
                });
            }
            return undefined;
        }
    }

    private setupFileWatchers(): void {
        // Watch global config
        const globalWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(
                path.dirname(this.globalConfigPath),
                CONFIG_FILE_NAME
            )
        );

        globalWatcher.onDidChange(() => this.reload());
        globalWatcher.onDidCreate(() => this.reload());
        globalWatcher.onDidDelete(() => this.reload());
        this.fileWatchers.push(globalWatcher);

        // Watch project config
        if (this.projectConfigPath) {
            const projectDir = path.dirname(this.projectConfigPath);
            const projectWatcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(projectDir, CONFIG_FILE_NAME)
            );

            projectWatcher.onDidChange(() => this.reload());
            projectWatcher.onDidCreate(() => this.reload());
            projectWatcher.onDidDelete(() => this.reload());
            this.fileWatchers.push(projectWatcher);
        }
    }

    private getVSCodeSetting<T>(key: string, defaultValue: T): T {
        const config = vscode.workspace.getConfiguration();
        return config.get<T>(key, defaultValue);
    }

    private getNestedValue(obj: CodeCoachConfig | undefined, key: string): unknown {
        if (!obj) {
            return undefined;
        }

        const parts = key.split('.');
        let current: unknown = obj;

        for (const part of parts) {
            if (current === null || current === undefined || typeof current !== 'object') {
                return undefined;
            }
            current = (current as Record<string, unknown>)[part];
        }

        return current;
    }

    private generateConfigFromTemplate(
        template: ConfigTemplate,
        privacyMode?: string
    ): CodeCoachConfig {
        const base: CodeCoachConfig = {
            version: 1
        };

        switch (template) {
            case 'minimal':
                return {
                    ...base,
                    ai: {
                        enabled: false
                    },
                    privacy: {
                        mode: privacyMode || 'offline'
                    }
                };

            case 'team-standard':
                return {
                    ...base,
                    ai: {
                        enabled: true,
                        provider: 'openrouter',
                        responseStyle: 'concise',
                        temperature: 0.2,
                        maxTokens: 800
                    },
                    privacy: {
                        mode: privacyMode || 'redacted',
                        redactPatterns: [
                            'API_KEY=.*',
                            'SECRET=.*',
                            'PASSWORD=.*',
                            'TOKEN=.*'
                        ]
                    },
                    ui: {
                        explainSelection: 'panel',
                        explainDiagnostic: 'panel'
                    },
                    deepDive: {
                        aiSummary: true,
                        historyLimit: 10
                    }
                };

            case 'enterprise':
                return {
                    ...base,
                    ai: {
                        enabled: true,
                        provider: 'openrouter',
                        responseStyle: 'detailed',
                        temperature: 0.1,
                        maxTokens: 1200,
                        promptOptimizer: true,
                        promptOptimizerMode: 'strict'
                    },
                    privacy: {
                        mode: privacyMode || 'redacted',
                        redactPatterns: [
                            'API_KEY=.*',
                            'SECRET=.*',
                            'PASSWORD=.*',
                            'TOKEN=.*',
                            'PRIVATE_KEY=.*',
                            'CREDENTIAL=.*'
                        ],
                        maxContextChars: 8000
                    },
                    ui: {
                        explainSelection: 'panel',
                        explainWhyWorks: 'panel',
                        explainDiagnostic: 'panel',
                        traceDiagnosticOrigin: 'panel',
                        codeSmells: 'panel',
                        testGaps: 'panel'
                    },
                    deepDive: {
                        aiSummary: true,
                        historyLimit: 20
                    },
                    performance: {
                        prewarmSymbols: true,
                        prewarmFileLimit: 500
                    },
                    enterprise: {
                        allowedAiProviders: ['openrouter', 'anthropic', 'openai']
                    }
                };

            case 'copy-global':
                if (this.globalConfig) {
                    return { ...this.globalConfig };
                }
                // Fall back to team-standard if no global config
                return this.generateConfigFromTemplate('team-standard', privacyMode);

            default:
                return base;
        }
    }
}

// Export singleton getter for convenience
export function getConfigManager(): ConfigManager {
    return ConfigManager.getInstance();
}
