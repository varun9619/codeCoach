/**
 * Subscription Manager - CRUD operations for code change subscriptions
 *
 * Subscriptions are stored in .code-coach/subscriptions.json (gitignored)
 * since they are personal preferences, not team configuration.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  Subscription,
  SubscriptionsFile,
  CreateSubscriptionInput,
  createSubscription,
  formatSubscriptionLabel,
  NotifyLevel,
  ChangeSummary
} from './subscriptionTypes';
import { ChangeDetector } from './changeDetector';

const CODE_COACH_DIR = '.code-coach';
const SUBSCRIPTIONS_FILE = 'subscriptions.json';

/**
 * SubscriptionManager - Manages code change subscriptions
 */
export class SubscriptionManager {
  private static instance: SubscriptionManager | undefined;
  private subscriptions: Map<string, Subscription> = new Map();
  private watcher: vscode.FileSystemWatcher | undefined;
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onSubscriptionsChanged = this.emitter.event;
  private checkInterval: NodeJS.Timeout | undefined;

  private constructor() {}

  static getInstance(): SubscriptionManager {
    if (!SubscriptionManager.instance) {
      SubscriptionManager.instance = new SubscriptionManager();
    }
    return SubscriptionManager.instance;
  }

  async initialize(context: vscode.ExtensionContext): Promise<void> {
    await this.loadSubscriptions();

    // Watch for external changes to subscriptions file
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const pattern = new vscode.RelativePattern(
        workspaceFolder,
        `${CODE_COACH_DIR}/${SUBSCRIPTIONS_FILE}`
      );
      this.watcher = vscode.workspace.createFileSystemWatcher(pattern);

      this.watcher.onDidChange(() => this.loadSubscriptions());
      this.watcher.onDidCreate(() => this.loadSubscriptions());
      this.watcher.onDidDelete(() => {
        this.subscriptions.clear();
        this.emitter.fire();
      });

      context.subscriptions.push(this.watcher);
    }

    // Set up periodic change checking (every 5 minutes)
    this.checkInterval = setInterval(() => {
      this.checkForChangesInBackground();
    }, 5 * 60 * 1000);

    // Check for changes on workspace open
    this.checkForChangesOnStartup();
  }

  dispose(): void {
    this.watcher?.dispose();
    this.emitter.dispose();
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  /**
   * Get all subscriptions
   */
  getAllSubscriptions(): Subscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get active subscriptions only
   */
  getActiveSubscriptions(): Subscription[] {
    return this.getAllSubscriptions().filter(s => s.active);
  }

  /**
   * Get a subscription by ID
   */
  getSubscription(id: string): Subscription | undefined {
    return this.subscriptions.get(id);
  }

  /**
   * Add a new subscription
   */
  async addSubscription(input: CreateSubscriptionInput): Promise<Subscription> {
    const subscription = createSubscription(input);
    this.subscriptions.set(subscription.id, subscription);
    await this.saveSubscriptions();
    return subscription;
  }

  /**
   * Update an existing subscription
   */
  async updateSubscription(
    id: string,
    updates: Partial<Omit<Subscription, 'id' | 'type' | 'createdAt'>>
  ): Promise<boolean> {
    const subscription = this.subscriptions.get(id);
    if (!subscription) return false;

    // Apply updates
    if (updates.reason !== undefined) subscription.reason = updates.reason;
    if (updates.notify !== undefined) subscription.notify = updates.notify;
    if (updates.active !== undefined) subscription.active = updates.active;
    if (updates.lastNotifiedAt !== undefined) subscription.lastNotifiedAt = updates.lastNotifiedAt;

    await this.saveSubscriptions();
    return true;
  }

  /**
   * Remove a subscription
   */
  async removeSubscription(id: string): Promise<boolean> {
    if (!this.subscriptions.has(id)) return false;

    this.subscriptions.delete(id);
    await this.saveSubscriptions();
    return true;
  }

  /**
   * Toggle subscription active state
   */
  async toggleSubscription(id: string): Promise<boolean> {
    const subscription = this.subscriptions.get(id);
    if (!subscription) return false;

    subscription.active = !subscription.active;
    await this.saveSubscriptions();
    return true;
  }

  /**
   * Show subscription creation wizard for current file
   */
  async subscribeToCurrentFile(): Promise<Subscription | undefined> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Open a file to subscribe to it');
      return undefined;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showWarningMessage('No workspace folder open');
      return undefined;
    }

    const relativePath = path.relative(
      workspaceFolder.uri.fsPath,
      editor.document.uri.fsPath
    );

    // Ask for subscription type
    const typeChoice = await vscode.window.showQuickPick([
      { label: 'This exact file', value: 'file-exact' },
      { label: 'Files matching pattern', value: 'file-pattern' },
      { label: 'This directory', value: 'directory' }
    ], {
      placeHolder: 'What do you want to subscribe to?'
    });

    if (!typeChoice) return undefined;

    let pattern: string;
    let type: 'file' | 'directory' = 'file';
    let dirPath: string | undefined;
    let recursive = true;

    if (typeChoice.value === 'file-exact') {
      pattern = relativePath;
    } else if (typeChoice.value === 'file-pattern') {
      const input = await vscode.window.showInputBox({
        prompt: 'Enter glob pattern',
        value: relativePath.replace(/\/[^/]+$/, '/**/*.ts'),
        placeHolder: 'e.g., src/auth/**/*.ts'
      });
      if (!input) return undefined;
      pattern = input;
    } else {
      type = 'directory';
      dirPath = path.dirname(relativePath);
      pattern = dirPath;

      const recursiveChoice = await vscode.window.showQuickPick([
        { label: 'Yes, include subdirectories', value: true },
        { label: 'No, only this directory', value: false }
      ], {
        placeHolder: 'Include subdirectories?'
      });
      if (recursiveChoice === undefined) return undefined;
      recursive = recursiveChoice.value;
    }

    // Ask for reason
    const reason = await vscode.window.showInputBox({
      prompt: 'Why are you subscribing? (optional)',
      placeHolder: 'e.g., I own this module'
    });

    // Ask for notification level
    const notifyChoice = await vscode.window.showQuickPick([
      { label: 'Always notify', description: 'Any change triggers notification', value: 'always' as NotifyLevel },
      { label: 'Major changes only', description: 'Large changes or new files', value: 'onMajorChange' as NotifyLevel },
      { label: 'Breaking changes only', description: 'Deletions or signature changes', value: 'onBreakingChange' as NotifyLevel }
    ], {
      placeHolder: 'When should we notify you?'
    });

    if (!notifyChoice) return undefined;

    const subscription = await this.addSubscription({
      type,
      pattern: type === 'file' ? pattern : undefined,
      path: type === 'directory' ? dirPath : undefined,
      recursive: type === 'directory' ? recursive : undefined,
      reason,
      notify: notifyChoice.value
    });

    vscode.window.showInformationMessage(
      `Subscribed to ${formatSubscriptionLabel(subscription)}`
    );

    return subscription;
  }

  /**
   * Show subscription creation wizard for current symbol
   */
  async subscribeToCurrentSymbol(): Promise<Subscription | undefined> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Open a file to subscribe to a symbol');
      return undefined;
    }

    const position = editor.selection.active;
    const wordRange = editor.document.getWordRangeAtPosition(position);
    if (!wordRange) {
      vscode.window.showWarningMessage('Place cursor on a symbol to subscribe');
      return undefined;
    }

    const symbolName = editor.document.getText(wordRange);
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return undefined;

    const relativePath = path.relative(
      workspaceFolder.uri.fsPath,
      editor.document.uri.fsPath
    );

    // Ask for reason
    const reason = await vscode.window.showInputBox({
      prompt: 'Why are you subscribing? (optional)',
      placeHolder: 'e.g., Critical authentication logic'
    });

    // Ask for notification level
    const notifyChoice = await vscode.window.showQuickPick([
      { label: 'Always notify', description: 'Any change triggers notification', value: 'always' as NotifyLevel },
      { label: 'Major changes only', description: 'Significant modifications', value: 'onMajorChange' as NotifyLevel }
    ], {
      placeHolder: 'When should we notify you?'
    });

    if (!notifyChoice) return undefined;

    const subscription = await this.addSubscription({
      type: 'symbol',
      symbol: symbolName,
      filePath: relativePath,
      line: position.line + 1,
      reason,
      notify: notifyChoice.value
    });

    vscode.window.showInformationMessage(
      `Subscribed to symbol "${symbolName}"`
    );

    return subscription;
  }

  /**
   * Show subscription management UI
   */
  async showManagementUI(): Promise<void> {
    const subscriptions = this.getAllSubscriptions();

    if (subscriptions.length === 0) {
      const action = await vscode.window.showInformationMessage(
        'No subscriptions yet. Subscribe to files or symbols to get notified when they change.',
        'Subscribe to Current File'
      );

      if (action) {
        await this.subscribeToCurrentFile();
      }
      return;
    }

    const items = subscriptions.map(sub => ({
      label: `${sub.active ? '$(eye)' : '$(eye-closed)'} ${formatSubscriptionLabel(sub)}`,
      description: sub.reason || '',
      detail: `${sub.type} • ${sub.notify} • Created ${new Date(sub.createdAt).toLocaleDateString()}`,
      subscription: sub
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a subscription to manage',
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (!selected) return;

    const action = await vscode.window.showQuickPick([
      { label: selected.subscription.active ? '$(eye-closed) Disable' : '$(eye) Enable', value: 'toggle' },
      { label: '$(pencil) Edit reason', value: 'edit' },
      { label: '$(trash) Remove', value: 'remove' }
    ], {
      placeHolder: `Manage: ${formatSubscriptionLabel(selected.subscription)}`
    });

    if (!action) return;

    switch (action.value) {
      case 'toggle':
        await this.toggleSubscription(selected.subscription.id);
        vscode.window.showInformationMessage(
          `Subscription ${selected.subscription.active ? 'disabled' : 'enabled'}`
        );
        break;
      case 'edit':
        const newReason = await vscode.window.showInputBox({
          prompt: 'Update reason',
          value: selected.subscription.reason || ''
        });
        if (newReason !== undefined) {
          await this.updateSubscription(selected.subscription.id, { reason: newReason });
        }
        break;
      case 'remove':
        await this.removeSubscription(selected.subscription.id);
        vscode.window.showInformationMessage('Subscription removed');
        break;
    }
  }

  /**
   * Check for changes to subscribed items
   */
  async checkForChanges(): Promise<ChangeSummary> {
    const detector = ChangeDetector.getInstance();
    const summary = await detector.detectChanges(this.getActiveSubscriptions());

    if (summary.totalChanges > 0) {
      this.showChangeNotification(summary);
    }

    // Update last checked ref
    const currentHead = await detector.getCurrentHead();
    if (currentHead) {
      detector.setLastCheckedRef(currentHead);
    }

    return summary;
  }

  /**
   * Check for changes on startup (after workspace opens)
   */
  private async checkForChangesOnStartup(): Promise<void> {
    // Wait a bit for the workspace to fully load
    await new Promise(resolve => setTimeout(resolve, 3000));

    if (this.getActiveSubscriptions().length === 0) return;

    const detector = ChangeDetector.getInstance();
    if (await detector.hasNewChanges()) {
      const summary = await detector.detectChanges(this.getActiveSubscriptions());
      if (summary.totalChanges > 0) {
        this.showChangeNotification(summary);
      }
    }
  }

  /**
   * Background check for changes (called periodically)
   */
  private async checkForChangesInBackground(): Promise<void> {
    if (this.getActiveSubscriptions().length === 0) return;

    const detector = ChangeDetector.getInstance();
    if (await detector.hasNewChanges()) {
      await this.checkForChanges();
    }
  }

  /**
   * Show notification about detected changes
   */
  private async showChangeNotification(summary: ChangeSummary): Promise<void> {
    const result = await vscode.window.showInformationMessage(
      `${summary.totalChanges} subscribed file(s) changed`,
      'Show Details',
      'Dismiss'
    );

    if (result === 'Show Details') {
      this.showChangeSummaryPanel(summary);
    }
  }

  /**
   * Show change summary in output channel
   */
  private showChangeSummaryPanel(summary: ChangeSummary): void {
    const detector = ChangeDetector.getInstance();
    const markdown = detector.formatChangeSummary(summary);

    // Create or show output channel
    const channel = vscode.window.createOutputChannel('Code Coach: Subscriptions', 'markdown');
    channel.clear();
    channel.appendLine(markdown);
    channel.show();
  }

  /**
   * Load subscriptions from file
   */
  private async loadSubscriptions(): Promise<void> {
    this.subscriptions.clear();

    const filePath = this.getSubscriptionsPath();
    if (!filePath || !fs.existsSync(filePath)) {
      this.emitter.fire();
      return;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data: SubscriptionsFile = JSON.parse(content);

      if (data.version === 1 && data.subscriptions) {
        for (const sub of data.subscriptions) {
          this.subscriptions.set(sub.id, sub);
        }
      }

      this.emitter.fire();
    } catch (err) {
      console.error('[Code Coach] Failed to load subscriptions:', err);
    }
  }

  /**
   * Save subscriptions to file
   */
  private async saveSubscriptions(): Promise<void> {
    const filePath = this.getSubscriptionsPath();
    if (!filePath) return;

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data: SubscriptionsFile = {
      version: 1,
      subscriptions: Array.from(this.subscriptions.values())
    };

    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      this.emitter.fire();
    } catch (err) {
      console.error('[Code Coach] Failed to save subscriptions:', err);
    }
  }

  /**
   * Get path to subscriptions file
   */
  private getSubscriptionsPath(): string | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return undefined;
    return path.join(workspaceFolder.uri.fsPath, CODE_COACH_DIR, SUBSCRIPTIONS_FILE);
  }
}
