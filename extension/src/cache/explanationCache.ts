/**
 * Explanation Cache Manager
 *
 * Caches AI-generated explanations to reduce API calls and share
 * insights across the team. Cache entries are keyed by:
 * - File path hash
 * - Line range
 * - Template ID
 * - Privacy mode
 * - Source code hash (for invalidation)
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  CacheEntry,
  CacheFile,
  CacheConfig,
  CacheLookupRequest,
  CacheStoreRequest,
  CacheLookupResult,
  DEFAULT_CACHE_CONFIG,
  generateCacheKey,
  createCacheEntry,
  isExpired,
  sourceMatches,
  createEmptyCacheFile,
  formatCacheEntryLabel
} from './cacheTypes';

const CODE_COACH_DIR = '.code-coach';
const CACHE_DIR = 'cache';
const CACHE_FILE = 'explanations.json';

/**
 * ExplanationCache - Manages cached AI explanations
 */
export class ExplanationCache {
  private static instance: ExplanationCache | undefined;
  private cache: Map<string, CacheEntry> = new Map();
  private metadata = { totalHits: 0, totalMisses: 0, lastCleanupAt: undefined as string | undefined };
  private config: CacheConfig = DEFAULT_CACHE_CONFIG;
  private watcher: vscode.FileSystemWatcher | undefined;
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onCacheChanged = this.emitter.event;
  private cleanupInterval: NodeJS.Timeout | undefined;

  private constructor() {}

  static getInstance(): ExplanationCache {
    if (!ExplanationCache.instance) {
      ExplanationCache.instance = new ExplanationCache();
    }
    return ExplanationCache.instance;
  }

  async initialize(context: vscode.ExtensionContext): Promise<void> {
    await this.loadCache();
    this.loadConfig();

    // Watch for external changes to cache file
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const pattern = new vscode.RelativePattern(
        workspaceFolder,
        `${CODE_COACH_DIR}/${CACHE_DIR}/${CACHE_FILE}`
      );
      this.watcher = vscode.workspace.createFileSystemWatcher(pattern);

      this.watcher.onDidChange(() => this.loadCache());
      this.watcher.onDidCreate(() => this.loadCache());
      this.watcher.onDidDelete(() => {
        this.cache.clear();
        this.emitter.fire();
      });

      context.subscriptions.push(this.watcher);
    }

    // Set up periodic cleanup (every hour)
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);

    // Initial cleanup
    this.cleanup();
  }

  dispose(): void {
    this.watcher?.dispose();
    this.emitter.dispose();
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Update cache configuration
   */
  setConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current cache configuration
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Look up an explanation in the cache
   */
  lookup(request: CacheLookupRequest): CacheLookupResult {
    if (!this.config.enabled) {
      return { hit: false, key: generateCacheKey(request) };
    }

    const key = generateCacheKey(request);
    const entry = this.cache.get(key);

    if (!entry) {
      this.metadata.totalMisses++;
      return { hit: false, key };
    }

    // Check if expired
    if (isExpired(entry)) {
      this.cache.delete(key);
      this.metadata.totalMisses++;
      return { hit: false, key };
    }

    // Check if source code matches
    if (!sourceMatches(entry, request.sourceCode)) {
      this.cache.delete(key);
      this.metadata.totalMisses++;
      return { hit: false, key };
    }

    // Cache hit!
    entry.hitCount++;
    entry.lastAccessedAt = new Date().toISOString();
    this.metadata.totalHits++;
    this.saveCache(); // Save to persist hit count

    return { hit: true, entry, key };
  }

  /**
   * Store an explanation in the cache
   */
  async store(request: CacheStoreRequest): Promise<CacheEntry | undefined> {
    if (!this.config.enabled) {
      return undefined;
    }

    // Check minimum lines
    const lineCount = request.endLine - request.startLine + 1;
    if (lineCount < this.config.minLines) {
      return undefined;
    }

    const entry = createCacheEntry(request, this.config);
    this.cache.set(entry.key, entry);

    // Enforce max entries limit
    if (this.cache.size > this.config.maxEntries) {
      this.evictLeastUsed();
    }

    await this.saveCache();
    return entry;
  }

  /**
   * Invalidate a specific cache entry
   */
  invalidate(key: string): boolean {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.saveCache();
      return true;
    }
    return false;
  }

  /**
   * Invalidate all entries for a file
   */
  invalidateFile(filePath: string): number {
    let invalidated = 0;
    for (const [key, entry] of this.cache) {
      if (entry.filePath === filePath) {
        this.cache.delete(key);
        invalidated++;
      }
    }
    if (invalidated > 0) {
      this.saveCache();
    }
    return invalidated;
  }

  /**
   * Clear the entire cache
   */
  async clearCache(): Promise<void> {
    this.cache.clear();
    this.metadata = { totalHits: 0, totalMisses: 0, lastCleanupAt: new Date().toISOString() };
    await this.saveCache();
  }

  /**
   * Get all cache entries
   */
  getAllEntries(): CacheEntry[] {
    return Array.from(this.cache.values());
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    entryCount: number;
    totalHits: number;
    totalMisses: number;
    hitRate: number;
    oldestEntry?: string;
    newestEntry?: string;
  } {
    const entries = this.getAllEntries();
    const total = this.metadata.totalHits + this.metadata.totalMisses;

    let oldest: string | undefined;
    let newest: string | undefined;

    for (const entry of entries) {
      if (!oldest || entry.createdAt < oldest) {
        oldest = entry.createdAt;
      }
      if (!newest || entry.createdAt > newest) {
        newest = entry.createdAt;
      }
    }

    return {
      entryCount: entries.length,
      totalHits: this.metadata.totalHits,
      totalMisses: this.metadata.totalMisses,
      hitRate: total > 0 ? this.metadata.totalHits / total : 0,
      oldestEntry: oldest,
      newestEntry: newest
    };
  }

  /**
   * Show cache statistics in output channel
   */
  showStats(outputChannel: vscode.OutputChannel): void {
    const stats = this.getStats();

    outputChannel.appendLine('');
    outputChannel.appendLine('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    outputChannel.appendLine('Explanation Cache Statistics');
    outputChannel.appendLine('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    outputChannel.appendLine('');
    outputChannel.appendLine(`Entries: ${stats.entryCount} / ${this.config.maxEntries}`);
    outputChannel.appendLine(`Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
    outputChannel.appendLine(`  Hits: ${stats.totalHits}`);
    outputChannel.appendLine(`  Misses: ${stats.totalMisses}`);
    outputChannel.appendLine('');
    outputChannel.appendLine(`Config:`);
    outputChannel.appendLine(`  Enabled: ${this.config.enabled}`);
    outputChannel.appendLine(`  Share with Team: ${this.config.shareWithTeam}`);
    outputChannel.appendLine(`  TTL: ${this.config.ttlDays} days`);
    outputChannel.appendLine(`  Min Lines: ${this.config.minLines}`);
    outputChannel.appendLine('');

    if (stats.oldestEntry) {
      outputChannel.appendLine(`Oldest: ${new Date(stats.oldestEntry).toLocaleDateString()}`);
    }
    if (stats.newestEntry) {
      outputChannel.appendLine(`Newest: ${new Date(stats.newestEntry).toLocaleDateString()}`);
    }

    outputChannel.appendLine('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  /**
   * Show cache management UI
   */
  async showManagementUI(): Promise<void> {
    const entries = this.getAllEntries();
    const stats = this.getStats();

    const action = await vscode.window.showQuickPick([
      {
        label: `$(database) View Entries (${entries.length})`,
        description: `${stats.totalHits} hits, ${(stats.hitRate * 100).toFixed(0)}% hit rate`,
        value: 'view'
      },
      {
        label: '$(trash) Clear Cache',
        description: 'Remove all cached explanations',
        value: 'clear'
      },
      {
        label: '$(gear) Configure',
        description: 'Change cache settings',
        value: 'configure'
      }
    ], {
      placeHolder: 'Manage Explanation Cache'
    });

    if (!action) return;

    switch (action.value) {
      case 'view':
        await this.showEntriesUI();
        break;
      case 'clear':
        const confirm = await vscode.window.showWarningMessage(
          `Clear all ${entries.length} cached explanations?`,
          { modal: true },
          'Clear'
        );
        if (confirm === 'Clear') {
          await this.clearCache();
          vscode.window.showInformationMessage('Cache cleared');
        }
        break;
      case 'configure':
        await this.showConfigUI();
        break;
    }
  }

  /**
   * Show entries UI
   */
  private async showEntriesUI(): Promise<void> {
    const entries = this.getAllEntries()
      .sort((a, b) => b.hitCount - a.hitCount);

    if (entries.length === 0) {
      vscode.window.showInformationMessage('Cache is empty');
      return;
    }

    const items = entries.map(entry => ({
      label: formatCacheEntryLabel(entry),
      description: `${entry.hitCount} hits • ${entry.templateId}`,
      detail: `By @${entry.createdBy} on ${new Date(entry.createdAt).toLocaleDateString()}`,
      entry
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select an entry to view or delete',
      matchOnDescription: true
    });

    if (!selected) return;

    const entryAction = await vscode.window.showQuickPick([
      { label: '$(eye) View Explanation', value: 'view' },
      { label: '$(go-to-file) Go to File', value: 'goto' },
      { label: '$(trash) Delete Entry', value: 'delete' }
    ], {
      placeHolder: formatCacheEntryLabel(selected.entry)
    });

    if (!entryAction) return;

    switch (entryAction.value) {
      case 'view':
        const doc = await vscode.workspace.openTextDocument({
          content: selected.entry.explanation,
          language: 'markdown'
        });
        await vscode.window.showTextDocument(doc, { preview: true });
        break;
      case 'goto':
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
          const uri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, selected.entry.filePath));
          const document = await vscode.workspace.openTextDocument(uri);
          const editor = await vscode.window.showTextDocument(document);
          const position = new vscode.Position(selected.entry.startLine - 1, 0);
          editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
        }
        break;
      case 'delete':
        this.invalidate(selected.entry.key);
        vscode.window.showInformationMessage('Entry deleted');
        break;
    }
  }

  /**
   * Show configuration UI
   */
  private async showConfigUI(): Promise<void> {
    const items = [
      {
        label: `$(check) Enabled: ${this.config.enabled ? 'Yes' : 'No'}`,
        value: 'enabled'
      },
      {
        label: `$(organization) Share with Team: ${this.config.shareWithTeam ? 'Yes' : 'No'}`,
        value: 'shareWithTeam'
      },
      {
        label: `$(calendar) TTL: ${this.config.ttlDays} days`,
        value: 'ttl'
      },
      {
        label: `$(file-code) Min Lines: ${this.config.minLines}`,
        value: 'minLines'
      },
      {
        label: `$(database) Max Entries: ${this.config.maxEntries}`,
        value: 'maxEntries'
      }
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select setting to change'
    });

    if (!selected) return;

    switch (selected.value) {
      case 'enabled':
        this.config.enabled = !this.config.enabled;
        break;
      case 'shareWithTeam':
        this.config.shareWithTeam = !this.config.shareWithTeam;
        break;
      case 'ttl':
        const ttl = await vscode.window.showInputBox({
          prompt: 'Time to live in days',
          value: String(this.config.ttlDays)
        });
        if (ttl && !isNaN(parseInt(ttl))) {
          this.config.ttlDays = parseInt(ttl);
        }
        break;
      case 'minLines':
        const min = await vscode.window.showInputBox({
          prompt: 'Minimum lines to cache',
          value: String(this.config.minLines)
        });
        if (min && !isNaN(parseInt(min))) {
          this.config.minLines = parseInt(min);
        }
        break;
      case 'maxEntries':
        const max = await vscode.window.showInputBox({
          prompt: 'Maximum cache entries',
          value: String(this.config.maxEntries)
        });
        if (max && !isNaN(parseInt(max))) {
          this.config.maxEntries = parseInt(max);
        }
        break;
    }

    vscode.window.showInformationMessage(`Cache ${selected.value} updated`);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    let cleaned = 0;
    for (const [key, entry] of this.cache) {
      if (isExpired(entry)) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.metadata.lastCleanupAt = new Date().toISOString();
      this.saveCache();
    }
  }

  /**
   * Evict least used entries when cache is full
   */
  private evictLeastUsed(): void {
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => {
        // First by hit count, then by last accessed
        if (a.hitCount !== b.hitCount) {
          return a.hitCount - b.hitCount;
        }
        return new Date(a.lastAccessedAt).getTime() - new Date(b.lastAccessedAt).getTime();
      });

    // Remove 10% of entries
    const toRemove = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < toRemove; i++) {
      if (entries[i]) {
        this.cache.delete(entries[i][0]);
      }
    }
  }

  /**
   * Load cache from file
   */
  private async loadCache(): Promise<void> {
    this.cache.clear();

    const cachePath = this.getCachePath();
    if (!cachePath || !fs.existsSync(cachePath)) {
      this.emitter.fire();
      return;
    }

    try {
      const content = fs.readFileSync(cachePath, 'utf-8');
      const data: CacheFile = JSON.parse(content);

      if (data.version === 1) {
        for (const entry of data.entries) {
          this.cache.set(entry.key, entry);
        }
        this.metadata = {
          totalHits: data.metadata.totalHits || 0,
          totalMisses: data.metadata.totalMisses || 0,
          lastCleanupAt: data.metadata.lastCleanupAt
        };
      }

      this.emitter.fire();
    } catch (err) {
      console.error('[Code Coach] Failed to load explanation cache:', err);
    }
  }

  /**
   * Save cache to file
   */
  private async saveCache(): Promise<void> {
    if (!this.config.shareWithTeam) {
      // Don't persist if not sharing
      return;
    }

    const cachePath = this.getCachePath();
    if (!cachePath) return;

    const dir = path.dirname(cachePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data: CacheFile = {
      version: 1,
      entries: Array.from(this.cache.values()),
      metadata: this.metadata
    };

    try {
      fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf-8');
      this.emitter.fire();
    } catch (err) {
      console.error('[Code Coach] Failed to save explanation cache:', err);
    }
  }

  /**
   * Load config from settings
   */
  private loadConfig(): void {
    const config = vscode.workspace.getConfiguration('codeCoach.cache');
    this.config = {
      enabled: config.get('enabled', DEFAULT_CACHE_CONFIG.enabled),
      shareWithTeam: config.get('shareWithTeam', DEFAULT_CACHE_CONFIG.shareWithTeam),
      ttlDays: config.get('ttlDays', DEFAULT_CACHE_CONFIG.ttlDays),
      maxEntries: config.get('maxEntries', DEFAULT_CACHE_CONFIG.maxEntries),
      minLines: config.get('minLines', DEFAULT_CACHE_CONFIG.minLines)
    };
  }

  /**
   * Get path to cache file
   */
  private getCachePath(): string | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return undefined;
    return path.join(workspaceFolder.uri.fsPath, CODE_COACH_DIR, CACHE_DIR, CACHE_FILE);
  }

  /**
   * Get default author from git config
   */
  async getDefaultAuthor(): Promise<string> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return 'unknown';

    try {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFile);

      const { stdout } = await execFileAsync('git', ['config', 'user.name'], {
        cwd: workspaceFolder.uri.fsPath
      });
      return stdout.trim() || 'unknown';
    } catch {
      return 'unknown';
    }
  }
}
