/**
 * Custom Model Endpoint Manager for Code Coach Enterprise
 *
 * Manages enterprise AI model endpoints:
 * - CRUD operations for endpoint configurations
 * - Health checking and testing
 * - Integration with the AI client
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  CustomEndpoint,
  EndpointType,
  EndpointHealth,
  EndpointTestResult,
  ENDPOINT_PRESETS,
  generateEndpointId,
  createEndpointFromPreset,
  validateEndpoint,
  buildEndpointUrl
} from './customEndpointTypes';
import { getSsoAuthManager } from './ssoAuth';
import { trackEvent } from '../telemetry';

const ENDPOINTS_FILE = 'endpoints.json';
const ENDPOINTS_DIR = '.code-coach';
const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface EndpointsData {
  version: number;
  endpoints: CustomEndpoint[];
  defaultEndpointId?: string;
}

/**
 * Singleton Custom Endpoint Manager
 */
export class CustomEndpointManager {
  private static instance: CustomEndpointManager | undefined;

  private context: vscode.ExtensionContext | undefined;
  private endpoints: Map<string, CustomEndpoint> = new Map();
  private healthStatus: Map<string, EndpointHealth> = new Map();
  private defaultEndpointId: string | undefined;
  private healthCheckTimer: NodeJS.Timeout | undefined;
  private fileWatcher: vscode.FileSystemWatcher | undefined;

  private onEndpointsChangedEmitter = new vscode.EventEmitter<void>();
  public readonly onEndpointsChanged = this.onEndpointsChangedEmitter.event;

  private onHealthChangedEmitter = new vscode.EventEmitter<EndpointHealth>();
  public readonly onHealthChanged = this.onHealthChangedEmitter.event;

  private constructor() {}

  public static getInstance(): CustomEndpointManager {
    if (!CustomEndpointManager.instance) {
      CustomEndpointManager.instance = new CustomEndpointManager();
    }
    return CustomEndpointManager.instance;
  }

  /**
   * Initialize the manager with extension context
   */
  public async initialize(context: vscode.ExtensionContext): Promise<void> {
    this.context = context;

    // Load endpoints from file
    await this.loadEndpoints();

    // Set up file watcher
    this.setupFileWatcher();

    // Start periodic health checks
    this.startHealthChecks();
  }

  /**
   * Get all configured endpoints
   */
  public getEndpoints(): CustomEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  /**
   * Get enabled endpoints only
   */
  public getEnabledEndpoints(): CustomEndpoint[] {
    return this.getEndpoints().filter(ep => ep.enabled);
  }

  /**
   * Get an endpoint by ID
   */
  public getEndpoint(id: string): CustomEndpoint | undefined {
    return this.endpoints.get(id);
  }

  /**
   * Get the default endpoint
   */
  public getDefaultEndpoint(): CustomEndpoint | undefined {
    if (this.defaultEndpointId) {
      return this.endpoints.get(this.defaultEndpointId);
    }
    // Return first enabled endpoint as fallback
    return this.getEnabledEndpoints()[0];
  }

  /**
   * Get endpoints by type
   */
  public getEndpointsByType(type: EndpointType): CustomEndpoint[] {
    return this.getEndpoints().filter(ep => ep.type === type);
  }

  /**
   * Get health status for an endpoint
   */
  public getHealth(endpointId: string): EndpointHealth | undefined {
    return this.healthStatus.get(endpointId);
  }

  /**
   * Add a new endpoint
   */
  public async addEndpoint(endpoint: CustomEndpoint): Promise<void> {
    // Validate
    const errors = validateEndpoint(endpoint);
    if (errors.length > 0) {
      throw new Error(`Invalid endpoint: ${errors.join(', ')}`);
    }

    // Ensure unique ID
    if (this.endpoints.has(endpoint.id)) {
      endpoint.id = generateEndpointId();
    }

    this.endpoints.set(endpoint.id, endpoint);
    await this.saveEndpoints();
    this.onEndpointsChangedEmitter.fire();

    trackEvent('enterprise.endpointAdded', {
      type: endpoint.type,
      authMethod: endpoint.auth.method
    });

    // Run health check
    await this.checkHealth(endpoint.id);
  }

  /**
   * Update an existing endpoint
   */
  public async updateEndpoint(id: string, updates: Partial<CustomEndpoint>): Promise<void> {
    const existing = this.endpoints.get(id);
    if (!existing) {
      throw new Error(`Endpoint not found: ${id}`);
    }

    const updated: CustomEndpoint = {
      ...existing,
      ...updates,
      id, // Prevent ID change
      updatedAt: new Date().toISOString()
    };

    // Validate
    const errors = validateEndpoint(updated);
    if (errors.length > 0) {
      throw new Error(`Invalid endpoint: ${errors.join(', ')}`);
    }

    this.endpoints.set(id, updated);
    await this.saveEndpoints();
    this.onEndpointsChangedEmitter.fire();

    // Run health check
    await this.checkHealth(id);
  }

  /**
   * Remove an endpoint
   */
  public async removeEndpoint(id: string): Promise<void> {
    if (!this.endpoints.has(id)) {
      return;
    }

    this.endpoints.delete(id);
    this.healthStatus.delete(id);

    if (this.defaultEndpointId === id) {
      this.defaultEndpointId = undefined;
    }

    await this.saveEndpoints();
    this.onEndpointsChangedEmitter.fire();

    trackEvent('enterprise.endpointRemoved', { id });
  }

  /**
   * Set the default endpoint
   */
  public async setDefaultEndpoint(id: string): Promise<void> {
    if (!this.endpoints.has(id)) {
      throw new Error(`Endpoint not found: ${id}`);
    }

    this.defaultEndpointId = id;
    await this.saveEndpoints();
    this.onEndpointsChangedEmitter.fire();
  }

  /**
   * Test an endpoint with a simple request
   */
  public async testEndpoint(endpointId: string): Promise<EndpointTestResult> {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) {
      return { success: false, latencyMs: 0, error: 'Endpoint not found' };
    }

    return this.doTestEndpoint(endpoint);
  }

  /**
   * Check health of an endpoint
   */
  public async checkHealth(endpointId: string): Promise<EndpointHealth> {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) {
      const health: EndpointHealth = {
        endpointId,
        status: 'unknown',
        lastChecked: new Date().toISOString(),
        error: 'Endpoint not found'
      };
      return health;
    }

    const startTime = Date.now();
    let health: EndpointHealth;

    try {
      // If custom health check URL is configured, use that
      if (endpoint.healthCheck?.url) {
        const response = await fetch(endpoint.healthCheck.url, {
          method: 'GET',
          signal: AbortSignal.timeout(endpoint.healthCheck.timeoutMs || 5000)
        });

        const expectedStatus = endpoint.healthCheck.expectedStatus || 200;
        if (response.status === expectedStatus) {
          health = {
            endpointId,
            status: 'healthy',
            lastChecked: new Date().toISOString(),
            latencyMs: Date.now() - startTime
          };
        } else {
          health = {
            endpointId,
            status: 'unhealthy',
            lastChecked: new Date().toISOString(),
            latencyMs: Date.now() - startTime,
            error: `Unexpected status: ${response.status}`
          };
        }
      } else {
        // Otherwise, try a test request
        const testResult = await this.doTestEndpoint(endpoint);
        health = {
          endpointId,
          status: testResult.success ? 'healthy' : 'unhealthy',
          lastChecked: new Date().toISOString(),
          latencyMs: testResult.latencyMs,
          error: testResult.error
        };
      }
    } catch (error) {
      health = {
        endpointId,
        status: 'unhealthy',
        lastChecked: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    this.healthStatus.set(endpointId, health);
    this.onHealthChangedEmitter.fire(health);
    return health;
  }

  /**
   * Check health of all endpoints
   */
  public async checkAllHealth(): Promise<void> {
    const endpoints = this.getEnabledEndpoints();
    await Promise.all(endpoints.map(ep => this.checkHealth(ep.id)));
  }

  /**
   * Show endpoint configuration wizard
   */
  public async showAddEndpointWizard(): Promise<CustomEndpoint | undefined> {
    // Step 1: Choose endpoint type
    const typeChoice = await vscode.window.showQuickPick(
      [
        { label: 'Azure OpenAI', description: 'Azure OpenAI Service', value: 'azure-openai' as EndpointType },
        { label: 'AWS Bedrock', description: 'Amazon Bedrock', value: 'aws-bedrock' as EndpointType },
        { label: 'Google Vertex AI', description: 'Google Cloud Vertex AI', value: 'vertex-ai' as EndpointType },
        { label: 'vLLM', description: 'Self-hosted vLLM server', value: 'vllm' as EndpointType },
        { label: 'Text Generation Inference', description: 'Hugging Face TGI', value: 'tgi' as EndpointType },
        { label: 'Ollama', description: 'Local Ollama server', value: 'ollama' as EndpointType },
        { label: 'OpenAI-Compatible', description: 'Any OpenAI-compatible API', value: 'openai-compatible' as EndpointType },
        { label: 'Anthropic-Compatible', description: 'Any Anthropic-compatible API', value: 'anthropic-compatible' as EndpointType }
      ],
      { title: 'Add Custom Endpoint', placeHolder: 'Select endpoint type' }
    );

    if (!typeChoice) {
      return undefined;
    }

    const type = typeChoice.value;
    const preset = ENDPOINT_PRESETS[type];

    // Step 2: Get endpoint name
    const name = await vscode.window.showInputBox({
      title: 'Endpoint Name',
      prompt: 'Enter a name for this endpoint',
      value: preset.name,
      validateInput: value => value.trim() ? null : 'Name is required'
    });

    if (!name) {
      return undefined;
    }

    // Step 3: Get base URL
    const baseUrl = await vscode.window.showInputBox({
      title: 'Base URL',
      prompt: 'Enter the base URL for the API',
      value: preset.baseUrl || '',
      placeHolder: 'e.g., https://your-resource.openai.azure.com',
      validateInput: value => {
        if (!value.trim()) return 'Base URL is required';
        try {
          new URL(value);
          return null;
        } catch {
          return 'Invalid URL format';
        }
      }
    });

    if (!baseUrl) {
      return undefined;
    }

    // Step 4: Get model name
    const model = await vscode.window.showInputBox({
      title: 'Model / Deployment Name',
      prompt: 'Enter the model or deployment name',
      value: preset.defaultModel || '',
      placeHolder: 'e.g., gpt-4, claude-3-sonnet, llama3.1',
      validateInput: value => value.trim() ? null : 'Model is required'
    });

    if (!model) {
      return undefined;
    }

    // Step 5: Type-specific configuration
    let endpointPath = preset.endpointPath || '/v1/chat/completions';
    let extraParams: Record<string, string> = {};

    if (type === 'azure-openai') {
      // Azure needs deployment name in path
      endpointPath = endpointPath.replace('{deployment}', model);
    } else if (type === 'aws-bedrock') {
      // AWS needs region
      const region = await vscode.window.showInputBox({
        title: 'AWS Region',
        prompt: 'Enter the AWS region',
        value: 'us-east-1',
        validateInput: value => value.trim() ? null : 'Region is required'
      });
      if (!region) return undefined;
      extraParams['region'] = region;
    } else if (type === 'vertex-ai') {
      // Vertex needs project and location
      const project = await vscode.window.showInputBox({
        title: 'GCP Project ID',
        prompt: 'Enter your GCP project ID',
        validateInput: value => value.trim() ? null : 'Project ID is required'
      });
      if (!project) return undefined;
      extraParams['project'] = project;

      const location = await vscode.window.showInputBox({
        title: 'Location',
        prompt: 'Enter the Vertex AI location',
        value: 'us-central1',
        validateInput: value => value.trim() ? null : 'Location is required'
      });
      if (!location) return undefined;
      extraParams['location'] = location;
    }

    // Create the endpoint
    const endpoint = createEndpointFromPreset(type, {
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      endpointPath,
      defaultModel: model.trim()
    });

    // Apply extra params to URLs
    if (Object.keys(extraParams).length > 0) {
      endpoint.baseUrl = buildEndpointUrl({ ...endpoint, endpointPath: '' }, extraParams);
      endpoint.endpointPath = buildEndpointUrl({ ...endpoint, baseUrl: '' }, extraParams);
    }

    // Step 6: Set API key if needed
    if (endpoint.auth.method !== 'none' && endpoint.auth.method !== 'sso-token') {
      const apiKey = await vscode.window.showInputBox({
        title: 'API Key',
        prompt: 'Enter the API key (stored securely)',
        password: true,
        validateInput: value => value.trim() ? null : 'API key is required'
      });

      if (!apiKey) {
        return undefined;
      }

      // Store API key securely
      if (this.context) {
        await this.context.secrets.store(`codeCoach.endpoint.${endpoint.id}.apiKey`, apiKey.trim());
      }
    }

    // Add the endpoint
    await this.addEndpoint(endpoint);

    vscode.window.showInformationMessage(`Endpoint "${endpoint.name}" added successfully.`);
    return endpoint;
  }

  /**
   * Get API key for an endpoint
   */
  public async getEndpointApiKey(endpointId: string): Promise<string | undefined> {
    if (!this.context) return undefined;
    return this.context.secrets.get(`codeCoach.endpoint.${endpointId}.apiKey`);
  }

  /**
   * Set API key for an endpoint
   */
  public async setEndpointApiKey(endpointId: string, apiKey: string): Promise<void> {
    if (!this.context) return;
    await this.context.secrets.store(`codeCoach.endpoint.${endpointId}.apiKey`, apiKey);
  }

  /**
   * Build headers for an endpoint request
   */
  public async buildHeaders(endpoint: CustomEndpoint): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...endpoint.extraHeaders
    };

    if (endpoint.auth.method === 'none') {
      return headers;
    }

    // Get the authentication token
    let token: string | undefined;

    if (endpoint.auth.method === 'sso-token') {
      // Use SSO session token
      const ssoManager = getSsoAuthManager();
      token = await ssoManager.getAccessToken();
    } else {
      // Use stored API key
      token = await this.getEndpointApiKey(endpoint.id);
    }

    if (token) {
      const headerName = endpoint.auth.headerName || 'Authorization';
      const prefix = endpoint.auth.tokenPrefix;
      headers[headerName] = prefix ? `${prefix} ${token}` : token;
    }

    return headers;
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
    }
    this.onEndpointsChangedEmitter.dispose();
    this.onHealthChangedEmitter.dispose();
  }

  // Private methods

  private async doTestEndpoint(endpoint: CustomEndpoint): Promise<EndpointTestResult> {
    const startTime = Date.now();

    try {
      const headers = await this.buildHeaders(endpoint);
      const url = buildEndpointUrl(endpoint, {
        model: endpoint.defaultModel,
        deployment: endpoint.defaultModel
      });

      // Build a minimal test request
      const body = this.buildTestRequestBody(endpoint);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          latencyMs,
          error: `HTTP ${response.status}: ${errorText.slice(0, 200)}`
        };
      }

      const data = await response.json() as Record<string, unknown>;
      const content = this.extractContent(endpoint, data);

      return {
        success: true,
        latencyMs,
        response: {
          model: endpoint.defaultModel,
          content: content || 'OK'
        }
      };
    } catch (error) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private buildTestRequestBody(endpoint: CustomEndpoint): Record<string, unknown> {
    const format = endpoint.requestFormat;
    const body: Record<string, unknown> = {};

    // Model
    const modelField = format?.modelField ?? 'model';
    if (modelField) {
      body[modelField] = endpoint.defaultModel;
    }

    // Messages
    const messagesField = format?.messagesField ?? 'messages';
    body[messagesField] = [
      { role: 'user', content: 'Say "OK" and nothing else.' }
    ];

    // Max tokens
    const maxTokensField = format?.maxTokensField ?? 'max_tokens';
    body[maxTokensField] = 10;

    // Temperature
    const temperatureField = format?.temperatureField ?? 'temperature';
    body[temperatureField] = 0;

    // Extra fields
    if (format?.extraFields) {
      Object.assign(body, format.extraFields);
    }

    return body;
  }

  private extractContent(endpoint: CustomEndpoint, data: Record<string, unknown>): string | undefined {
    const path = endpoint.responseFormat?.contentPath || 'choices.0.message.content';
    const parts = path.split('.');

    let current: unknown = data;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;

      // Handle array indices
      const index = parseInt(part, 10);
      if (!isNaN(index) && Array.isArray(current)) {
        current = current[index];
      } else {
        current = (current as Record<string, unknown>)[part];
      }
    }

    return typeof current === 'string' ? current : undefined;
  }

  private getEndpointsFilePath(): string | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return undefined;
    return path.join(workspaceFolder.uri.fsPath, ENDPOINTS_DIR, ENDPOINTS_FILE);
  }

  private async loadEndpoints(): Promise<void> {
    const filePath = this.getEndpointsFilePath();
    if (!filePath || !fs.existsSync(filePath)) {
      return;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content) as EndpointsData;

      this.endpoints.clear();
      for (const endpoint of data.endpoints) {
        this.endpoints.set(endpoint.id, endpoint);
      }

      this.defaultEndpointId = data.defaultEndpointId;
    } catch (error) {
      console.error('[Code Coach] Failed to load endpoints:', error);
    }
  }

  private async saveEndpoints(): Promise<void> {
    const filePath = this.getEndpointsFilePath();
    if (!filePath) return;

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data: EndpointsData = {
      version: 1,
      endpoints: Array.from(this.endpoints.values()),
      defaultEndpointId: this.defaultEndpointId
    };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  private setupFileWatcher(): void {
    const filePath = this.getEndpointsFilePath();
    if (!filePath) return;

    const dir = path.dirname(filePath);
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(dir, ENDPOINTS_FILE)
    );

    this.fileWatcher.onDidChange(() => this.loadEndpoints());
    this.fileWatcher.onDidCreate(() => this.loadEndpoints());
    this.fileWatcher.onDidDelete(() => {
      this.endpoints.clear();
      this.onEndpointsChangedEmitter.fire();
    });
  }

  private startHealthChecks(): void {
    // Initial check
    this.checkAllHealth();

    // Periodic checks
    this.healthCheckTimer = setInterval(() => {
      this.checkAllHealth();
    }, HEALTH_CHECK_INTERVAL_MS);
  }
}

/**
 * Get the custom endpoint manager singleton
 */
export function getCustomEndpointManager(): CustomEndpointManager {
  return CustomEndpointManager.getInstance();
}
