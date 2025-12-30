import * as vscode from 'vscode';
import { analyzeDocumentForSmells, CodeSmell } from './smells';

const SUPPORTED_LANGS = new Set(['javascript', 'typescript', 'javascriptreact', 'typescriptreact']);

export class CoachModeInlayProvider implements vscode.InlayHintsProvider {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeInlayHints = this.emitter.event;

  refresh(): void {
    this.emitter.fire();
  }

  provideInlayHints(document: vscode.TextDocument, _range: vscode.Range): vscode.InlayHint[] {
    if (!SUPPORTED_LANGS.has(document.languageId)) return [];

    const config = vscode.workspace.getConfiguration('codeCoach');
    const enabled = config.get<boolean>('coachMode.enabled', false);
    if (!enabled) return [];

    const maxHints = clamp(config.get<number>('coachMode.maxHints', 40), 5, 200);
    const smells = analyzeDocumentForSmells(document);
    if (smells.length === 0) return [];

    const hints: vscode.InlayHint[] = [];
    for (const smell of smells) {
      if (hints.length >= maxHints) break;
      const hint = buildHint(document, smell);
      if (!hint) continue;
      hints.push(hint);
    }

    return hints;
  }
}

function buildHint(document: vscode.TextDocument, smell: CodeSmell): vscode.InlayHint | undefined {
  const position = smell.range.end;
  if (position.line >= document.lineCount) return undefined;

  const label = `// ${smell.message}`;
  const hint = new vscode.InlayHint(position, label, vscode.InlayHintKind.Type);
  hint.paddingLeft = true;
  hint.tooltip = smell.suggestion;
  return hint;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}
