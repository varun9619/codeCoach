import * as vscode from 'vscode';
import { getDocumentSymbols } from './analysisCache';
import { trackEvent } from './telemetry';

export async function warmSymbolCache(): Promise<void> {
  const config = vscode.workspace.getConfiguration('codeCoach');
  const enabled = config.get<boolean>('performance.prewarmSymbols', false);
  if (!enabled) return;

  const delay = clampNumber(config.get<number>('performance.prewarmDelayMs', 1500), 0, 60000, 1500);
  const limit = clampNumber(config.get<number>('performance.prewarmFileLimit', 200), 10, 2000, 200);
  const patterns = config.get<string[]>('performance.prewarmGlob', ['**/*.{ts,tsx,js,jsx}']) ?? [];
  const exclude = config.get<string>('performance.prewarmExclude', '**/node_modules/**') ?? '**/node_modules/**';

  setTimeout(() => {
    void runWarmup(patterns, exclude, limit);
  }, delay);
}

async function runWarmup(patterns: string[], exclude: string, limit: number): Promise<void> {
  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) return;

  const uris: vscode.Uri[] = [];
  for (const pattern of patterns) {
    const files = await vscode.workspace.findFiles(pattern, exclude, limit);
    for (const file of files) {
      if (uris.length >= limit) break;
      uris.push(file);
    }
    if (uris.length >= limit) break;
  }

  const start = Date.now();
  let warmed = 0;
  for (const uri of uris) {
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      await getDocumentSymbols(doc);
      warmed += 1;
    } catch {
      continue;
    }
    await sleep(10);
  }

  trackEvent('prewarm.completed', { files: warmed, ms: Date.now() - start });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function clampNumber(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}
