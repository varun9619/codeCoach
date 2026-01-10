import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  Tour,
  TourStop,
  TourProgress,
  TourProgressFile,
  TourListItem,
  CreateTourInput,
  CreateStopInput,
  generateId,
  createEmptyProgress,
  SUGGESTED_TOUR_TAGS
} from './tourTypes';

const TOURS_DIR = 'tours';
const CODE_COACH_DIR = '.code-coach';
const PROGRESS_FILE = 'tour-progress.json';

/**
 * TourManager - Manages tour files and user progress
 *
 * Tours are stored in .code-coach/tours/*.json (git-tracked)
 * Progress is stored in .code-coach/tour-progress.json (should be gitignored)
 */
export class TourManager {
  private static instance: TourManager | undefined;
  private tours: Map<string, { tour: Tour; filePath: string }> = new Map();
  private progress: Map<string, TourProgress> = new Map();
  private watcher: vscode.FileSystemWatcher | undefined;
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onToursChanged = this.emitter.event;

  private constructor() {}

  static getInstance(): TourManager {
    if (!TourManager.instance) {
      TourManager.instance = new TourManager();
    }
    return TourManager.instance;
  }

  async initialize(context: vscode.ExtensionContext): Promise<void> {
    await this.loadTours();
    await this.loadProgress();

    // Watch for changes to tours directory
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const toursPattern = new vscode.RelativePattern(
        workspaceFolder,
        `${CODE_COACH_DIR}/${TOURS_DIR}/*.json`
      );
      this.watcher = vscode.workspace.createFileSystemWatcher(toursPattern);

      this.watcher.onDidCreate(() => this.loadTours());
      this.watcher.onDidChange(() => this.loadTours());
      this.watcher.onDidDelete(() => this.loadTours());

      context.subscriptions.push(this.watcher);
    }
  }

  dispose(): void {
    this.watcher?.dispose();
    this.emitter.dispose();
  }

  /**
   * Get all available tours with their progress
   */
  getAllTours(): TourListItem[] {
    const items: TourListItem[] = [];
    for (const [id, { tour, filePath }] of this.tours) {
      items.push({
        tour,
        progress: this.progress.get(id),
        filePath
      });
    }
    return items.sort((a, b) => a.tour.title.localeCompare(b.tour.title));
  }

  /**
   * Get tours filtered by tags
   */
  getToursByTags(tags: string[]): TourListItem[] {
    if (tags.length === 0) return this.getAllTours();
    return this.getAllTours().filter(item =>
      item.tour.tags?.some(tag => tags.includes(tag))
    );
  }

  /**
   * Get a specific tour by ID
   */
  getTour(id: string): Tour | undefined {
    return this.tours.get(id)?.tour;
  }

  /**
   * Get progress for a tour
   */
  getProgress(tourId: string): TourProgress | undefined {
    return this.progress.get(tourId);
  }

  /**
   * Update progress for a tour
   */
  async updateProgress(tourId: string, updates: Partial<TourProgress>): Promise<void> {
    let progress = this.progress.get(tourId);
    if (!progress) {
      progress = createEmptyProgress(tourId);
    }

    // Apply updates
    if (updates.currentStopIndex !== undefined) {
      progress.currentStopIndex = updates.currentStopIndex;
    }
    if (updates.completedStops !== undefined) {
      progress.completedStops = updates.completedStops;
    }
    if (updates.completed !== undefined) {
      progress.completed = updates.completed;
    }
    progress.lastAccessedAt = new Date().toISOString();

    this.progress.set(tourId, progress);
    await this.saveProgress();
  }

  /**
   * Mark a stop as completed
   */
  async completeStop(tourId: string, stopId: string): Promise<void> {
    const progress = this.progress.get(tourId) || createEmptyProgress(tourId);
    if (!progress.completedStops.includes(stopId)) {
      progress.completedStops.push(stopId);
    }

    const tour = this.getTour(tourId);
    if (tour && progress.completedStops.length >= tour.stops.length) {
      progress.completed = true;
    }

    progress.lastAccessedAt = new Date().toISOString();
    this.progress.set(tourId, progress);
    await this.saveProgress();
  }

  /**
   * Reset progress for a tour
   */
  async resetProgress(tourId: string): Promise<void> {
    this.progress.set(tourId, createEmptyProgress(tourId));
    await this.saveProgress();
  }

  /**
   * Create a new tour
   */
  async createTour(input: CreateTourInput): Promise<Tour> {
    const author = await this.getDefaultAuthor();
    const tour: Tour = {
      version: 1,
      id: generateId('tour'),
      title: input.title,
      description: input.description,
      author,
      estimatedMinutes: input.estimatedMinutes,
      tags: input.tags,
      stops: [],
      createdAt: new Date().toISOString()
    };

    await this.saveTour(tour);
    return tour;
  }

  /**
   * Add a stop to a tour
   */
  async addStop(tourId: string, input: CreateStopInput): Promise<TourStop> {
    const tour = this.getTour(tourId);
    if (!tour) {
      throw new Error(`Tour not found: ${tourId}`);
    }

    const stop: TourStop = {
      id: generateId('stop'),
      title: input.title,
      filePath: input.filePath,
      line: input.line,
      character: input.character,
      content: input.content,
      highlights: input.highlights
    };

    tour.stops.push(stop);
    tour.updatedAt = new Date().toISOString();
    await this.saveTour(tour);

    return stop;
  }

  /**
   * Update a stop in a tour
   */
  async updateStop(tourId: string, stopId: string, updates: Partial<CreateStopInput>): Promise<boolean> {
    const tour = this.getTour(tourId);
    if (!tour) return false;

    const stopIndex = tour.stops.findIndex(s => s.id === stopId);
    if (stopIndex === -1) return false;

    const stop = tour.stops[stopIndex];
    if (updates.title !== undefined) stop.title = updates.title;
    if (updates.filePath !== undefined) stop.filePath = updates.filePath;
    if (updates.line !== undefined) stop.line = updates.line;
    if (updates.character !== undefined) stop.character = updates.character;
    if (updates.content !== undefined) stop.content = updates.content;
    if (updates.highlights !== undefined) stop.highlights = updates.highlights;

    tour.updatedAt = new Date().toISOString();
    await this.saveTour(tour);
    return true;
  }

  /**
   * Remove a stop from a tour
   */
  async removeStop(tourId: string, stopId: string): Promise<boolean> {
    const tour = this.getTour(tourId);
    if (!tour) return false;

    const stopIndex = tour.stops.findIndex(s => s.id === stopId);
    if (stopIndex === -1) return false;

    tour.stops.splice(stopIndex, 1);
    tour.updatedAt = new Date().toISOString();
    await this.saveTour(tour);
    return true;
  }

  /**
   * Delete a tour
   */
  async deleteTour(tourId: string): Promise<boolean> {
    const entry = this.tours.get(tourId);
    if (!entry) return false;

    try {
      fs.unlinkSync(entry.filePath);
      this.tours.delete(tourId);
      this.progress.delete(tourId);
      await this.saveProgress();
      this.emitter.fire();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Show tour creation wizard
   */
  async createTourWizard(): Promise<Tour | undefined> {
    // Get title
    const title = await vscode.window.showInputBox({
      prompt: 'Tour title',
      placeHolder: 'e.g., Authentication System Overview',
      validateInput: (value) => {
        if (!value || value.trim().length < 3) {
          return 'Title must be at least 3 characters';
        }
        return undefined;
      }
    });

    if (!title) return undefined;

    // Get description
    const description = await vscode.window.showInputBox({
      prompt: 'Brief description',
      placeHolder: 'e.g., Learn how our auth flow works'
    });

    if (!description) return undefined;

    // Get estimated time
    const timeInput = await vscode.window.showInputBox({
      prompt: 'Estimated time in minutes (optional)',
      placeHolder: 'e.g., 15'
    });

    const estimatedMinutes = timeInput ? parseInt(timeInput) : undefined;

    // Get tags
    const tagItems = SUGGESTED_TOUR_TAGS.map(tag => ({
      label: tag.label,
      description: tag.description,
      picked: false
    }));

    const selectedTags = await vscode.window.showQuickPick(tagItems, {
      canPickMany: true,
      placeHolder: 'Select tags (optional)',
      title: 'Categorize this tour'
    });

    const tags = selectedTags?.map(t => t.label);

    // Create the tour
    const tour = await this.createTour({
      title: title.trim(),
      description: description.trim(),
      estimatedMinutes: estimatedMinutes && !isNaN(estimatedMinutes) ? estimatedMinutes : undefined,
      tags: tags && tags.length > 0 ? tags : undefined
    });

    vscode.window.showInformationMessage(
      `Tour "${tour.title}" created. Add stops to build your tour.`
    );

    return tour;
  }

  /**
   * Show add stop wizard
   */
  async addStopWizard(tourId: string): Promise<TourStop | undefined> {
    const tour = this.getTour(tourId);
    if (!tour) {
      vscode.window.showWarningMessage('Tour not found');
      return undefined;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Open a file and place cursor where you want to add a stop');
      return undefined;
    }

    // Get title
    const title = await vscode.window.showInputBox({
      prompt: 'Stop title',
      placeHolder: 'e.g., Entry Point: Login Controller',
      validateInput: (value) => {
        if (!value || value.trim().length < 3) {
          return 'Title must be at least 3 characters';
        }
        return undefined;
      }
    });

    if (!title) return undefined;

    // Get content
    const content = await vscode.window.showInputBox({
      prompt: 'Explanation content (supports markdown)',
      placeHolder: 'e.g., This is where authentication requests enter...'
    });

    if (!content) return undefined;

    // Get file path and position from current editor
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const filePath = workspaceFolder
      ? path.relative(workspaceFolder.uri.fsPath, editor.document.uri.fsPath)
      : editor.document.uri.fsPath;

    const line = editor.selection.active.line + 1; // 1-indexed
    const character = editor.selection.active.character;

    // Create the stop
    const stop = await this.addStop(tourId, {
      title: title.trim(),
      filePath,
      line,
      character,
      content: content.trim()
    });

    vscode.window.showInformationMessage(
      `Stop "${stop.title}" added to tour "${tour.title}"`
    );

    return stop;
  }

  private async loadTours(): Promise<void> {
    this.tours.clear();

    const toursDir = this.getToursDir();
    if (!toursDir || !fs.existsSync(toursDir)) {
      this.emitter.fire();
      return;
    }

    try {
      const files = fs.readdirSync(toursDir).filter(f => f.endsWith('.json'));

      for (const file of files) {
        const filePath = path.join(toursDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const tour: Tour = JSON.parse(content);

          if (tour.version === 1 && tour.id && tour.stops) {
            this.tours.set(tour.id, { tour, filePath });
          }
        } catch (err) {
          console.warn(`[Code Coach] Failed to load tour ${file}:`, err);
        }
      }

      this.emitter.fire();
    } catch (err) {
      console.error('[Code Coach] Failed to load tours:', err);
    }
  }

  private async saveTour(tour: Tour): Promise<void> {
    const toursDir = this.getToursDir();
    if (!toursDir) {
      throw new Error('No workspace folder');
    }

    // Ensure directories exist
    if (!fs.existsSync(toursDir)) {
      fs.mkdirSync(toursDir, { recursive: true });
    }

    // Generate filename from tour ID
    const filename = `${tour.id}.json`;
    const filePath = path.join(toursDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(tour, null, 2), 'utf-8');
    this.tours.set(tour.id, { tour, filePath });
    this.emitter.fire();
  }

  private async loadProgress(): Promise<void> {
    this.progress.clear();

    const progressPath = this.getProgressPath();
    if (!progressPath || !fs.existsSync(progressPath)) {
      return;
    }

    try {
      const content = fs.readFileSync(progressPath, 'utf-8');
      const data: TourProgressFile = JSON.parse(content);

      if (data.version === 1 && data.progress) {
        for (const p of data.progress) {
          this.progress.set(p.tourId, p);
        }
      }
    } catch (err) {
      console.warn('[Code Coach] Failed to load tour progress:', err);
    }
  }

  private async saveProgress(): Promise<void> {
    const progressPath = this.getProgressPath();
    if (!progressPath) return;

    const codeCoachDir = path.dirname(progressPath);
    if (!fs.existsSync(codeCoachDir)) {
      fs.mkdirSync(codeCoachDir, { recursive: true });
    }

    const data: TourProgressFile = {
      version: 1,
      progress: Array.from(this.progress.values())
    };

    try {
      fs.writeFileSync(progressPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Code Coach] Failed to save tour progress:', err);
    }
  }

  private getToursDir(): string | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return undefined;
    return path.join(workspaceFolder.uri.fsPath, CODE_COACH_DIR, TOURS_DIR);
  }

  private getProgressPath(): string | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return undefined;
    return path.join(workspaceFolder.uri.fsPath, CODE_COACH_DIR, PROGRESS_FILE);
  }

  private async getDefaultAuthor(): Promise<string> {
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
