import * as vscode from 'vscode';
import * as path from 'path';
import { Tour, TourStop, TourProgress, TourRunnerState } from './tourTypes';
import { TourManager } from './tourManager';

/**
 * TourRunner - Handles tour playback and navigation
 *
 * Manages the active tour state, navigates between stops,
 * and provides the UI for tour progress.
 */
export class TourRunner {
  private static instance: TourRunner | undefined;
  private state: TourRunnerState | undefined;
  private statusBarItem: vscode.StatusBarItem | undefined;
  private decorationType: vscode.TextEditorDecorationType | undefined;
  private readonly emitter = new vscode.EventEmitter<TourRunnerState | undefined>();
  readonly onStateChanged = this.emitter.event;

  private constructor() {}

  static getInstance(): TourRunner {
    if (!TourRunner.instance) {
      TourRunner.instance = new TourRunner();
    }
    return TourRunner.instance;
  }

  initialize(context: vscode.ExtensionContext): void {
    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = 'codeCoach.tours.showCurrentStop';
    context.subscriptions.push(this.statusBarItem);

    // Create decoration type for highlights
    this.decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
      border: '1px solid',
      borderColor: new vscode.ThemeColor('editor.findMatchHighlightBorder')
    });
    context.subscriptions.push(this.decorationType);
  }

  dispose(): void {
    this.statusBarItem?.dispose();
    this.decorationType?.dispose();
    this.emitter.dispose();
  }

  /**
   * Check if a tour is currently running
   */
  isRunning(): boolean {
    return this.state !== undefined && !this.state.paused;
  }

  /**
   * Get the current tour state
   */
  getState(): TourRunnerState | undefined {
    return this.state;
  }

  /**
   * Start a tour
   */
  async start(tour: Tour, startIndex: number = 0): Promise<void> {
    this.state = {
      tour,
      currentIndex: startIndex,
      paused: false
    };

    this.updateStatusBar();
    this.emitter.fire(this.state);

    // Navigate to first stop
    await this.goToCurrentStop();
  }

  /**
   * Stop the current tour
   */
  stop(): void {
    this.clearHighlights();
    this.state = undefined;
    this.updateStatusBar();
    this.emitter.fire(undefined);
  }

  /**
   * Pause the current tour
   */
  pause(): void {
    if (this.state) {
      this.state.paused = true;
      this.updateStatusBar();
      this.emitter.fire(this.state);
    }
  }

  /**
   * Resume the current tour
   */
  resume(): void {
    if (this.state) {
      this.state.paused = false;
      this.updateStatusBar();
      this.emitter.fire(this.state);
    }
  }

  /**
   * Go to the next stop
   */
  async next(): Promise<boolean> {
    if (!this.state) return false;

    const tour = this.state.tour;
    if (this.state.currentIndex >= tour.stops.length - 1) {
      // Tour complete
      await this.completeTour();
      return false;
    }

    // Mark current stop as completed
    const currentStop = tour.stops[this.state.currentIndex];
    const tourManager = TourManager.getInstance();
    await tourManager.completeStop(tour.id, currentStop.id);

    // Move to next
    this.state.currentIndex++;
    this.updateStatusBar();
    this.emitter.fire(this.state);

    // Update progress
    await tourManager.updateProgress(tour.id, {
      currentStopIndex: this.state.currentIndex
    });

    await this.goToCurrentStop();
    return true;
  }

  /**
   * Go to the previous stop
   */
  async previous(): Promise<boolean> {
    if (!this.state || this.state.currentIndex <= 0) {
      return false;
    }

    this.state.currentIndex--;
    this.updateStatusBar();
    this.emitter.fire(this.state);

    // Update progress
    const tourManager = TourManager.getInstance();
    await tourManager.updateProgress(this.state.tour.id, {
      currentStopIndex: this.state.currentIndex
    });

    await this.goToCurrentStop();
    return true;
  }

  /**
   * Jump to a specific stop
   */
  async goToStop(index: number): Promise<boolean> {
    if (!this.state) return false;

    const tour = this.state.tour;
    if (index < 0 || index >= tour.stops.length) {
      return false;
    }

    this.state.currentIndex = index;
    this.updateStatusBar();
    this.emitter.fire(this.state);

    // Update progress
    const tourManager = TourManager.getInstance();
    await tourManager.updateProgress(tour.id, {
      currentStopIndex: index
    });

    await this.goToCurrentStop();
    return true;
  }

  /**
   * Get the current stop
   */
  getCurrentStop(): TourStop | undefined {
    if (!this.state) return undefined;
    return this.state.tour.stops[this.state.currentIndex];
  }

  /**
   * Navigate to the current stop's location
   */
  async goToCurrentStop(): Promise<void> {
    const stop = this.getCurrentStop();
    if (!stop) return;

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const absolutePath = path.join(workspaceFolder.uri.fsPath, stop.filePath);
    const uri = vscode.Uri.file(absolutePath);

    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc);

      // Navigate to line
      const line = Math.max(0, stop.line - 1);
      const character = stop.character || 0;
      const position = new vscode.Position(line, character);
      const range = new vscode.Range(position, position);

      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
      editor.selection = new vscode.Selection(position, position);

      // Apply highlights
      this.applyHighlights(editor, stop);

      // Show stop info
      await this.showStopInfo(stop);
    } catch (err) {
      vscode.window.showWarningMessage(
        `Could not open file: ${stop.filePath}`
      );
    }
  }

  /**
   * Show information about the current stop
   */
  async showStopInfo(stop: TourStop): Promise<void> {
    if (!this.state) return;

    const tour = this.state.tour;
    const stopNum = this.state.currentIndex + 1;
    const totalStops = tour.stops.length;

    // Build markdown content
    const content = new vscode.MarkdownString();
    content.appendMarkdown(`## ${tour.title} - Stop ${stopNum}/${totalStops}\n\n`);
    content.appendMarkdown(`### ${stop.title}\n\n`);
    content.appendMarkdown(`${stop.content}\n\n`);
    content.appendMarkdown(`---\n`);
    content.appendMarkdown(`*📍 ${stop.filePath}:${stop.line}*\n\n`);

    if (this.state.currentIndex < totalStops - 1) {
      content.appendMarkdown(`[Next Stop →](command:codeCoach.tours.next)`);
    } else {
      content.appendMarkdown(`*This is the last stop*`);
    }

    if (this.state.currentIndex > 0) {
      content.appendMarkdown(` | [← Previous](command:codeCoach.tours.previous)`);
    }

    content.appendMarkdown(` | [Stop Tour](command:codeCoach.tours.stop)`);
    content.isTrusted = true;

    // Show as information message with actions
    const nextAction = this.state.currentIndex < totalStops - 1 ? 'Next Stop' : undefined;
    const actions = [nextAction, 'Stop Tour'].filter(Boolean) as string[];

    const result = await vscode.window.showInformationMessage(
      `${tour.title} (${stopNum}/${totalStops}): ${stop.title}`,
      ...actions
    );

    if (result === 'Next Stop') {
      await this.next();
    } else if (result === 'Stop Tour') {
      this.stop();
    }
  }

  /**
   * Apply highlight decorations for the current stop
   */
  private applyHighlights(editor: vscode.TextEditor, stop: TourStop): void {
    this.clearHighlights();

    if (!stop.highlights || stop.highlights.length === 0 || !this.decorationType) {
      return;
    }

    const decorations: vscode.DecorationOptions[] = [];

    for (const highlight of stop.highlights) {
      const startLine = Math.max(0, highlight.startLine - 1);
      const endLine = Math.max(0, highlight.endLine - 1);

      const range = new vscode.Range(
        new vscode.Position(startLine, 0),
        new vscode.Position(endLine, editor.document.lineAt(endLine).text.length)
      );

      decorations.push({
        range,
        hoverMessage: highlight.note ? new vscode.MarkdownString(highlight.note) : undefined
      });
    }

    editor.setDecorations(this.decorationType, decorations);
  }

  /**
   * Clear all highlight decorations
   */
  private clearHighlights(): void {
    if (!this.decorationType) return;

    for (const editor of vscode.window.visibleTextEditors) {
      editor.setDecorations(this.decorationType, []);
    }
  }

  /**
   * Update the status bar item
   */
  private updateStatusBar(): void {
    if (!this.statusBarItem) return;

    if (!this.state) {
      this.statusBarItem.hide();
      return;
    }

    const tour = this.state.tour;
    const stopNum = this.state.currentIndex + 1;
    const totalStops = tour.stops.length;

    if (this.state.paused) {
      this.statusBarItem.text = `$(debug-pause) Tour Paused: ${tour.title}`;
    } else {
      this.statusBarItem.text = `$(book) ${tour.title} (${stopNum}/${totalStops})`;
    }

    this.statusBarItem.tooltip = `Click to show current stop`;
    this.statusBarItem.show();
  }

  /**
   * Complete the current tour
   */
  private async completeTour(): Promise<void> {
    if (!this.state) return;

    const tour = this.state.tour;

    // Mark last stop and tour as complete
    const lastStop = tour.stops[tour.stops.length - 1];
    const tourManager = TourManager.getInstance();
    await tourManager.completeStop(tour.id, lastStop.id);
    await tourManager.updateProgress(tour.id, { completed: true });

    const result = await vscode.window.showInformationMessage(
      `Congratulations! You've completed "${tour.title}"`,
      'Restart Tour',
      'Done'
    );

    if (result === 'Restart Tour') {
      await tourManager.resetProgress(tour.id);
      await this.start(tour, 0);
    } else {
      this.stop();
    }
  }
}
