/**
 * Code Change Subscriptions Type Definitions
 *
 * Subscribe to files or symbols to get notified when they change.
 * Stored in .code-coach/subscriptions.json (gitignored - personal subscriptions).
 */

/** Subscription notification level */
export type NotifyLevel = 'always' | 'onMajorChange' | 'onBreakingChange';

/** Base subscription interface */
export interface SubscriptionBase {
  /** Unique identifier */
  id: string;
  /** Why the user subscribed */
  reason?: string;
  /** When to notify */
  notify: NotifyLevel;
  /** Creation timestamp */
  createdAt: string;
  /** Last notification timestamp */
  lastNotifiedAt?: string;
  /** Whether subscription is active */
  active: boolean;
}

/** File pattern subscription */
export interface FileSubscription extends SubscriptionBase {
  type: 'file';
  /** Glob pattern for file matching */
  pattern: string;
}

/** Symbol subscription */
export interface SymbolSubscription extends SubscriptionBase {
  type: 'symbol';
  /** Symbol name */
  symbol: string;
  /** File path where symbol is defined */
  filePath: string;
  /** Line number for quick reference */
  line: number;
}

/** Directory subscription */
export interface DirectorySubscription extends SubscriptionBase {
  type: 'directory';
  /** Directory path relative to workspace */
  path: string;
  /** Whether to include subdirectories */
  recursive: boolean;
}

/** Union type for all subscription types */
export type Subscription = FileSubscription | SymbolSubscription | DirectorySubscription;

/** Subscriptions file format */
export interface SubscriptionsFile {
  version: 1;
  subscriptions: Subscription[];
}

/** A detected change to a subscribed item */
export interface DetectedChange {
  /** The subscription that matched */
  subscription: Subscription;
  /** File path that changed */
  filePath: string;
  /** Type of change */
  changeType: 'added' | 'modified' | 'deleted' | 'renamed';
  /** Number of lines added */
  additions: number;
  /** Number of lines deleted */
  deletions: number;
  /** Commit hash if from git history */
  commitHash?: string;
  /** Commit message if from git history */
  commitMessage?: string;
  /** Author of the change */
  author?: string;
  /** When the change was detected */
  detectedAt: string;
}

/** Summary of changes for notification */
export interface ChangeSummary {
  /** Total number of changes detected */
  totalChanges: number;
  /** Changes grouped by subscription */
  bySubscription: Map<string, DetectedChange[]>;
  /** Changes grouped by file */
  byFile: Map<string, DetectedChange[]>;
  /** Git ref range that was checked */
  gitRange?: {
    from: string;
    to: string;
  };
}

/** Subscription creation input */
export interface CreateSubscriptionInput {
  type: 'file' | 'symbol' | 'directory';
  /** For file type: glob pattern */
  pattern?: string;
  /** For symbol type: symbol name */
  symbol?: string;
  /** For symbol type: file path */
  filePath?: string;
  /** For symbol type: line number */
  line?: number;
  /** For directory type: directory path */
  path?: string;
  /** For directory type: include subdirectories */
  recursive?: boolean;
  /** Reason for subscribing */
  reason?: string;
  /** Notification level */
  notify?: NotifyLevel;
}

/** Generate unique subscription ID */
export function generateSubscriptionId(): string {
  return `sub-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Create a default subscription */
export function createSubscription(input: CreateSubscriptionInput): Subscription {
  const base: SubscriptionBase = {
    id: generateSubscriptionId(),
    reason: input.reason,
    notify: input.notify || 'always',
    createdAt: new Date().toISOString(),
    active: true
  };

  switch (input.type) {
    case 'file':
      return {
        ...base,
        type: 'file',
        pattern: input.pattern || ''
      };
    case 'symbol':
      return {
        ...base,
        type: 'symbol',
        symbol: input.symbol || '',
        filePath: input.filePath || '',
        line: input.line || 1
      };
    case 'directory':
      return {
        ...base,
        type: 'directory',
        path: input.path || '',
        recursive: input.recursive ?? true
      };
  }
}

/** Check if a file path matches a subscription */
export function matchesSubscription(subscription: Subscription, filePath: string): boolean {
  switch (subscription.type) {
    case 'file':
      return matchGlobPattern(subscription.pattern, filePath);
    case 'symbol':
      return subscription.filePath === filePath;
    case 'directory':
      if (subscription.recursive) {
        return filePath.startsWith(subscription.path + '/') || filePath === subscription.path;
      }
      const dir = filePath.substring(0, filePath.lastIndexOf('/'));
      return dir === subscription.path;
  }
}

/** Simple glob pattern matching */
function matchGlobPattern(pattern: string, filePath: string): boolean {
  // Convert glob to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<GLOBSTAR>>>/g, '.*')
    .replace(/\?/g, '.');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filePath);
}

/** Format subscription for display */
export function formatSubscriptionLabel(subscription: Subscription): string {
  switch (subscription.type) {
    case 'file':
      return subscription.pattern;
    case 'symbol':
      return `${subscription.symbol} (${subscription.filePath})`;
    case 'directory':
      return `${subscription.path}${subscription.recursive ? '/**' : '/*'}`;
  }
}

/** Get icon for subscription type */
export function getSubscriptionIcon(subscription: Subscription): string {
  switch (subscription.type) {
    case 'file':
      return 'file';
    case 'symbol':
      return 'symbol-method';
    case 'directory':
      return 'folder';
  }
}
