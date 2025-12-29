import * as vscode from 'vscode';
import { explainSelection } from './explainSelection';
import { explainDiagnostic } from './explainDiagnostics';
import { registerRuntimeTracing } from './runtimeTracing';
import { clearAiApiKey, setAiApiKey } from './aiSettings';
import { aiExplain } from './aiClient';
import { verifyAiResult } from './aiVerify';

let outputChannel: vscode.OutputChannel | undefined;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Code Coach');

  // Startup logging for debugging
  outputChannel.appendLine('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  outputChannel.appendLine('🚀 Code Coach activated!');
  outputChannel.appendLine(`   Version: ${context.extension.packageJSON.version}`);
  outputChannel.appendLine(`   Workspace: ${vscode.workspace.name ?? 'No workspace'}`);
  outputChannel.appendLine('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  outputChannel.appendLine('');
  outputChannel.appendLine('Commands available:');
  outputChannel.appendLine('  • Code Coach: Explain Selection');
  outputChannel.appendLine('  • Code Coach: Explain Diagnostic');
  outputChannel.appendLine('  • Code Coach: Explain Last Exception');
  outputChannel.appendLine('  • Code Coach: Set/Clear AI API Key');
  outputChannel.appendLine('');
  outputChannel.show(true);

  const runtime = registerRuntimeTracing(context, outputChannel);

  context.subscriptions.push(
    outputChannel,
    vscode.commands.registerCommand('codeCoach.explainSelection', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage('Open a file and select code to explain.');
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showInformationMessage('Select some code first.');
        return;
      }

      const text = editor.document.getText(selection);

      const diagnostics = vscode.languages
        .getDiagnostics(editor.document.uri)
        .filter(d => d.range.intersection(selection) !== undefined);
      const diagnosticCodes = diagnostics
        .map(d => (typeof d.code === 'number' ? d.code : undefined))
        .filter((n): n is number => typeof n === 'number');

      let explanation: string;
      let modeLabel: 'AI' | 'Static' = 'Static';
      let aiFailure: string | undefined;
      try {
        const ai = await aiExplain(context, {
          kind: 'selection',
          languageId: editor.document.languageId,
          code: text,
          diagnostics: diagnostics.slice(0, 10).map(d => ({
            message: d.message,
            code:
              typeof d.code === 'string' || typeof d.code === 'number'
                ? d.code
                : (d.code as any)?.value
          }))
        });

        const verification = verifyAiResult(ai, { diagnosticCodes });
        modeLabel = 'AI';
        explanation = ai.explanationMarkdown;
        if (!verification.verified) {
          explanation += `\n\n---\nVerification notes:\n${verification.notes.map(n => `- ${n}`).join('\n')}`;
        }
      } catch (err: any) {
        aiFailure = err instanceof Error ? err.message : String(err);
        explanation = explainSelection({
          text,
          languageId: editor.document.languageId,
          startLineNumber: selection.start.line + 1
        });
      }

      const related = await buildRelatedSection(editor.document, selection);
      if (related) {
        explanation += `\n\n${related}`;
      }

      explanation = `Code Coach (Mode: ${modeLabel})\n` + explanation;
      if (modeLabel === 'Static' && aiFailure) {
        explanation += `\n\nAI was enabled but not used because the AI request failed:\n- ${aiFailure}`;
      }

      outputChannel?.clear();
      outputChannel?.appendLine(explanation);
      outputChannel?.show(true);
    }),

    vscode.commands.registerCommand('codeCoach.explainDiagnostic', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage('Open a file to explain a diagnostic.');
        return;
      }

      const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
      const cursor = editor.selection.active;
      const diag = diagnostics.find(d => d.range.contains(cursor)) ?? diagnostics[0];

      if (!diag) {
        vscode.window.showInformationMessage('No diagnostics found in this file.');
        return;
      }

      const msg = explainDiagnostic(diag, editor.document.languageId);
      outputChannel?.clear();
      outputChannel?.appendLine(msg);
      outputChannel?.show(true);
    }),

    vscode.commands.registerCommand('codeCoach.explainLastException', async () => {
      const report = runtime.getLastExceptionReport();
      if (!report) {
        vscode.window.showInformationMessage('No runtime exception captured yet. Start a debug session and break on exception.');
        return;
      }

      // Try AI to enhance the runtime report (still verified against captured locals).
      let explanation: string = report;
      let modeLabel: 'AI' | 'Static' = 'Static';
      let aiFailure: string | undefined;
      try {
        const ai = await aiExplain(context, {
          kind: 'exception',
          languageId: vscode.window.activeTextEditor?.document.languageId ?? 'unknown',
          code: vscode.window.activeTextEditor?.document.getText() ?? '',
          runtime: parseRuntimeReport(report)
        });

        const evidenceLocals = parseRuntimeReport(report)?.locals?.map(v => v.name) ?? [];
        const verification = verifyAiResult(ai, { localVariables: evidenceLocals });
        modeLabel = 'AI';
        explanation = ai.explanationMarkdown;
        if (!verification.verified) {
          explanation += `\n\n---\nVerification notes:\n${verification.notes.map(n => `- ${n}`).join('\n')}`;
        }
      } catch (err: any) {
        aiFailure = err instanceof Error ? err.message : String(err);
        // Keep the raw runtime report
      }

      explanation = `Code Coach (Mode: ${modeLabel})\n` + explanation;
      if (modeLabel === 'Static' && aiFailure) {
        explanation += `\n\nAI was enabled but not used because the AI request failed:\n- ${aiFailure}`;
      }

      outputChannel?.clear();
      outputChannel?.appendLine(explanation);
      outputChannel?.show(true);
    }),

    vscode.commands.registerCommand('codeCoach.ai.setApiKey', async () => {
      const apiKey = await vscode.window.showInputBox({
        title: 'Code Coach: Set AI API Key',
        prompt: 'Paste your API key. It will be stored securely in VS Code Secret Storage.',
        password: true,
        ignoreFocusOut: true
      });

      if (apiKey === undefined) return;
      if (apiKey.trim().length === 0) {
        vscode.window.showWarningMessage('API key was empty. Nothing saved.');
        return;
      }

      await setAiApiKey(context, apiKey.trim());
      vscode.window.showInformationMessage('Code Coach AI API key saved (Secret Storage).');
    }),

    vscode.commands.registerCommand('codeCoach.ai.clearApiKey', async () => {
      const choice = await vscode.window.showWarningMessage(
        'Remove the stored AI API key from VS Code Secret Storage?',
        { modal: true },
        'Remove'
      );
      if (choice !== 'Remove') return;
      await clearAiApiKey(context);
      vscode.window.showInformationMessage('Code Coach AI API key removed.');
    })
  );

  const hoverProvider: vscode.HoverProvider = {
    provideHover(document, position) {
      const diagnostics = vscode.languages.getDiagnostics(document.uri);
      const diag = diagnostics.find(d => d.range.contains(position));
      if (!diag) {
        return null;
      }

      const explanation = explainDiagnostic(diag, document.languageId);
      const md = new vscode.MarkdownString(explanation);
      md.isTrusted = false;
      return new vscode.Hover(md, diag.range);
    }
  };

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      [
        { language: 'javascript' },
        { language: 'typescript' },
        { language: 'javascriptreact' },
        { language: 'typescriptreact' }
      ],
      hoverProvider
    )
  );
}

function parseRuntimeReport(report: string): { stoppedAt?: string; locals?: Array<{ name: string; value: string; type?: string }> } {
  const lines = report.replace(/\r\n/g, '\n').split('\n');
  const stoppedLine = lines.find(l => l.startsWith('Stopped at: '));
  const stoppedAt = stoppedLine ? stoppedLine.replace('Stopped at: ', '').trim() : undefined;

  const localsStart = lines.findIndex(l => l.trim() === 'Locals (snapshot):');
  if (localsStart === -1) return { stoppedAt };

  const locals: Array<{ name: string; value: string; type?: string }> = [];
  for (let i = localsStart + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('- ')) break;
    const raw = line.slice(2);
    // Format: name[: type] = value
    const eq = raw.indexOf(' = ');
    if (eq === -1) continue;
    const left = raw.slice(0, eq);
    const value = raw.slice(eq + 3);
    const typeSep = left.indexOf(': ');
    if (typeSep === -1) {
      locals.push({ name: left.trim(), value });
    } else {
      locals.push({ name: left.slice(0, typeSep).trim(), type: left.slice(typeSep + 2).trim(), value });
    }
  }

  return { stoppedAt, locals };
}

async function buildRelatedSection(document: vscode.TextDocument, selection: vscode.Selection): Promise<string | undefined> {
  try {
    const symbols = (await vscode.commands.executeCommand(
      'vscode.executeDocumentSymbolProvider',
      document.uri
    )) as vscode.DocumentSymbol[] | undefined;
    if (!symbols || symbols.length === 0) return undefined;

    const enclosing = findEnclosingSymbol(symbols, selection.active);
    if (!enclosing) return undefined;

    // Only show related for function-like symbols.
    if (
      enclosing.kind !== vscode.SymbolKind.Function &&
      enclosing.kind !== vscode.SymbolKind.Method &&
      enclosing.kind !== vscode.SymbolKind.Constructor
    ) {
      return undefined;
    }

    const refPos = enclosing.selectionRange.start;
    const refs = (await vscode.commands.executeCommand(
      'vscode.executeReferenceProvider',
      document.uri,
      refPos
    )) as vscode.Location[] | undefined;

    const out: string[] = [];
    out.push('Related:');
    out.push(`- Symbol: ${enclosing.name} (${document.fileName}:${enclosing.selectionRange.start.line + 1})`);

    const refList = (refs ?? []).filter(r => !r.uri.fsPath.endsWith(document.uri.fsPath) || r.range.start.line !== refPos.line);
    if (refList.length > 0) {
      out.push('- Usages (sample):');
      for (const loc of refList.slice(0, 5)) {
        out.push(`  - ${loc.uri.fsPath}:${loc.range.start.line + 1}`);
      }
    }

    return out.join('\n');
  } catch {
    return undefined;
  }
}

function findEnclosingSymbol(symbols: vscode.DocumentSymbol[], position: vscode.Position): vscode.DocumentSymbol | undefined {
  for (const sym of symbols) {
    if (!sym.range.contains(position)) continue;
    const child = findEnclosingSymbol(sym.children, position);
    return child ?? sym;
  }
  return undefined;
}

export function deactivate() {
  outputChannel?.dispose();
  outputChannel = undefined;
}
