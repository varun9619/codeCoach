import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Team Pinned Symbols - shared important symbols with annotations
 *
 * Unlike personal pins (stored in VS Code workspace state), team pins are
 * stored in .code-coach/pins.json and tracked in git. This allows teams to
 * share important code landmarks across the codebase.
 */

export interface TeamPin {
  /** Unique identifier for this pin */
  id: string;
  /** Symbol name (e.g., "AuthenticationMiddleware") */
  symbol: string;
  /** File path relative to workspace root */
  filePath: string;
  /** Line number (1-indexed) */
  line: number;
  /** Character offset on the line */
  character: number;
  /** Symbol kind (function, class, method, etc.) */
  kind: string;
  /** Why is this symbol important? */
  annotation: string;
  /** Who created this pin */
  author: string;
  /** ISO timestamp when pin was created */
  createdAt: string;
  /** Optional tags for categorization */
  tags?: string[];
}

export interface TeamPinsFile {
  version: 1;
  pins: TeamPin[];
}

const PINS_FILENAME = 'pins.json';
const CODE_COACH_DIR = '.code-coach';

export class TeamPinManager {
  private static instance: TeamPinManager | undefined;
  private pins: TeamPin[] = [];
  private watcher: vscode.FileSystemWatcher | undefined;
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onPinsChanged = this.emitter.event;

  private constructor() {}

  static getInstance(): TeamPinManager {
    if (!TeamPinManager.instance) {
      TeamPinManager.instance = new TeamPinManager();
    }
    return TeamPinManager.instance;
  }

  async initialize(context: vscode.ExtensionContext): Promise<void> {
    await this.loadPins();

    // Watch for changes to pins file
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const pinsPattern = new vscode.RelativePattern(
        workspaceFolder,
        `${CODE_COACH_DIR}/${PINS_FILENAME}`
      );
      this.watcher = vscode.workspace.createFileSystemWatcher(pinsPattern);

      this.watcher.onDidCreate(() => this.loadPins());
      this.watcher.onDidChange(() => this.loadPins());
      this.watcher.onDidDelete(() => {
        this.pins = [];
        this.emitter.fire();
      });

      context.subscriptions.push(this.watcher);
    }
  }

  dispose(): void {
    this.watcher?.dispose();
    this.emitter.dispose();
  }

  /**
   * Get all team pins
   */
  getAllPins(): TeamPin[] {
    return [...this.pins];
  }

  /**
   * Get pins filtered by tags
   */
  getPinsByTags(tags: string[]): TeamPin[] {
    if (tags.length === 0) return this.getAllPins();
    return this.pins.filter(pin =>
      pin.tags?.some(tag => tags.includes(tag))
    );
  }

  /**
   * Get a specific pin by ID
   */
  getPin(id: string): TeamPin | undefined {
    return this.pins.find(pin => pin.id === id);
  }

  /**
   * Add a new team pin
   */
  async addPin(pin: Omit<TeamPin, 'id' | 'createdAt'>): Promise<TeamPin> {
    const newPin: TeamPin = {
      ...pin,
      id: this.generateId(),
      createdAt: new Date().toISOString()
    };

    this.pins.push(newPin);
    await this.savePins();
    return newPin;
  }

  /**
   * Update an existing pin (e.g., change annotation or tags)
   */
  async updatePin(id: string, updates: Partial<Pick<TeamPin, 'annotation' | 'tags'>>): Promise<boolean> {
    const pin = this.pins.find(p => p.id === id);
    if (!pin) return false;

    if (updates.annotation !== undefined) {
      pin.annotation = updates.annotation;
    }
    if (updates.tags !== undefined) {
      pin.tags = updates.tags;
    }

    await this.savePins();
    return true;
  }

  /**
   * Remove a team pin
   */
  async removePin(id: string): Promise<boolean> {
    const index = this.pins.findIndex(p => p.id === id);
    if (index === -1) return false;

    this.pins.splice(index, 1);
    await this.savePins();
    return true;
  }

  /**
   * Check if a symbol at a location is already pinned
   */
  isPinned(filePath: string, line: number): boolean {
    const relPath = this.toRelativePath(filePath);
    return this.pins.some(pin => pin.filePath === relPath && pin.line === line);
  }

  /**
   * Get all unique tags across all pins
   */
  getAllTags(): string[] {
    const tagsSet = new Set<string>();
    for (const pin of this.pins) {
      if (pin.tags) {
        for (const tag of pin.tags) {
          tagsSet.add(tag);
        }
      }
    }
    return Array.from(tagsSet).sort();
  }

  /**
   * Get the default author name (from git config or user)
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

  private async loadPins(): Promise<void> {
    const pinsPath = this.getPinsFilePath();
    if (!pinsPath) {
      this.pins = [];
      return;
    }

    try {
      if (!fs.existsSync(pinsPath)) {
        this.pins = [];
        return;
      }

      const content = fs.readFileSync(pinsPath, 'utf-8');
      const data: TeamPinsFile = JSON.parse(content);

      if (data.version !== 1) {
        console.warn('[Code Coach] Unsupported team pins version:', data.version);
        this.pins = [];
        return;
      }

      this.pins = data.pins || [];
      this.emitter.fire();
    } catch (err) {
      console.error('[Code Coach] Failed to load team pins:', err);
      this.pins = [];
    }
  }

  private async savePins(): Promise<void> {
    const pinsPath = this.getPinsFilePath();
    if (!pinsPath) return;

    const data: TeamPinsFile = {
      version: 1,
      pins: this.pins
    };

    try {
      // Ensure .code-coach directory exists
      const dirPath = path.dirname(pinsPath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      fs.writeFileSync(pinsPath, JSON.stringify(data, null, 2), 'utf-8');
      this.emitter.fire();
    } catch (err) {
      console.error('[Code Coach] Failed to save team pins:', err);
      throw err;
    }
  }

  private getPinsFilePath(): string | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return undefined;
    return path.join(workspaceFolder.uri.fsPath, CODE_COACH_DIR, PINS_FILENAME);
  }

  private toRelativePath(absolutePath: string): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return absolutePath;
    return path.relative(workspaceFolder.uri.fsPath, absolutePath);
  }

  private generateId(): string {
    return `pin-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

/**
 * Predefined tags for common use cases
 */
export const SUGGESTED_TAGS = [
  { label: 'critical', description: 'Critical code path - review before modifying' },
  { label: 'auth', description: 'Authentication/authorization related' },
  { label: 'security', description: 'Security-sensitive code' },
  { label: 'performance', description: 'Performance-critical section' },
  { label: 'architecture', description: 'Core architectural pattern' },
  { label: 'deprecated', description: 'Scheduled for removal' },
  { label: 'tech-debt', description: 'Known technical debt' },
  { label: 'entry-point', description: 'Important entry point for understanding' }
];

/**
 * Convert a VS Code SymbolKind to a string for storage
 */
export function symbolKindToString(kind: vscode.SymbolKind): string {
  switch (kind) {
    case vscode.SymbolKind.Function: return 'function';
    case vscode.SymbolKind.Method: return 'method';
    case vscode.SymbolKind.Class: return 'class';
    case vscode.SymbolKind.Interface: return 'interface';
    case vscode.SymbolKind.Enum: return 'enum';
    case vscode.SymbolKind.Module: return 'module';
    case vscode.SymbolKind.Property: return 'property';
    case vscode.SymbolKind.Variable: return 'variable';
    case vscode.SymbolKind.Constant: return 'constant';
    case vscode.SymbolKind.Constructor: return 'constructor';
    default: return 'symbol';
  }
}

/**
 * Convert a stored string kind back to SymbolKind
 */
export function stringToSymbolKind(kind: string): vscode.SymbolKind {
  switch (kind) {
    case 'function': return vscode.SymbolKind.Function;
    case 'method': return vscode.SymbolKind.Method;
    case 'class': return vscode.SymbolKind.Class;
    case 'interface': return vscode.SymbolKind.Interface;
    case 'enum': return vscode.SymbolKind.Enum;
    case 'module': return vscode.SymbolKind.Module;
    case 'property': return vscode.SymbolKind.Property;
    case 'variable': return vscode.SymbolKind.Variable;
    case 'constant': return vscode.SymbolKind.Constant;
    case 'constructor': return vscode.SymbolKind.Constructor;
    default: return vscode.SymbolKind.Variable;
  }
}
