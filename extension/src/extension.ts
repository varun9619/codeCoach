import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { explainSelection } from './explainSelection';
import { explainDiagnostic } from './explainDiagnostics';
import { registerRuntimeTracing } from './runtimeTracing';
import { AiProvider, clearAiApiKey, getAiConfig, setAiApiKey } from './aiSettings';
import { aiExplain } from './aiClient';
import { verifyAiResult } from './aiVerify';
import { analyzeDocumentForSmells, CodeSmell } from './smells';
import { SmellCodeActionProvider, SmellCodeLensProvider, toSmellDiagnostic } from './smellProviders';
import { DiagnosticFixCodeActionProvider } from './diagnosticFixes';
import { TestGapCodeActionProvider, TestGapCodeLensProvider } from './testGapProviders';
import { CoachModeInlayProvider } from './coachMode';
import { getDocumentSymbols, getReferences, invalidateDocumentCache } from './analysisCache';
import { initTelemetry, trackEvent } from './telemetry';
import {
  BranchSummary,
  TestGap,
  buildTestGaps,
  getBranchCoverage,
  getTestGap,
  summarizeBranches,
  storeTestGaps,
  toTestGapDiagnostic
} from './testGaps';
import { buildDeepDiveData, DeepDiveProvider } from './deepDive';

let outputChannel: vscode.OutputChannel | undefined;
let smellDiagnostics: vscode.DiagnosticCollection | undefined;
let testGapDiagnostics: vscode.DiagnosticCollection | undefined;
let deepDiveProvider: DeepDiveProvider | undefined;
let deepDiveView: vscode.TreeView<any> | undefined;
let smellCodeLensProvider: SmellCodeLensProvider | undefined;
let testGapCodeLensProvider: TestGapCodeLensProvider | undefined;
let coachModeProvider: CoachModeInlayProvider | undefined;
let peekProvider: PeekContentProvider | undefined;
let peekLinkProvider: PeekCitationLinkProvider | undefined;
const panels = new Map<string, vscode.WebviewPanel>();
let refreshTimer: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
  // Early console log for debugging - appears in Debug Console
  console.log('[Code Coach] Activate function called');

  try {
    outputChannel = vscode.window.createOutputChannel('Code Coach');
    smellDiagnostics = vscode.languages.createDiagnosticCollection('codeCoach.smells');
    testGapDiagnostics = vscode.languages.createDiagnosticCollection('codeCoach.testGaps');
    deepDiveProvider = new DeepDiveProvider();
    smellCodeLensProvider = new SmellCodeLensProvider();
    testGapCodeLensProvider = new TestGapCodeLensProvider();
    coachModeProvider = new CoachModeInlayProvider();
    peekProvider = new PeekContentProvider();
    peekLinkProvider = new PeekCitationLinkProvider();
    initTelemetry(context);

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
    outputChannel.appendLine('  • Code Coach: Trace Diagnostic Origin');
    outputChannel.appendLine('  • Code Coach: Show Code Smells');
    outputChannel.appendLine('  • Code Coach: Show Test Gaps');
    outputChannel.appendLine('  • Code Coach: Deep Dive');
    outputChannel.appendLine('  • Code Coach: Set/Clear AI API Key');
    outputChannel.appendLine('');
    outputChannel.show(true);

    console.log('[Code Coach] Output channel created and shown');

    // Also show a VS Code notification for visibility
    vscode.window.showInformationMessage('Code Coach extension activated!');

    const runtime = registerRuntimeTracing(context, outputChannel);

  context.subscriptions.push(
    outputChannel,
    smellDiagnostics,
    testGapDiagnostics,
    vscode.workspace.registerTextDocumentContentProvider('codecoach', peekProvider),
    vscode.languages.registerDocumentLinkProvider({ scheme: 'codecoach' }, peekLinkProvider),
    vscode.window.registerUriHandler(new CodeCoachUriHandler()),
    (deepDiveView = vscode.window.createTreeView('codeCoach.deepDive', { treeDataProvider: deepDiveProvider })),
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
          filePath: editor.document.uri.fsPath,
          startLineNumber: selection.start.line + 1,
          endLineNumber: selection.end.line + 1,
          diagnostics: diagnostics.slice(0, 10).map(d => ({
            message: d.message,
            code:
              typeof d.code === 'string' || typeof d.code === 'number'
                ? d.code
                : (d.code as any)?.value
          }))
        });

        const verification = verifyAiResult(ai, {
          diagnosticCodes,
          lineRange: { start: selection.start.line + 1, end: selection.end.line + 1 },
          requireCitations: true
        });
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

      presentResult('Code Coach: Explain Selection', 'codeCoach.ui.explainSelection', explanation);
      trackEvent('feature_used', {
        feature: 'explain_selection',
        mode: modeLabel,
        surface: getUiSurface('codeCoach.ui.explainSelection'),
        lines: selection.end.line - selection.start.line + 1
      });
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
      presentResult('Code Coach: Explain Diagnostic', 'codeCoach.ui.explainDiagnostic', msg);
      trackEvent('feature_used', {
        feature: 'explain_diagnostic',
        surface: getUiSurface('codeCoach.ui.explainDiagnostic'),
        code: typeof diag.code === 'number' ? diag.code : undefined
      });
    }),

    vscode.commands.registerCommand('codeCoach.explainDiagnosticAt', async (uri?: vscode.Uri, position?: vscode.Position) => {
      if (!uri || !position) {
        await vscode.commands.executeCommand('codeCoach.explainDiagnostic');
        return;
      }
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc, { preview: true });
      editor.selection = new vscode.Selection(position, position);
      await vscode.commands.executeCommand('codeCoach.explainDiagnostic');
    }),

    vscode.commands.registerCommand('codeCoach.traceDiagnosticOrigin', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage('Open a file to trace a diagnostic.');
        return;
      }

      const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
      const cursor = editor.selection.active;
      const diag = diagnostics.find(d => d.range.contains(cursor)) ?? diagnostics[0];

      if (!diag) {
        vscode.window.showInformationMessage('No diagnostics found in this file.');
        return;
      }

      const data = await buildDiagnosticOriginData(editor.document, diag);
      const surface = getUiSurface('codeCoach.ui.traceDiagnosticOrigin');
      if (surface === 'panel') {
        showTraceOriginPanel(data);
      } else {
        const report = renderDiagnosticOriginReport(data);
        presentResult('Code Coach: Trace Diagnostic Origin', 'codeCoach.ui.traceDiagnosticOrigin', report);
      }
      trackEvent('feature_used', {
        feature: 'trace_origin',
        surface,
        refs: data.references.length,
        callers: data.callGraph?.edges.length ?? 0,
        confidence: data.callGraph?.confidence
      });
    }),

    vscode.commands.registerCommand('codeCoach.showSmells', async (scope?: vscode.Range) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage('Open a file to analyze for code smells.');
        return;
      }

      const smells = analyzeDocumentForSmells(editor.document);
      if (!smells.length) {
        smellDiagnostics?.set(editor.document.uri, []);
        vscode.window.showInformationMessage('No code smells detected in this file.');
        return;
      }

      const diagnostics = smells.map(smell => toSmellDiagnostic(smell));
      smellDiagnostics?.set(editor.document.uri, diagnostics);

      const reportSmells =
        scope && scope instanceof vscode.Range ? smells.filter(smell => scope.intersection(smell.range)) : smells;
      if (reportSmells.length === 0) {
        vscode.window.showInformationMessage('No code smells detected in this scope.');
        return;
      }

      const report = formatSmellReport(editor.document, reportSmells);
      presentResult('Code Coach: Code Smells', 'codeCoach.ui.codeSmells', report);
      trackEvent('feature_used', {
        feature: 'code_smells',
        surface: getUiSurface('codeCoach.ui.codeSmells'),
        count: reportSmells.length
      });
    }),

    vscode.commands.registerCommand('codeCoach.showTestGaps', async (scope?: vscode.Range) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage('Open a file to analyze test gaps.');
        return;
      }

      const coverage = await getBranchCoverage(editor.document);
      if (!coverage) {
        testGapDiagnostics?.set(editor.document.uri, []);
        vscode.window.showInformationMessage('No lcov.info coverage found for this workspace.');
        return;
      }

      const summaryAll = summarizeBranches(coverage.data.branches);
      if (summaryAll.totalBranches === 0) {
        testGapDiagnostics?.set(editor.document.uri, []);
        vscode.window.showInformationMessage('No branch coverage data found for this file.');
        return;
      }

      const allGaps = buildTestGaps(editor.document, summaryAll.uncoveredBranches);
      storeTestGaps(editor.document.uri, allGaps);
      testGapDiagnostics?.set(editor.document.uri, allGaps.map(gap => toTestGapDiagnostic(gap)));

      const summaryScope = scope ? summarizeBranches(coverage.data.branches, scope) : summaryAll;
      if (summaryScope.totalBranches === 0) {
        vscode.window.showInformationMessage('No branch coverage data found in this scope.');
        return;
      }

      const scopedGaps =
        scope && scope instanceof vscode.Range ? allGaps.filter(gap => scope.intersection(gap.range)) : allGaps;
      let symbolLabel: string | undefined;
      if (scope) {
        const symbols = (await vscode.commands.executeCommand(
          'vscode.executeDocumentSymbolProvider',
          editor.document.uri
        )) as vscode.DocumentSymbol[] | undefined;
        const enclosing = symbols ? findEnclosingSymbol(symbols, scope.start) : undefined;
        if (enclosing) {
          symbolLabel = `${symbolKindLabel(enclosing.kind)} ${enclosing.name} (${formatRangeLabel(
            editor.document,
            enclosing.range
          )})`;
        }
      }

      const report = formatTestGapReport(editor.document, summaryScope, scopedGaps, scope, coverage.source, symbolLabel);
      presentResult('Code Coach: Test Gaps', 'codeCoach.ui.testGaps', report);
      trackEvent('feature_used', {
        feature: 'test_gaps',
        surface: getUiSurface('codeCoach.ui.testGaps'),
        branches: summaryScope.totalBranches,
        uncovered: summaryScope.totalBranches - summaryScope.coveredBranches
      });
    }),

    vscode.commands.registerCommand('codeCoach.deepDive', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage('Open a file to deep dive on a symbol.');
        return;
      }

      try {
        const data = await buildDeepDiveData(editor.document, editor.selection.active);
        if (!data) {
          vscode.window.showInformationMessage('No symbol found at the cursor.');
          return;
        }

        deepDiveProvider?.setData(data);
        await vscode.commands.executeCommand('workbench.view.explorer');

        const rootItems = deepDiveProvider?.getRootItems() ?? [];
        if (rootItems.length > 0 && deepDiveView) {
          await deepDiveView.reveal(rootItems[0], { focus: false, select: false, expand: 1 });
        }

        vscode.window.showInformationMessage(`Deep Dive ready for ${data.overview.name}.`);
        trackEvent('feature_used', {
          feature: 'deep_dive',
          usages: data.usages.length,
          blame: data.blame.length,
          tests: data.tests.length,
          coverage: Boolean(data.coverage)
        });
      } catch (err: any) {
        const message = err instanceof Error ? err.message : String(err);
        outputChannel?.appendLine(`Deep Dive failed: ${message}`);
        outputChannel?.show(true);
        vscode.window.showErrorMessage('Deep Dive failed. See Code Coach output for details.');
      }
    }),

    vscode.commands.registerCommand('codeCoach.openLocation', async (uri: vscode.Uri, range: vscode.Range) => {
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, {
        selection: range,
        preview: true
      });
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
          filePath: vscode.window.activeTextEditor?.document.uri.fsPath,
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

      presentResult('Code Coach: Explain Last Exception', 'codeCoach.ui.runtimeException', explanation);
      trackEvent('feature_used', {
        feature: 'runtime_exception',
        mode: modeLabel,
        surface: getUiSurface('codeCoach.ui.runtimeException')
      });
    }),

    vscode.commands.registerCommand('codeCoach.ai.setApiKey', async () => {
      const provider = await pickAiProvider();
      if (!provider) return;

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

      await setAiApiKey(context, provider, apiKey.trim());
      await vscode.workspace.getConfiguration('codeCoach').update('ai.provider', provider, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`Code Coach AI API key saved for ${provider}.`);
      trackEvent('feature_used', { feature: 'ai_key_set', provider });
    }),

    vscode.commands.registerCommand('codeCoach.ai.clearApiKey', async () => {
      const provider = await pickAiProvider();
      if (!provider) return;

      const choice = await vscode.window.showWarningMessage(
        `Remove the stored AI API key for ${provider}?`,
        { modal: true },
        'Remove'
      );
      if (choice !== 'Remove') return;
      await clearAiApiKey(context, provider);
      vscode.window.showInformationMessage(`Code Coach AI API key removed for ${provider}.`);
      trackEvent('feature_used', { feature: 'ai_key_clear', provider });
    }),

    vscode.commands.registerCommand('codeCoach.generateTestStub', async (uri?: vscode.Uri, line?: number, branch?: number) => {
      const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (!targetUri || line === undefined || branch === undefined) {
        vscode.window.showInformationMessage('No test gap context available to generate a stub.');
        return;
      }

      const gap = getTestGap(targetUri, line, branch);
      if (!gap) {
        vscode.window.showInformationMessage('Test gap details expired. Re-run Code Coach: Show Test Gaps.');
        return;
      }

      const document = await vscode.workspace.openTextDocument(targetUri);
      const symbols = (await vscode.commands.executeCommand(
        'vscode.executeDocumentSymbolProvider',
        targetUri
      )) as vscode.DocumentSymbol[] | undefined;
      const enclosing = symbols ? findEnclosingSymbol(symbols, new vscode.Position(Math.max(0, line - 1), 0)) : undefined;
      const scopeLabel = enclosing ? `${symbolKindLabel(enclosing.kind)} ${enclosing.name}` : 'Branch coverage';

      const rel = vscode.workspace.asRelativePath(targetUri.fsPath);
      const condition = gap.lineText || document.lineAt(Math.max(0, line - 1)).text.trim();
      const suggestion = gap.suggestion ? `// Suggested input: ${gap.suggestion}` : '// TODO: add input to hit this branch';

      const language = document.languageId.startsWith('typescript') ? 'typescript' : 'javascript';
      const content = `// Test stub for ${rel}:${line}\n// ${scopeLabel}\n// Condition: ${condition}\n${suggestion}\n\ndescribe('${enclosing?.name ?? 'branch coverage'}', () => {\n  it('covers branch at ${rel}:${line}', () => {\n    // Arrange\n    // Act\n    // Assert\n    expect(true).toBe(true);\n  });\n});\n`;
      const stubDoc = await vscode.workspace.openTextDocument({ language, content });
      await vscode.window.showTextDocument(stubDoc, { preview: false });
      trackEvent('feature_used', { feature: 'test_stub', branch });
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
    ),
    vscode.languages.registerCodeLensProvider(
      [
        { language: 'javascript' },
        { language: 'typescript' },
        { language: 'javascriptreact' },
        { language: 'typescriptreact' }
      ],
      smellCodeLensProvider ?? new SmellCodeLensProvider()
    ),
    vscode.languages.registerCodeLensProvider(
      [
        { language: 'javascript' },
        { language: 'typescript' },
        { language: 'javascriptreact' },
        { language: 'typescriptreact' }
      ],
      testGapCodeLensProvider ?? new TestGapCodeLensProvider()
    ),
    vscode.languages.registerInlayHintsProvider(
      [
        { language: 'javascript' },
        { language: 'typescript' },
        { language: 'javascriptreact' },
        { language: 'typescriptreact' }
      ],
      coachModeProvider ?? new CoachModeInlayProvider()
    ),
    vscode.languages.registerCodeActionsProvider(
      [
        { language: 'javascript' },
        { language: 'typescript' },
        { language: 'javascriptreact' },
        { language: 'typescriptreact' }
      ],
      new SmellCodeActionProvider(),
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
    ),
    vscode.languages.registerCodeActionsProvider(
      [
        { language: 'javascript' },
        { language: 'typescript' },
        { language: 'javascriptreact' },
        { language: 'typescriptreact' }
      ],
      new DiagnosticFixCodeActionProvider(),
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
    ),
    vscode.languages.registerCodeActionsProvider(
      [
        { language: 'javascript' },
        { language: 'typescript' },
        { language: 'javascriptreact' },
        { language: 'typescriptreact' }
      ],
      new TestGapCodeActionProvider(),
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
    ),
    vscode.workspace.onDidChangeTextDocument(event => {
      invalidateDocumentCache(event.document.uri);
      scheduleFeatureRefresh(event.document.languageId);
    }),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('codeCoach.coachMode')) {
        coachModeProvider?.refresh();
        trackEvent('coach_mode_toggle', {
          enabled: vscode.workspace.getConfiguration('codeCoach').get<boolean>('coachMode.enabled', false)
        });
      }
    })
  );

    console.log('[Code Coach] Activation complete - all commands registered');
  } catch (error) {
    console.error('[Code Coach] ACTIVATION FAILED:', error);
    vscode.window.showErrorMessage(`Code Coach failed to activate: ${error}`);
    throw error; // Re-throw to mark activation as failed
  }
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

function scheduleFeatureRefresh(languageId?: string): void {
  if (!languageId || (!languageId.startsWith('javascript') && !languageId.startsWith('typescript'))) return;
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    smellCodeLensProvider?.refresh();
    testGapCodeLensProvider?.refresh();
    coachModeProvider?.refresh();
    refreshTimer = undefined;
  }, 200);
}

async function buildRelatedSection(document: vscode.TextDocument, selection: vscode.Selection): Promise<string | undefined> {
  try {
    const symbols = await getDocumentSymbols(document);
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
    const refs = await getReferences(document, refPos);

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

function formatSmellReport(document: vscode.TextDocument, smells: CodeSmell[]): string {
  const out: string[] = [];
  out.push('Code Coach — Code Smells');
  out.push('');
  out.push(`File: ${vscode.workspace.asRelativePath(document.uri.fsPath)}`);
  out.push(`Detected: ${smells.length}`);
  out.push('');
  for (const smell of smells) {
    const location = formatRangeLocation(document, smell.range);
    out.push(`${severityLabel(smell.severity)} ${smell.type.toUpperCase()} @ ${location}`);
    out.push(`- ${smell.message}`);
    out.push(`- Suggestion: ${smell.suggestion}`);
    out.push('');
  }
  return out.join('\n').trimEnd();
}

function formatTestGapReport(
  document: vscode.TextDocument,
  summary: BranchSummary,
  gaps: TestGap[],
  scope: vscode.Range | undefined,
  source: string,
  symbolLabel?: string
): string {
  const rel = vscode.workspace.asRelativePath(document.uri.fsPath);
  const out: string[] = [];
  out.push('Code Coach — Test Gaps');
  out.push('');
  out.push(`File: ${rel}`);
  out.push(`Scope: ${scope ? formatRangeLabel(document, scope) : `${rel}:1-${document.lineCount}`}`);
  if (symbolLabel) {
    out.push(`Symbol: ${symbolLabel}`);
  }
  out.push(`Coverage source: ${source}`);
  out.push(`Branches: ${summary.coveredBranches}/${summary.totalBranches} covered`);
  out.push('');

  if (gaps.length === 0) {
    out.push('All branches covered in this scope.');
    return out.join('\n').trimEnd();
  }

  out.push('Uncovered branches:');
  for (const gap of gaps.slice(0, 20)) {
    const branchLabel =
      gap.branch === 0 ? 'true' : gap.branch === 1 ? 'false' : `branch ${gap.branch}`;
    out.push(`- ${rel}:${gap.line} (${branchLabel}, block ${gap.block})`);
    if (gap.lineText) out.push(`  Condition: ${gap.lineText}`);
    if (gap.suggestion) out.push(`  Suggestion: ${gap.suggestion}`);
  }
  if (gaps.length > 20) {
    out.push(`... and ${gaps.length - 20} more`);
  }

  return out.join('\n').trimEnd();
}

function formatRangeLocation(document: vscode.TextDocument, range: vscode.Range): string {
  return `${formatLocation(document.uri, range.start)}`;
}

function formatRangeLabel(document: vscode.TextDocument, range: vscode.Range): string {
  const rel = vscode.workspace.asRelativePath(document.uri.fsPath);
  return `${rel}:${range.start.line + 1}-${range.end.line + 1}`;
}

function formatLocation(uri: vscode.Uri, position: vscode.Position): string {
  const rel = vscode.workspace.asRelativePath(uri.fsPath);
  return `${rel}:${position.line + 1}`;
}

function symbolKindLabel(kind: vscode.SymbolKind): string {
  switch (kind) {
    case vscode.SymbolKind.Function:
      return 'Function';
    case vscode.SymbolKind.Method:
      return 'Method';
    case vscode.SymbolKind.Constructor:
      return 'Constructor';
    case vscode.SymbolKind.Class:
      return 'Class';
    case vscode.SymbolKind.Module:
      return 'Module';
    default:
      return 'Symbol';
  }
}

function severityLabel(severity: vscode.DiagnosticSeverity): string {
  switch (severity) {
    case vscode.DiagnosticSeverity.Error:
      return '❗';
    case vscode.DiagnosticSeverity.Warning:
      return '⚠️';
    case vscode.DiagnosticSeverity.Information:
      return 'ℹ️';
    case vscode.DiagnosticSeverity.Hint:
      return '💡';
    default:
      return '•';
  }
}

export function deactivate() {
  outputChannel?.dispose();
  outputChannel = undefined;
  smellDiagnostics?.dispose();
  smellDiagnostics = undefined;
  testGapDiagnostics?.dispose();
  testGapDiagnostics = undefined;
  deepDiveProvider?.setData(undefined);
  deepDiveProvider = undefined;
  deepDiveView?.dispose();
  deepDiveView = undefined;
  smellCodeLensProvider = undefined;
  testGapCodeLensProvider = undefined;
  coachModeProvider = undefined;
  peekProvider = undefined;
  peekLinkProvider = undefined;
  for (const panel of panels.values()) {
    panel.dispose();
  }
  panels.clear();
}

async function pickAiProvider(): Promise<AiProvider | undefined> {
  const current = getAiConfig().provider;
  const options: Array<{ label: string; description: string; provider: AiProvider }> = [
    { label: 'OpenRouter', description: current === 'openrouter' ? 'current' : '', provider: 'openrouter' },
    { label: 'OpenAI', description: current === 'openai' ? 'current' : '', provider: 'openai' },
    { label: 'Anthropic', description: current === 'anthropic' ? 'current' : '', provider: 'anthropic' },
    { label: 'Gemini', description: current === 'gemini' ? 'current' : '', provider: 'gemini' }
  ];

  const picked = await vscode.window.showQuickPick(options, {
    title: 'Code Coach: Select AI Provider',
    placeHolder: 'Choose where to store/use an API key'
  });

  return picked?.provider;
}

type UiSurface = 'output' | 'panel' | 'peek';

type TraceOriginData = {
  diagnostic: {
    message: string;
    source?: string;
    code?: string;
    location: string;
    lineText?: string;
  };
  enclosing?: {
    name: string;
    kind: vscode.SymbolKind;
    location: string;
    uri: string;
    line: number;
  };
  references: Array<{ label: string; uri: string; line: number }>;
  notes: string[];
  callGraph?: TraceCallGraph;
};

type CallGraphNode = {
  id: string;
  label: string;
  uri: string;
  line: number;
  kind?: vscode.SymbolKind;
};

type CallGraphEdge = {
  from: string;
  to: string;
};

type TraceCallGraph = {
  nodes: CallGraphNode[];
  edges: CallGraphEdge[];
  rootId: string;
  confidence: 'low' | 'medium' | 'high';
};

function presentResult(title: string, settingKey: string, content: string): void {
  const surface = getUiSurface(settingKey);
  if (surface === 'panel') {
    showInPanel(settingKey, title, content);
    return;
  }
  if (surface === 'peek') {
    showInPeek(title, content);
    return;
  }

  outputChannel?.clear();
  outputChannel?.appendLine(content);
  outputChannel?.show(true);
}

function getUiSurface(settingKey: string): UiSurface {
  const raw = vscode.workspace.getConfiguration().get<string>(settingKey, 'output');
  if (raw === 'panel' || raw === 'peek') return raw;
  return 'output';
}

function showInPanel(viewType: string, title: string, content: string): void {
  let panel = panels.get(viewType);
  if (!panel) {
    panel = vscode.window.createWebviewPanel(
      viewType,
      title,
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableFindWidget: true, retainContextWhenHidden: true, enableScripts: true }
    );
    panel.onDidDispose(() => {
      panels.delete(viewType);
    });
    panel.webview.onDidReceiveMessage(async message => {
      if (message?.type !== 'openCitation') return;
      if (typeof message.uri !== 'string') return;
      const line = typeof message.line === 'number' ? message.line : 0;
      const column = typeof message.column === 'number' ? message.column : 0;
      const uri = vscode.Uri.parse(message.uri);
      const pos = new vscode.Position(Math.max(0, line), Math.max(0, column));
      await vscode.commands.executeCommand('codeCoach.openLocation', uri, new vscode.Range(pos, pos));
    });
    panels.set(viewType, panel);
  } else {
    panel.title = title;
    panel.reveal(undefined, true);
  }

  panel.webview.html = buildPanelHtml(title, content);
}

function showInPeek(title: string, content: string): void {
  if (!peekProvider) {
    outputChannel?.appendLine(content);
    outputChannel?.show(true);
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    outputChannel?.appendLine(content);
    outputChannel?.show(true);
    return;
  }

  const markdown = renderPeekContent(title, content);
  const uri = peekProvider.createDocument(markdown, title);
  const location = new vscode.Location(uri, new vscode.Position(0, 0));
  void vscode.commands.executeCommand(
    'editor.action.peekLocations',
    editor.document.uri,
    editor.selection.active,
    [location],
    'peek'
  );
}

function buildPanelHtml(title: string, content: string): string {
  const rendered = renderPanelContent(content);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      margin: 0;
      padding: 16px;
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
    }
    .panel-title {
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--vscode-titleBar-activeForeground);
    }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      background: var(--vscode-textBlockQuote-background);
      border: 1px solid var(--vscode-panel-border);
      padding: 12px;
      border-radius: 6px;
    }
    a.citation {
      color: var(--vscode-textLink-foreground);
      text-decoration: underline;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="panel-title">${escapeHtml(title)}</div>
  <pre>${rendered}</pre>
  <script>
    const vscode = acquireVsCodeApi();
    document.addEventListener('click', event => {
      const target = event.target.closest('a[data-uri]');
      if (!target) return;
      event.preventDefault();
      const uri = target.getAttribute('data-uri');
      const line = Number(target.getAttribute('data-line') || '0');
      const column = Number(target.getAttribute('data-column') || '0');
      vscode.postMessage({ type: 'openCitation', uri, line, column });
    });
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPanelContent(content: string): string {
  return linkifyCitations(content);
}

function renderPeekContent(title: string, content: string): string {
  const trimmed = content.trimEnd();
  if (!trimmed) {
    return `# ${title}\n`;
  }

  const lines = trimmed.split('\n');
  const first = lines[0]?.trim() ?? '';
  if (first.startsWith('#')) {
    return trimmed;
  }

  const heading = first.length > 0 ? first : title;
  const rest = lines.slice(1).join('\n').replace(/^\n+/, '');
  if (!rest) {
    return `# ${heading}\n`;
  }
  return `# ${heading}\n\n${rest}`;
}

function linkifyCitations(content: string): string {
  const citationRegex = /(^|[^\\w/\\\\.-])([\\w./\\\\-]+\\.[A-Za-z0-9]+):(\\d+)(?::(\\d+))?/g;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = citationRegex.exec(content)) !== null) {
    const [fullMatch, prefix, filePart, linePart, columnPart] = match;
    result += escapeHtml(content.slice(lastIndex, match.index));

    const resolved = resolveCitationPath(filePart);
    if (resolved) {
      const uri = vscode.Uri.file(resolved).toString();
      const line = Math.max(0, Number(linePart) - 1);
      const column = columnPart ? Math.max(0, Number(columnPart) - 1) : 0;
      const label = `${filePart}:${linePart}${columnPart ? `:${columnPart}` : ''}`;
      result += `${escapeHtml(prefix)}<a class="citation" data-uri="${escapeHtml(uri)}" data-line="${line}" data-column="${column}" href="#">${escapeHtml(label)}</a>`;
    } else {
      result += escapeHtml(fullMatch);
    }

    lastIndex = match.index + fullMatch.length;
  }

  result += escapeHtml(content.slice(lastIndex));
  return result;
}

function resolveCitationPath(filePart: string): string | undefined {
  if (!filePart || filePart.startsWith('http')) return undefined;

  if (path.isAbsolute(filePart) && fs.existsSync(filePart)) {
    return path.normalize(filePart);
  }

  const folders = vscode.workspace.workspaceFolders ?? [];
  for (const folder of folders) {
    const candidate = path.join(folder.uri.fsPath, filePart);
    if (fs.existsSync(candidate)) {
      return path.normalize(candidate);
    }
  }

  return undefined;
}

class PeekContentProvider implements vscode.TextDocumentContentProvider {
  private readonly emitter = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this.emitter.event;
  private readonly contents = new Map<string, string>();
  private readonly order: string[] = [];
  private counter = 0;
  private readonly maxEntries = 30;

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contents.get(uri.toString()) ?? '';
  }

  createDocument(content: string, label?: string): vscode.Uri {
    const id = `${Date.now()}-${this.counter++}`;
    const slug = label ? slugifyLabel(label) : 'code-coach';
    const uri = vscode.Uri.from({ scheme: 'codecoach', path: `/${slug}-${id}.md` });
    const key = uri.toString();
    this.contents.set(key, content);
    this.order.push(key);
    this.trim();
    this.emitter.fire(uri);
    return uri;
  }

  private trim(): void {
    while (this.order.length > this.maxEntries) {
      const key = this.order.shift();
      if (!key) return;
      this.contents.delete(key);
    }
  }
}

function slugifyLabel(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'code-coach';
}

class PeekCitationLinkProvider implements vscode.DocumentLinkProvider {
  provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
    const links: vscode.DocumentLink[] = [];
    const regex = /(^|[^\w/\\.-])([\w./\\-]+\.[A-Za-z0-9]+):(\d+)(?::(\d+))?/g;

    for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber += 1) {
      const line = document.lineAt(lineNumber).text;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(line)) !== null) {
        const [, prefix, filePart, linePart, columnPart] = match;
        const start = match.index + prefix.length;
        const length = filePart.length + 1 + linePart.length + (columnPart ? 1 + columnPart.length : 0);
        const resolved = resolveCitationPath(filePart);
        if (!resolved) continue;
        const lineNumberTarget = Number(linePart);
        if (Number.isNaN(lineNumberTarget)) continue;
        const columnNumberTarget = columnPart ? Number(columnPart) : 1;
        const target = createCodeCoachOpenUri(resolved, lineNumberTarget, columnNumberTarget);
        const range = new vscode.Range(lineNumber, start, lineNumber, start + length);
        links.push(new vscode.DocumentLink(range, target));
      }
    }

    return links;
  }
}

class CodeCoachUriHandler implements vscode.UriHandler {
  async handleUri(uri: vscode.Uri): Promise<void> {
    if (uri.scheme !== 'codecoach-open') return;
    const params = new URLSearchParams(uri.query);
    const filePath = params.get('path');
    if (!filePath) return;
    const line = Number(params.get('line') ?? '1');
    const column = Number(params.get('col') ?? '1');
    const targetUri = vscode.Uri.file(filePath);
    const position = new vscode.Position(Math.max(0, line - 1), Math.max(0, column - 1));
    await vscode.commands.executeCommand('codeCoach.openLocation', targetUri, new vscode.Range(position, position));
  }
}

function createCodeCoachOpenUri(filePath: string, line: number, column: number): vscode.Uri {
  const query = new URLSearchParams({
    path: filePath,
    line: String(line),
    col: String(column)
  }).toString();
  return vscode.Uri.from({ scheme: 'codecoach-open', path: '/open', query });
}

async function buildDiagnosticOriginData(
  document: vscode.TextDocument,
  diag: vscode.Diagnostic
): Promise<TraceOriginData> {
  const location = formatRangeLocation(document, diag.range);
  const lineText = document.lineAt(diag.range.start.line).text.trim();

  const data: TraceOriginData = {
    diagnostic: {
      message: diag.message,
      source: diag.source,
      code: diag.code !== undefined ? String(diag.code) : undefined,
      location,
      lineText: lineText || undefined
    },
    references: [],
    notes: []
  };

  const symbols = await getDocumentSymbols(document);

  if (!symbols || symbols.length === 0) {
    data.notes.push('No symbols were found in this file, so the trace is limited to the diagnostic location.');
    return data;
  }

  const enclosing = findEnclosingSymbol(symbols, diag.range.start);
  if (!enclosing) {
    data.notes.push('No enclosing function or method was found for this diagnostic.');
    return data;
  }

  data.enclosing = {
    name: enclosing.name,
    kind: enclosing.kind,
    location: formatRangeLocation(document, enclosing.selectionRange),
    uri: document.uri.fsPath,
    line: enclosing.selectionRange.start.line + 1
  };

  const refs = await getReferences(document, enclosing.selectionRange.start);

  const refList = (refs ?? []).filter(
    ref => !(ref.uri.fsPath === document.uri.fsPath && ref.range.start.line === enclosing.selectionRange.start.line)
  );

  if (refList.length === 0) {
    data.notes.push('No references found for the enclosing symbol. It may be unused or dynamically invoked.');
    data.callGraph = await buildCallGraph(document, enclosing, []);
    return data;
  }

  data.references = refList.slice(0, 20).map(ref => ({
    label: `${formatLocation(ref.uri, ref.range.start)}`,
    uri: ref.uri.fsPath,
    line: ref.range.start.line + 1
  }));

  data.callGraph = await buildCallGraph(document, enclosing, refList.slice(0, 20));

  return data;
}

function renderDiagnosticOriginReport(data: TraceOriginData): string {
  const out: string[] = [];
  out.push('Code Coach — Trace Diagnostic Origin');
  out.push('');
  out.push(`Diagnostic: ${data.diagnostic.message}`);
  if (data.diagnostic.source) out.push(`Source: ${data.diagnostic.source}`);
  if (data.diagnostic.code) out.push(`Code: ${data.diagnostic.code}`);
  out.push(`Location: ${data.diagnostic.location}`);
  if (data.diagnostic.lineText) out.push(`Line: ${data.diagnostic.lineText}`);

  if (data.enclosing) {
    out.push('');
    out.push(`Enclosing symbol: ${data.enclosing.name} (${symbolKindLabel(data.enclosing.kind)}) @ ${data.enclosing.location}`);
  }

  if (data.references.length > 0) {
    out.push('');
    out.push('Possible callers / references (sample):');
    for (const ref of data.references) {
      out.push(`- ${ref.label}`);
    }
  }

  if (data.callGraph) {
    out.push('');
    out.push(`Call graph (static, confidence: ${data.callGraph.confidence}):`);
    if (data.callGraph.edges.length === 0) {
      out.push('- No callers resolved for this symbol.');
    } else {
      const nodeById = new Map(data.callGraph.nodes.map(node => [node.id, node]));
      for (const edge of data.callGraph.edges) {
        const from = nodeById.get(edge.from);
        const to = nodeById.get(edge.to);
        if (!from || !to) continue;
        out.push(`- ${from.label} → ${to.label}`);
      }
    }
  }

  if (data.notes.length > 0) {
    out.push('');
    out.push('Notes:');
    for (const note of data.notes) out.push(`- ${note}`);
  }

  return out.join('\n');
}

function showTraceOriginPanel(data: TraceOriginData): void {
  const viewType = 'codeCoach.traceDiagnosticOrigin';
  let panel = panels.get(viewType);
  if (!panel) {
    panel = vscode.window.createWebviewPanel(
      viewType,
      'Code Coach: Trace Diagnostic Origin',
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableFindWidget: true, retainContextWhenHidden: true, enableScripts: true }
    );
    panel.onDidDispose(() => panels.delete(viewType));
    panel.webview.onDidReceiveMessage(async message => {
      if (message?.command !== 'openLocation') return;
      if (typeof message.uri !== 'string' || typeof message.line !== 'number') return;
      const uri = vscode.Uri.file(message.uri);
      const doc = await vscode.workspace.openTextDocument(uri);
      const pos = new vscode.Position(Math.max(0, message.line - 1), 0);
      await vscode.window.showTextDocument(doc, { selection: new vscode.Range(pos, pos), preview: true });
    });
    panels.set(viewType, panel);
  } else {
    panel.reveal(undefined, true);
  }

  panel.title = 'Code Coach: Trace Diagnostic Origin';
  panel.webview.html = buildTraceOriginHtml(data);
}

function buildTraceOriginHtml(data: TraceOriginData): string {
  const referencesHtml =
    data.references.length > 0
      ? data.references
          .map(
            ref =>
              `<li><button data-uri="${encodeURIComponent(ref.uri)}" data-line="${ref.line}">${escapeHtml(
                ref.label
              )}</button></li>`
          )
          .join('')
      : '<li>No references found</li>';

  const notesHtml =
    data.notes.length > 0
      ? `<ul>${data.notes.map(note => `<li>${escapeHtml(note)}</li>`).join('')}</ul>`
      : '<span class="muted">None</span>';

  const graphHtml = renderCallGraphHtml(data.callGraph);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Trace Diagnostic Origin</title>
  <style>
    body {
      margin: 0;
      padding: 16px;
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
    }
    h2 {
      margin: 0 0 12px 0;
      font-size: 1.1rem;
      color: var(--vscode-titleBar-activeForeground);
    }
    section {
      margin-bottom: 16px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 12px;
      background: var(--vscode-sideBar-background);
    }
    .label {
      font-weight: 600;
      margin-bottom: 6px;
    }
    ul {
      margin: 6px 0 0 18px;
      padding: 0;
    }
    li {
      margin-bottom: 6px;
    }
    button {
      background: transparent;
      border: none;
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      text-align: left;
      padding: 0;
      font: inherit;
    }
    button:hover {
      text-decoration: underline;
    }
    .muted {
      color: var(--vscode-descriptionForeground);
    }
    .code {
      font-family: var(--vscode-editor-font-family);
      white-space: pre-wrap;
    }
    .graph-meta {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }
    .graph-edge {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .graph-node {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 2px 8px;
      cursor: pointer;
      font: inherit;
    }
    .graph-node.root {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
  </style>
</head>
<body>
  <h2>Trace Diagnostic Origin</h2>
  <section>
    <div class="label">Diagnostic</div>
    <div>${escapeHtml(data.diagnostic.message)}</div>
    <div class="muted">${escapeHtml(data.diagnostic.location)}</div>
    ${data.diagnostic.code ? `<div class="muted">Code: ${escapeHtml(data.diagnostic.code)}</div>` : ''}
    ${data.diagnostic.source ? `<div class="muted">Source: ${escapeHtml(data.diagnostic.source)}</div>` : ''}
    ${data.diagnostic.lineText ? `<pre class="code">${escapeHtml(data.diagnostic.lineText)}</pre>` : ''}
  </section>
  <section>
    <div class="label">Enclosing Symbol</div>
    ${
      data.enclosing
        ? `<div>${escapeHtml(data.enclosing.name)} (${escapeHtml(symbolKindLabel(data.enclosing.kind))})</div>
           <div class="muted">${escapeHtml(data.enclosing.location)}</div>`
        : `<span class="muted">Not found</span>`
    }
  </section>
  <section>
    <div class="label">Possible Callers / References</div>
    <ul>${referencesHtml}</ul>
  </section>
  <section>
    <div class="label">Call Graph (static)</div>
    ${graphHtml}
  </section>
  <section>
    <div class="label">Notes</div>
    ${notesHtml}
  </section>
  <script>
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('button[data-uri]').forEach(btn => {
      btn.addEventListener('click', () => {
        const uri = btn.getAttribute('data-uri');
        const line = Number(btn.getAttribute('data-line'));
        if (!uri || !line) return;
        vscode.postMessage({ command: 'openLocation', uri: decodeURIComponent(uri), line });
      });
    });
  </script>
</body>
</html>`;
}

function renderCallGraphHtml(callGraph?: TraceCallGraph): string {
  if (!callGraph) {
    return '<span class="muted">Not available</span>';
  }

  const nodeById = new Map(callGraph.nodes.map(node => [node.id, node]));
  const edges = callGraph.edges;
  const confidenceLabel = callGraph.confidence.toUpperCase();

  if (edges.length === 0) {
    const root = nodeById.get(callGraph.rootId);
    if (!root) return '<span class="muted">No callers resolved</span>';
    return `<div class="graph-meta">Confidence: ${confidenceLabel}</div>
<div class="graph-edge">
  <button class="graph-node root" data-uri="${encodeURIComponent(root.uri)}" data-line="${root.line}">
    ${escapeHtml(root.label)}
  </button>
  <span class="muted">No callers resolved</span>
</div>`;
  }

  const edgeHtml = edges
    .map(edge => {
      const from = nodeById.get(edge.from);
      const to = nodeById.get(edge.to);
      if (!from || !to) return '';
      return `<li class="graph-edge">
  <button class="graph-node" data-uri="${encodeURIComponent(from.uri)}" data-line="${from.line}">
    ${escapeHtml(from.label)}
  </button>
  <span>→</span>
  <button class="graph-node root" data-uri="${encodeURIComponent(to.uri)}" data-line="${to.line}">
    ${escapeHtml(to.label)}
  </button>
</li>`;
    })
    .join('');

  return `<div class="graph-meta">Confidence: ${confidenceLabel}</div>
<ul>${edgeHtml}</ul>`;
}

async function buildCallGraph(
  document: vscode.TextDocument,
  enclosing: vscode.DocumentSymbol,
  references: vscode.Location[]
): Promise<TraceCallGraph> {
  const nodes = new Map<string, CallGraphNode>();
  const edges: CallGraphEdge[] = [];
  const rootId = makeCallGraphNodeId(document.uri.fsPath, enclosing.range.start.line, enclosing.name);
  nodes.set(rootId, {
    id: rootId,
    label: `${enclosing.name} (${symbolKindLabel(enclosing.kind)})`,
    uri: document.uri.fsPath,
    line: enclosing.range.start.line + 1,
    kind: enclosing.kind
  });

  let resolvedCallers = 0;
  for (const ref of references) {
    if (edges.length >= 20) break;
    try {
      const refDoc = await vscode.workspace.openTextDocument(ref.uri);
      const symbols = await getDocumentSymbols(refDoc);
      if (!symbols) continue;
      const caller = findEnclosingSymbol(symbols, ref.range.start);
      if (!caller) continue;
      const callerId = makeCallGraphNodeId(ref.uri.fsPath, caller.selectionRange.start.line, caller.name);
      if (!nodes.has(callerId)) {
        nodes.set(callerId, {
          id: callerId,
          label: `${caller.name} (${symbolKindLabel(caller.kind)})`,
          uri: ref.uri.fsPath,
          line: caller.selectionRange.start.line + 1,
          kind: caller.kind
        });
      }
      edges.push({ from: callerId, to: rootId });
      resolvedCallers += 1;
    } catch {
      continue;
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
    rootId,
    confidence: confidenceForCallGraph(resolvedCallers)
  };
}

function makeCallGraphNodeId(filePath: string, line: number, name: string): string {
  return `${filePath}:${line}:${name}`;
}

function confidenceForCallGraph(callers: number): 'low' | 'medium' | 'high' {
  if (callers === 0) return 'low';
  if (callers < 3) return 'medium';
  return 'high';
}
