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
import { warmSymbolCache } from './workspaceIndex';
import { ConfigManager, ConfigTemplate } from './configManager';
import { TemplateManager } from './templates/templateManager';
import { TeamPinManager, SUGGESTED_TAGS, symbolKindToString } from './teamPins';
import {
  getRepoRoot,
  getWorkingTreeDiff,
  getCommitDiff,
  parseDiff,
  generateStaticDiffExplanation,
  formatDiffExplanationMarkdown,
  describeSource
} from './explainDiff';
import { DiffSource, DEFAULT_EXPLAIN_DIFF_CONFIG } from './diffTypes';
import { TourManager } from './tours/tourManager';
import { TourRunner } from './tours/tourRunner';
import { SubscriptionManager } from './subscriptions/subscriptionManager';
import { ChangeDetector } from './subscriptions/changeDetector';
import { ExplanationCache } from './cache/explanationCache';
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
import {
  buildDeepDiveData,
  DeepDiveData,
  DeepDivePin,
  DeepDiveProvider,
  DeepDiveSection,
  formatDeepDiveMarkdown,
  serializeDeepDiveData
} from './deepDive';

let outputChannel: vscode.OutputChannel | undefined;
let smellDiagnostics: vscode.DiagnosticCollection | undefined;
let testGapDiagnostics: vscode.DiagnosticCollection | undefined;
let deepDiveProvider: DeepDiveProvider | undefined;
let deepDiveView: vscode.TreeView<any> | undefined;
let lastDeepDiveData: DeepDiveData | undefined;
let deepDivePins: DeepDivePin[] = [];
const DEEP_DIVE_PIN_KEY = 'codeCoach.deepDive.pins';
const ONBOARDING_SHOWN_KEY = 'codeCoach.onboardingShown';
const CONFIG_PROMPT_DISMISSED_KEY = 'codeCoach.configPromptDismissed';
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

    // Initialize ConfigManager (cascading config system)
    const configManager = ConfigManager.getInstance();
    configManager.initialize(context).catch(err => {
      console.error('[Code Coach] ConfigManager initialization failed:', err);
    });
    context.subscriptions.push({ dispose: () => configManager.dispose() });

    // Initialize TemplateManager
    const templateManager = TemplateManager.getInstance();
    templateManager.initialize(context).catch(err => {
      console.error('[Code Coach] TemplateManager initialization failed:', err);
    });
    context.subscriptions.push({ dispose: () => templateManager.dispose() });

    // Initialize TeamPinManager
    const teamPinManager = TeamPinManager.getInstance();
    teamPinManager.initialize(context).catch(err => {
      console.error('[Code Coach] TeamPinManager initialization failed:', err);
    });
    context.subscriptions.push({ dispose: () => teamPinManager.dispose() });

    // Wire up team pins to Deep Dive provider
    deepDiveProvider.setTeamPins(teamPinManager.getAllPins());
    teamPinManager.onPinsChanged(() => {
      deepDiveProvider?.setTeamPins(teamPinManager.getAllPins());
    });

    // Initialize TourManager
    const tourManager = TourManager.getInstance();
    tourManager.initialize(context).catch(err => {
      console.error('[Code Coach] TourManager initialization failed:', err);
    });
    context.subscriptions.push({ dispose: () => tourManager.dispose() });

    // Initialize TourRunner
    const tourRunner = TourRunner.getInstance();
    tourRunner.initialize(context);
    context.subscriptions.push({ dispose: () => tourRunner.dispose() });

    // Initialize SubscriptionManager
    const subscriptionManager = SubscriptionManager.getInstance();
    subscriptionManager.initialize(context).catch(err => {
      console.error('[Code Coach] SubscriptionManager initialization failed:', err);
    });
    context.subscriptions.push({ dispose: () => subscriptionManager.dispose() });

    // Initialize ExplanationCache
    const explanationCache = ExplanationCache.getInstance();
    explanationCache.initialize(context).catch(err => {
      console.error('[Code Coach] ExplanationCache initialization failed:', err);
    });
    context.subscriptions.push({ dispose: () => explanationCache.dispose() });

    deepDivePins = loadDeepDivePins(context);
    deepDiveProvider.setPinned(deepDivePins);
    applyDeepDiveSectionFilter();

    // Startup logging for debugging
    outputChannel.appendLine('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    outputChannel.appendLine('🚀 Code Coach activated!');
    outputChannel.appendLine(`   Version: ${context.extension.packageJSON.version}`);
    outputChannel.appendLine(`   Workspace: ${vscode.workspace.name ?? 'No workspace'}`);
    outputChannel.appendLine('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    outputChannel.appendLine('');
    outputChannel.appendLine('Commands available:');
    outputChannel.appendLine('  • Code Coach: Explain Selection');
    outputChannel.appendLine('  • Code Coach: Explain Why This Works');
    outputChannel.appendLine('  • Code Coach: Explain Diagnostic');
    outputChannel.appendLine('  • Code Coach: Explain Last Exception');
    outputChannel.appendLine('  • Code Coach: Trace Diagnostic Origin');
    outputChannel.appendLine('  • Code Coach: Trace Stack Trace');
    outputChannel.appendLine('  • Code Coach: Show Code Smells');
    outputChannel.appendLine('  • Code Coach: Show Test Gaps');
    outputChannel.appendLine('  • Code Coach: Deep Dive');
    outputChannel.appendLine('  • Code Coach: Pin/Unpin Deep Dive');
    outputChannel.appendLine('  • Code Coach: Deep Dive Sections');
    outputChannel.appendLine('  • Code Coach: Export Deep Dive');
    outputChannel.appendLine('  • Code Coach: Set/Clear AI API Key');
    outputChannel.appendLine('  • Code Coach: Init Config');
    outputChannel.appendLine('  • Code Coach: Open Project Config');
    outputChannel.appendLine('  • Code Coach: Open Global Config');
    outputChannel.appendLine('');
    outputChannel.show(true);

    console.log('[Code Coach] Output channel created and shown');

    // Also show a VS Code notification for visibility
    vscode.window.showInformationMessage('Code Coach extension activated!');
    trackEvent('extension.activated', {
      version: context.extension.packageJSON.version,
      platform: process.platform
    });

    void maybeShowOnboarding(context);
    void warmSymbolCache();
    void maybePromptConfigInit(context, configManager);

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
      const relPath = vscode.workspace.asRelativePath(editor.document.uri.fsPath);
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
          startLineNumber: selection.start.line + 1,
          filePath: relPath
        });
      }

      const related = await buildRelatedSection(editor.document, selection);
      if (related) {
        explanation += `\n\n${related}`;
      }

      if (modeLabel === 'AI') {
        explanation = `Code Coach (Mode: ${modeLabel})\nFile: ${relPath}:${selection.start.line + 1}-${selection.end.line + 1}\n\n${explanation}`;
      } else {
        explanation = `Code Coach (Mode: ${modeLabel})\n` + explanation;
      }
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
      trackEvent('explain.selection.invoked', {
        languageId: editor.document.languageId,
        lineCount: selection.end.line - selection.start.line + 1,
        mode: modeLabel
      });
    }),

    vscode.commands.registerCommand('codeCoach.explainWhyWorks', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage('Open a file and select code to analyze.');
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showInformationMessage('Select some code first.');
        return;
      }

      const text = editor.document.getText(selection);
      let explanation: string;
      let modeLabel: 'AI' | 'Static' = 'Static';
      let aiFailure: string | undefined;
      const relPath = vscode.workspace.asRelativePath(editor.document.uri.fsPath);

      try {
        const ai = await aiExplain(context, {
          kind: 'why',
          languageId: editor.document.languageId,
          code: text,
          filePath: editor.document.uri.fsPath,
          startLineNumber: selection.start.line + 1,
          endLineNumber: selection.end.line + 1
        });
        const verification = verifyAiResult(ai, {
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
        explanation = buildWhyWorksFallback(editor.document, text, selection.start.line + 1, relPath);
      }

      const related = await buildRelatedSection(editor.document, selection);
      if (related) {
        explanation += `\n\n${related}`;
      }

      if (modeLabel === 'AI') {
        explanation = `Code Coach (Mode: ${modeLabel})\nFile: ${relPath}:${selection.start.line + 1}-${selection.end.line + 1}\n\n${explanation}`;
      } else {
        explanation = `Code Coach (Mode: ${modeLabel})\n` + explanation;
      }
      if (modeLabel === 'Static' && aiFailure) {
        explanation += `\n\nAI was enabled but not used because the AI request failed:\n- ${aiFailure}`;
      }

      presentResult('Code Coach: Explain Why This Works', 'codeCoach.ui.explainWhyWorks', explanation);
      trackEvent('feature_used', {
        feature: 'explain_why_works',
        mode: modeLabel,
        surface: getUiSurface('codeCoach.ui.explainWhyWorks'),
        lines: selection.end.line - selection.start.line + 1
      });
      trackEvent('explain.why.invoked', {
        languageId: editor.document.languageId,
        lineCount: selection.end.line - selection.start.line + 1,
        mode: modeLabel
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

      const relPath = vscode.workspace.asRelativePath(editor.document.uri.fsPath);
      const locationLabel = `${relPath}:${diag.range.start.line + 1}`;
      const snippet = buildDiagnosticSnippet(editor.document, diag.range);
      const snippetStart = Math.max(0, diag.range.start.line - 2) + 1;
      const snippetEnd = Math.min(editor.document.lineCount, diag.range.end.line + 3);

      let explanation: string;
      let modeLabel: 'AI' | 'Static' = 'Static';
      let aiFailure: string | undefined;

      try {
        const ai = await aiExplain(context, {
          kind: 'diagnostic',
          languageId: editor.document.languageId,
          code: snippet,
          filePath: editor.document.uri.fsPath,
          startLineNumber: snippetStart,
          endLineNumber: snippetEnd,
          diagnostics: [
            {
              message: diag.message,
              code: typeof diag.code === 'string' || typeof diag.code === 'number' ? diag.code : (diag.code as any)?.value
            }
          ]
        });
        const verification = verifyAiResult(ai, {
          lineRange: { start: snippetStart, end: snippetEnd },
          requireCitations: true
        });
        modeLabel = 'AI';
        explanation = ai.explanationMarkdown;
        if (!verification.verified) {
          explanation += `\n\n---\nVerification notes:\n${verification.notes.map(n => `- ${n}`).join('\n')}`;
        }
      } catch (err: any) {
        aiFailure = err instanceof Error ? err.message : String(err);
        explanation = explainDiagnostic(diag, editor.document.languageId, locationLabel);
      }

      if (modeLabel === 'AI') {
        explanation = `Code Coach (Mode: ${modeLabel})\nFile: ${locationLabel}\n\n${explanation}`;
      } else {
        explanation = `Code Coach (Mode: ${modeLabel})\n` + explanation;
      }

      if (modeLabel === 'Static' && aiFailure) {
        explanation += `\n\nAI was enabled but not used because the AI request failed:\n- ${aiFailure}`;
      }

      presentResult('Code Coach: Explain Diagnostic', 'codeCoach.ui.explainDiagnostic', explanation);
      trackEvent('feature_used', {
        feature: 'explain_diagnostic',
        surface: getUiSurface('codeCoach.ui.explainDiagnostic'),
        code: typeof diag.code === 'number' ? diag.code : undefined
      });
      trackEvent('explain.diagnostic.invoked', {
        languageId: editor.document.languageId,
        code: typeof diag.code === 'number' ? diag.code : undefined,
        mode: modeLabel
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

    vscode.commands.registerCommand('codeCoach.traceStackTrace', async () => {
      const input = await vscode.window.showInputBox({
        title: 'Code Coach: Trace Stack Trace',
        prompt: 'Paste a stack trace. Leave empty to use clipboard contents.',
        ignoreFocusOut: true
      });

      let stack = input ?? '';
      if (!stack.trim()) {
        stack = await vscode.env.clipboard.readText();
      }
      if (!stack.trim()) {
        vscode.window.showInformationMessage('No stack trace provided or found in clipboard.');
        return;
      }

      const frames = parseStackTrace(stack);
      if (frames.length === 0) {
        vscode.window.showInformationMessage('No stack frames recognized in the provided stack trace.');
        return;
      }

      const data: TraceOriginData = {
        diagnostic: {
          message: 'Stack trace (parsed)',
          location: `Frames: ${frames.length}`
        },
        references: [],
        notes: [`Parsed ${frames.length} stack frames.`],
        callGraph: buildCallGraphFromFrames(frames)
      };

      const surface = getUiSurface('codeCoach.ui.traceDiagnosticOrigin');
      if (surface === 'panel') {
        showTraceOriginPanel(data);
      } else {
        const report = renderDiagnosticOriginReport(data);
        presentResult('Code Coach: Trace Stack Trace', 'codeCoach.ui.traceDiagnosticOrigin', report);
      }

      trackEvent('feature_used', {
        feature: 'trace_stack',
        surface,
        frames: frames.length
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
      trackEvent('smell.detected', {
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
        const symbols = await getDocumentSymbols(editor.document);
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
      trackEvent('testgap.detected', {
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

        await maybeAttachDeepDiveSummary(context, editor.document, data);
        deepDiveProvider?.setData(data);
        lastDeepDiveData = data;
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
        trackEvent('deepdive.opened', {
          symbol: data.overview.name,
          usages: data.usages.length,
          history: data.history.length,
          tests: data.tests.length
        });
      } catch (err: any) {
        const message = err instanceof Error ? err.message : String(err);
        outputChannel?.appendLine(`Deep Dive failed: ${message}`);
        outputChannel?.show(true);
        vscode.window.showErrorMessage('Deep Dive failed. See Code Coach output for details.');
        trackEvent('error.occurred', { errorType: 'deep_dive', message });
      }
    }),

    vscode.commands.registerCommand('codeCoach.deepDive.pinCurrent', async () => {
      if (!lastDeepDiveData) {
        vscode.window.showInformationMessage('Run Deep Dive on a symbol before pinning.');
        return;
      }
      const pin = buildPinFromDeepDive(lastDeepDiveData);
      if (deepDivePins.some(existing => existing.id === pin.id)) {
        vscode.window.showInformationMessage('This symbol is already pinned.');
        return;
      }
      deepDivePins = [pin, ...deepDivePins].slice(0, 20);
      await persistDeepDivePins(context);
      deepDiveProvider?.setPinned(deepDivePins);
      vscode.window.showInformationMessage(`Pinned ${pin.name}.`);
    }),

    vscode.commands.registerCommand('codeCoach.deepDive.unpin', async (pinId?: string) => {
      if (deepDivePins.length === 0) {
        vscode.window.showInformationMessage('No pinned symbols to remove.');
        return;
      }
      const targetId =
        pinId ??
        (await pickDeepDivePinId(
          deepDivePins,
          'Select a pinned symbol to remove'
        ));
      if (!targetId) return;
      deepDivePins = deepDivePins.filter(pin => pin.id !== targetId);
      await persistDeepDivePins(context);
      deepDiveProvider?.setPinned(deepDivePins);
      vscode.window.showInformationMessage('Pinned symbol removed.');
    }),

    vscode.commands.registerCommand('codeCoach.deepDive.openPinned', async (pinId?: string) => {
      if (!pinId) {
        vscode.window.showInformationMessage('No pinned symbol selected.');
        return;
      }
      const pin = deepDivePins.find(entry => entry.id === pinId);
      if (!pin) {
        vscode.window.showInformationMessage('Pinned symbol not found.');
        return;
      }
      const uri = vscode.Uri.file(pin.filePath);
      const doc = await vscode.workspace.openTextDocument(uri);
      const position = new vscode.Position(Math.max(0, pin.line - 1), Math.max(0, pin.character));
      const editor = await vscode.window.showTextDocument(doc, { preview: true });
      editor.selection = new vscode.Selection(position, position);
      const data = await buildDeepDiveData(doc, position);
      if (!data) {
        vscode.window.showInformationMessage('Unable to resolve pinned symbol in the current file.');
        return;
      }
      deepDiveProvider?.setData(data);
      lastDeepDiveData = data;
      await vscode.commands.executeCommand('workbench.view.explorer');
      const rootItems = deepDiveProvider?.getRootItems() ?? [];
      if (rootItems.length > 0 && deepDiveView) {
        await deepDiveView.reveal(rootItems[0], { focus: false, select: false, expand: 1 });
      }
      trackEvent('feature_used', { feature: 'deep_dive_open_pin' });
    }),

    vscode.commands.registerCommand('codeCoach.deepDive.filterSections', async () => {
      const sections = getDeepDiveSections();
      const picked = await vscode.window.showQuickPick(
        sections.map(section => ({
          label: section.label,
          description: section.id,
          picked: isSectionEnabled(section.id)
        })),
        { canPickMany: true, title: 'Deep Dive Sections' }
      );
      if (!picked) return;
      const values = picked
        .map(item => item.description)
        .filter((v): v is DeepDiveSection => Boolean(v));
      if (values.length === 0) {
        vscode.window.showInformationMessage('Select at least one section to keep it visible.');
        return;
      }
      await vscode.workspace
        .getConfiguration('codeCoach')
        .update('deepDive.sections', values, vscode.ConfigurationTarget.Global);
      applyDeepDiveSectionFilter();
    }),

    vscode.commands.registerCommand('codeCoach.deepDive.export', async () => {
      if (!lastDeepDiveData) {
        vscode.window.showInformationMessage('Run Deep Dive before exporting.');
        return;
      }
      const format = await vscode.window.showQuickPick(
        [
          { label: 'Markdown report', description: 'md', value: 'markdown' },
          { label: 'JSON snapshot', description: 'json', value: 'json' }
        ],
        { title: 'Export Deep Dive' }
      );
      if (!format) return;

      const defaultExt = format.value === 'markdown' ? 'md' : 'json';
      const defaultName = `${lastDeepDiveData.overview.name.replace(/[^\w.-]+/g, '_')}.deepdive.${defaultExt}`;
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '', defaultName)),
        filters:
          format.value === 'markdown'
            ? { Markdown: ['md'] }
            : { JSON: ['json'] }
      });
      if (!uri) return;

      const content =
        format.value === 'markdown'
          ? formatDeepDiveMarkdown(lastDeepDiveData)
          : JSON.stringify(serializeDeepDiveData(lastDeepDiveData), null, 2);
      await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
      vscode.window.showInformationMessage(`Deep Dive exported to ${vscode.workspace.asRelativePath(uri.fsPath)}.`);
      trackEvent('feature_used', { feature: 'deep_dive_export', format: format.value });
    }),

    vscode.commands.registerCommand('codeCoach.onboarding.run', async () => {
      await runOnboarding(context, true);
    }),

    vscode.commands.registerCommand('codeCoach.feedback.helpful', async () => {
      await captureFeedback(true);
    }),

    vscode.commands.registerCommand('codeCoach.feedback.notHelpful', async () => {
      await captureFeedback(false);
    }),

    vscode.commands.registerCommand('codeCoach.openLocation', async (uri: vscode.Uri, range: vscode.Range) => {
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, {
        selection: range,
        preview: true
      });
    }),

    vscode.commands.registerCommand(
      'codeCoach.applyDiagnosticFix',
      async (uri: vscode.Uri, position: vscode.Position, insertText: string, fixType: string) => {
        const edit = new vscode.WorkspaceEdit();
        edit.insert(uri, position, insertText);
        await vscode.workspace.applyEdit(edit);
        trackEvent('diagnostic.fix.applied', { fixType });
      }
    ),

    vscode.commands.registerCommand(
      'codeCoach.previewSmellFix',
      async (
        uri: vscode.Uri,
        range: vscode.Range,
        replacement: string,
        title: string,
        editMode: 'replace' | 'insert' = 'replace',
        smellKind?: string
      ) => {
        const doc = await vscode.workspace.openTextDocument(uri);
        const original = doc.getText();
        let updated = original;

        if (editMode === 'insert') {
          const insertPos = new vscode.Position(range.start.line, 0);
          const insertOffset = doc.offsetAt(insertPos);
          updated = `${original.slice(0, insertOffset)}${replacement}${original.slice(insertOffset)}`;
        } else {
          const startOffset = doc.offsetAt(range.start);
          const endOffset = doc.offsetAt(range.end);
          updated = `${original.slice(0, startOffset)}${replacement}${original.slice(endOffset)}`;
        }

        const previewDoc = await vscode.workspace.openTextDocument({
          content: updated,
          language: doc.languageId
        });

        trackEvent('smell_fix_preview', { kind: smellKind ?? 'unknown', mode: editMode });
        await vscode.commands.executeCommand('vscode.diff', uri, previewDoc.uri, title);
        const choice = await vscode.window.showInformationMessage('Apply this fix?', 'Apply', 'Cancel');
        if (choice !== 'Apply') return;

        const edit = new vscode.WorkspaceEdit();
        if (editMode === 'insert') {
          const insertPos = new vscode.Position(range.start.line, 0);
          edit.insert(uri, insertPos, replacement);
        } else {
          edit.replace(uri, range, replacement);
        }
        await vscode.workspace.applyEdit(edit);
        trackEvent('smell_fix_apply', { kind: smellKind ?? 'unknown', mode: editMode });
      }
    ),

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
      const symbols = await getDocumentSymbols(document);
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
    }),

    // ─────────────────────────────────────────────────────────────
    // Configuration Management Commands
    // ─────────────────────────────────────────────────────────────
    vscode.commands.registerCommand('codeCoach.config.init', async () => {
      const templates: Array<{ label: string; template: ConfigTemplate; description: string }> = [
        { label: 'Minimal', template: 'minimal', description: 'Basic config with offline mode' },
        { label: 'Team Standard', template: 'team-standard', description: 'AI enabled, redacted privacy mode' },
        { label: 'Enterprise', template: 'enterprise', description: 'Strict controls, audit logging' },
        { label: 'Copy from Global', template: 'copy-global', description: 'Clone your global settings' }
      ];
      const selected = await vscode.window.showQuickPick(templates, {
        placeHolder: 'Select a config template'
      });
      if (!selected) return;

      try {
        const configPath = await configManager.createConfig('project', selected.template);
        const doc = await vscode.workspace.openTextDocument(configPath);
        await vscode.window.showTextDocument(doc, { preview: false });
        vscode.window.showInformationMessage(`Created project config: ${vscode.workspace.asRelativePath(configPath)}`);
        trackEvent('config.init', { template: selected.template });
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to create config: ${err.message}`);
      }
    }),

    vscode.commands.registerCommand('codeCoach.config.openProject', async () => {
      const configPath = configManager.getProjectConfigPath();
      if (!configPath) {
        const create = await vscode.window.showWarningMessage(
          'No project config found. Create one?',
          'Create Config',
          'Cancel'
        );
        if (create === 'Create Config') {
          await vscode.commands.executeCommand('codeCoach.config.init');
        }
        return;
      }
      const doc = await vscode.workspace.openTextDocument(configPath);
      await vscode.window.showTextDocument(doc, { preview: false });
      trackEvent('config.open', { scope: 'project' });
    }),

    vscode.commands.registerCommand('codeCoach.config.openGlobal', async () => {
      const configPath = configManager.getGlobalConfigPath();
      if (!fs.existsSync(configPath)) {
        const create = await vscode.window.showWarningMessage(
          'No global config found. Create one?',
          'Create Config',
          'Cancel'
        );
        if (create === 'Create Config') {
          try {
            await configManager.createConfig('global', 'minimal');
          } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to create global config: ${err.message}`);
            return;
          }
        } else {
          return;
        }
      }
      const globalPath = configManager.getGlobalConfigPath();
      const doc = await vscode.workspace.openTextDocument(globalPath);
      await vscode.window.showTextDocument(doc, { preview: false });
      trackEvent('config.open', { scope: 'global' });
    }),

    vscode.commands.registerCommand('codeCoach.config.resetProject', async () => {
      const configPath = configManager.getProjectConfigPath();
      if (!configPath) {
        vscode.window.showWarningMessage('No project config to reset.');
        return;
      }
      const confirm = await vscode.window.showWarningMessage(
        'Reset project config to defaults? This will overwrite your current settings.',
        { modal: true },
        'Reset'
      );
      if (confirm !== 'Reset') return;

      try {
        await configManager.createConfig('project', 'minimal');
        const doc = await vscode.workspace.openTextDocument(configPath);
        await vscode.window.showTextDocument(doc, { preview: false });
        vscode.window.showInformationMessage('Project config reset to defaults.');
        trackEvent('config.reset', { scope: 'project' });
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to reset config: ${err.message}`);
      }
    }),

    vscode.commands.registerCommand('codeCoach.config.showResolved', async () => {
      const resolved = configManager.getResolvedConfig();
      const content = JSON.stringify(resolved, null, 2);
      const doc = await vscode.workspace.openTextDocument({
        language: 'json',
        content: `// Resolved Code Coach Configuration\n// This shows the merged result of: VS Code Settings → Project Config → Global Config → Defaults\n\n${content}`
      });
      await vscode.window.showTextDocument(doc, { preview: true });
      trackEvent('config.showResolved');
    }),

    vscode.commands.registerCommand('codeCoach.config.validate', async () => {
      const projectErrors = await configManager.validateProjectConfig();
      const globalErrors = await configManager.validateGlobalConfig();
      const allErrors = [
        ...projectErrors.map(e => `[Project] ${e.key}: ${e.message}`),
        ...globalErrors.map(e => `[Global] ${e.key}: ${e.message}`)
      ];
      if (allErrors.length === 0) {
        vscode.window.showInformationMessage('✓ All config files are valid!');
      } else {
        const errorList = allErrors.map(e => `• ${e}`).join('\n');
        outputChannel?.appendLine('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        outputChannel?.appendLine('⚠️ Config Validation Errors:');
        outputChannel?.appendLine(errorList);
        outputChannel?.appendLine('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        outputChannel?.show(true);
        vscode.window.showWarningMessage(`Found ${allErrors.length} config error(s). See Output for details.`);
      }
      trackEvent('config.validate', { errorCount: allErrors.length });
    })
  );

  // Template commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codeCoach.templates.select', async () => {
      const result = await templateManager.pickTemplate(context);
      if (result) {
        vscode.window.showInformationMessage(`Selected template: ${result.template.name}`);
        trackEvent('templates.select', { templateId: result.template.id });
      }
    }),

    vscode.commands.registerCommand('codeCoach.templates.create', async () => {
      const template = await templateManager.createTemplateWizard();
      if (template) {
        trackEvent('templates.create', { templateId: template.id });
      }
    }),

    vscode.commands.registerCommand('codeCoach.templates.setDefault', async () => {
      const templates = templateManager.getAllTemplates();
      const items = templates.map(t => ({
        label: `${t.icon} ${t.name}`,
        description: t.isBuiltIn ? 'Built-in' : 'Custom',
        templateId: t.id
      }));

      const picked = await vscode.window.showQuickPick(items, {
        title: 'Set Default Template',
        placeHolder: 'Select the template to use by default'
      });

      if (picked) {
        const configPath = configManager.getProjectConfigPath();
        if (configPath && fs.existsSync(configPath)) {
          try {
            const content = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(content);
            config.templates = config.templates || {};
            config.templates.default = picked.templateId;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
            vscode.window.showInformationMessage(`Default template set to: ${picked.label}`);
            trackEvent('templates.setDefault', { templateId: picked.templateId });
          } catch (err) {
            vscode.window.showErrorMessage('Failed to update config file');
          }
        } else {
          vscode.window.showWarningMessage('No project config. Run "Code Coach: Init Config" first.');
        }
      }
    }),

    vscode.commands.registerCommand('codeCoach.templates.browse', async () => {
      const templates = templateManager.getAllTemplates();
      outputChannel?.appendLine('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      outputChannel?.appendLine('📝 Available Explanation Templates');
      outputChannel?.appendLine('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      outputChannel?.appendLine('');

      for (const t of templates) {
        outputChannel?.appendLine(`${t.icon} ${t.name} (${t.id})`);
        outputChannel?.appendLine(`   ${t.description}`);
        outputChannel?.appendLine(`   Type: ${t.isBuiltIn ? 'Built-in' : 'Custom'}`);
        outputChannel?.appendLine(`   Audience: ${t.audience}`);
        outputChannel?.appendLine('');
      }

      outputChannel?.appendLine('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      outputChannel?.appendLine('Run "Code Coach: Create Custom Template" to add your own.');
      outputChannel?.appendLine('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      outputChannel?.show(true);
      trackEvent('templates.browse');
    })
  );

  // Team Pins commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codeCoach.teamPins.add', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      // Find the symbol at cursor
      const symbols = await getDocumentSymbols(editor.document);
      if (!symbols || symbols.length === 0) {
        vscode.window.showWarningMessage('No symbols found in this document');
        return;
      }

      const position = editor.selection.active;
      const symbol = findEnclosingSymbol(symbols, position);
      if (!symbol) {
        vscode.window.showWarningMessage('No symbol found at cursor position');
        return;
      }

      // Check if already pinned
      const filePath = editor.document.uri.fsPath;
      const line = symbol.selectionRange.start.line + 1;
      if (teamPinManager.isPinned(filePath, line)) {
        vscode.window.showInformationMessage('This symbol is already pinned for the team');
        return;
      }

      // Ask for annotation
      const annotation = await vscode.window.showInputBox({
        prompt: 'Why is this symbol important?',
        placeHolder: 'e.g., Core auth logic - check before modifying',
        validateInput: (value) => {
          if (!value || value.trim().length < 3) {
            return 'Please provide a brief description';
          }
          return undefined;
        }
      });

      if (!annotation) {
        return; // Cancelled
      }

      // Ask for tags (optional)
      const tagItems = SUGGESTED_TAGS.map(tag => ({
        label: tag.label,
        description: tag.description,
        picked: false
      }));

      const selectedTags = await vscode.window.showQuickPick(tagItems, {
        canPickMany: true,
        placeHolder: 'Select tags (optional)',
        title: 'Categorize this pin'
      });

      const tags = selectedTags?.map(t => t.label) ?? [];

      // Get author
      const author = await teamPinManager.getDefaultAuthor();

      // Create the pin
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      const relativePath = workspaceFolder
        ? path.relative(workspaceFolder.uri.fsPath, filePath)
        : filePath;

      try {
        const pin = await teamPinManager.addPin({
          symbol: symbol.name,
          filePath: relativePath,
          line,
          character: symbol.selectionRange.start.character,
          kind: symbolKindToString(symbol.kind),
          annotation: annotation.trim(),
          author,
          tags: tags.length > 0 ? tags : undefined
        });

        vscode.window.showInformationMessage(
          `Pinned "${symbol.name}" for the team. Commit .code-coach/pins.json to share.`
        );
        trackEvent('teamPins.add', { kind: pin.kind, tagsCount: tags.length });
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to create team pin: ${err}`);
      }
    }),

    vscode.commands.registerCommand('codeCoach.teamPins.remove', async (pinId?: string) => {
      if (!pinId) {
        // Show picker if no ID provided
        const pins = teamPinManager.getAllPins();
        if (pins.length === 0) {
          vscode.window.showInformationMessage('No team pins to remove');
          return;
        }

        const items = pins.map(pin => ({
          label: `★ ${pin.symbol}`,
          description: `${pin.filePath}:${pin.line}`,
          detail: pin.annotation,
          pinId: pin.id
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a team pin to remove',
          title: 'Remove Team Pin'
        });

        if (!selected) return;
        pinId = selected.pinId;
      }

      const removed = await teamPinManager.removePin(pinId);
      if (removed) {
        vscode.window.showInformationMessage('Team pin removed');
        trackEvent('teamPins.remove');
      } else {
        vscode.window.showWarningMessage('Team pin not found');
      }
    }),

    vscode.commands.registerCommand('codeCoach.teamPins.open', async (pinId: string) => {
      const pin = teamPinManager.getPin(pinId);
      if (!pin) {
        vscode.window.showWarningMessage('Team pin not found');
        return;
      }

      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;

      const absolutePath = path.join(workspaceFolder.uri.fsPath, pin.filePath);
      const uri = vscode.Uri.file(absolutePath);
      const range = new vscode.Range(
        Math.max(0, pin.line - 1),
        pin.character,
        Math.max(0, pin.line - 1),
        pin.character
      );

      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
      editor.selection = new vscode.Selection(range.start, range.start);
      trackEvent('teamPins.open');
    }),

    vscode.commands.registerCommand('codeCoach.teamPins.browse', async () => {
      const pins = teamPinManager.getAllPins();

      outputChannel?.appendLine('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      outputChannel?.appendLine('★ Team Pinned Symbols');
      outputChannel?.appendLine('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      outputChannel?.appendLine('');

      if (pins.length === 0) {
        outputChannel?.appendLine('No team pins yet.');
        outputChannel?.appendLine('');
        outputChannel?.appendLine('To pin a symbol for your team:');
        outputChannel?.appendLine('1. Place cursor on a symbol');
        outputChannel?.appendLine('2. Run "Code Coach: Pin Symbol for Team"');
        outputChannel?.appendLine('3. Commit .code-coach/pins.json to share');
      } else {
        for (const pin of pins) {
          outputChannel?.appendLine(`★ ${pin.symbol} (${pin.kind})`);
          outputChannel?.appendLine(`   "${pin.annotation}"`);
          outputChannel?.appendLine(`   📍 ${pin.filePath}:${pin.line}`);
          if (pin.tags && pin.tags.length > 0) {
            outputChannel?.appendLine(`   🏷️  ${pin.tags.join(', ')}`);
          }
          outputChannel?.appendLine(`   👤 @${pin.author} • ${new Date(pin.createdAt).toLocaleDateString()}`);
          outputChannel?.appendLine('');
        }
      }

      outputChannel?.appendLine('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      outputChannel?.show(true);
      trackEvent('teamPins.browse');
    }),

    vscode.commands.registerCommand('codeCoach.teamPins.editAnnotation', async (pinId?: string) => {
      if (!pinId) {
        const pins = teamPinManager.getAllPins();
        if (pins.length === 0) {
          vscode.window.showInformationMessage('No team pins to edit');
          return;
        }

        const items = pins.map(pin => ({
          label: `★ ${pin.symbol}`,
          description: pin.annotation,
          pinId: pin.id
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a team pin to edit',
          title: 'Edit Team Pin Annotation'
        });

        if (!selected) return;
        pinId = selected.pinId;
      }

      const pin = teamPinManager.getPin(pinId);
      if (!pin) {
        vscode.window.showWarningMessage('Team pin not found');
        return;
      }

      const newAnnotation = await vscode.window.showInputBox({
        prompt: 'Update annotation',
        value: pin.annotation,
        validateInput: (value) => {
          if (!value || value.trim().length < 3) {
            return 'Please provide a brief description';
          }
          return undefined;
        }
      });

      if (newAnnotation && newAnnotation !== pin.annotation) {
        await teamPinManager.updatePin(pinId, { annotation: newAnnotation.trim() });
        vscode.window.showInformationMessage('Team pin updated');
        trackEvent('teamPins.editAnnotation');
      }
    })
  );

  // Explain Diff commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codeCoach.explainDiff', async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showWarningMessage('No workspace folder open');
        return;
      }

      const repoRoot = await getRepoRoot(workspaceFolder);
      if (!repoRoot) {
        vscode.window.showWarningMessage('Not a git repository');
        return;
      }

      // Get unstaged changes
      const diffText = await getWorkingTreeDiff(repoRoot, false);
      if (!diffText.trim()) {
        vscode.window.showInformationMessage('No uncommitted changes to explain');
        return;
      }

      const source: DiffSource = { type: 'working', staged: false };
      const diff = parseDiff(diffText);
      const explanation = generateStaticDiffExplanation(diff, source, DEFAULT_EXPLAIN_DIFF_CONFIG);
      const markdown = formatDiffExplanationMarkdown(explanation);

      outputChannel?.appendLine('');
      outputChannel?.appendLine(markdown);
      outputChannel?.show(true);
      trackEvent('explainDiff', { source: 'working', filesChanged: diff.stats.filesChanged });
    }),

    vscode.commands.registerCommand('codeCoach.explainDiffStaged', async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showWarningMessage('No workspace folder open');
        return;
      }

      const repoRoot = await getRepoRoot(workspaceFolder);
      if (!repoRoot) {
        vscode.window.showWarningMessage('Not a git repository');
        return;
      }

      // Get staged changes
      const diffText = await getWorkingTreeDiff(repoRoot, true);
      if (!diffText.trim()) {
        vscode.window.showInformationMessage('No staged changes to explain');
        return;
      }

      const source: DiffSource = { type: 'working', staged: true };
      const diff = parseDiff(diffText);
      const explanation = generateStaticDiffExplanation(diff, source, DEFAULT_EXPLAIN_DIFF_CONFIG);
      const markdown = formatDiffExplanationMarkdown(explanation);

      outputChannel?.appendLine('');
      outputChannel?.appendLine(markdown);
      outputChannel?.show(true);
      trackEvent('explainDiff', { source: 'staged', filesChanged: diff.stats.filesChanged });
    }),

    vscode.commands.registerCommand('codeCoach.explainCommit', async (commitHash?: string) => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showWarningMessage('No workspace folder open');
        return;
      }

      const repoRoot = await getRepoRoot(workspaceFolder);
      if (!repoRoot) {
        vscode.window.showWarningMessage('Not a git repository');
        return;
      }

      // If no commit hash provided, ask user to input one
      if (!commitHash) {
        commitHash = await vscode.window.showInputBox({
          prompt: 'Enter commit hash to explain',
          placeHolder: 'e.g., HEAD, abc1234, main~1'
        });
      }

      if (!commitHash) {
        return; // Cancelled
      }

      const diffText = await getCommitDiff(repoRoot, commitHash);
      if (!diffText.trim()) {
        vscode.window.showWarningMessage(`No changes found for commit: ${commitHash}`);
        return;
      }

      const source: DiffSource = { type: 'commit', hash: commitHash };
      const diff = parseDiff(diffText);
      const explanation = generateStaticDiffExplanation(diff, source, DEFAULT_EXPLAIN_DIFF_CONFIG);
      const markdown = formatDiffExplanationMarkdown(explanation);

      outputChannel?.appendLine('');
      outputChannel?.appendLine(markdown);
      outputChannel?.show(true);
      trackEvent('explainDiff', { source: 'commit', filesChanged: diff.stats.filesChanged });
    })
  );

  // Onboarding Tours commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codeCoach.tours.browse', async () => {
      const tours = tourManager.getAllTours();

      outputChannel?.appendLine('');
      outputChannel?.appendLine('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      outputChannel?.appendLine('Onboarding Tours');
      outputChannel?.appendLine('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      outputChannel?.appendLine('');

      if (tours.length === 0) {
        outputChannel?.appendLine('No tours available.');
        outputChannel?.appendLine('');
        outputChannel?.appendLine('To create a tour:');
        outputChannel?.appendLine('1. Run "Code Coach: Create Tour"');
        outputChannel?.appendLine('2. Add stops with "Code Coach: Add Tour Stop"');
        outputChannel?.appendLine('3. Commit .code-coach/tours/ to share with your team');
      } else {
        for (const item of tours) {
          const progressText = item.progress
            ? item.progress.completed
              ? 'Completed'
              : `${item.progress.completedStops.length}/${item.tour.stops.length} stops`
            : 'Not started';

          outputChannel?.appendLine(`[${item.tour.title}]`);
          outputChannel?.appendLine(`   ${item.tour.description}`);
          if (item.tour.estimatedMinutes) {
            outputChannel?.appendLine(`   Time: ~${item.tour.estimatedMinutes} min`);
          }
          outputChannel?.appendLine(`   Stops: ${item.tour.stops.length}`);
          outputChannel?.appendLine(`   Progress: ${progressText}`);
          outputChannel?.appendLine(`   Author: @${item.tour.author}`);
          outputChannel?.appendLine('');
        }
      }

      outputChannel?.appendLine('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      outputChannel?.show(true);
      trackEvent('tours.browse');
    }),

    vscode.commands.registerCommand('codeCoach.tours.start', async (tourId?: string) => {
      if (!tourId) {
        const tours = tourManager.getAllTours();
        if (tours.length === 0) {
          vscode.window.showInformationMessage('No tours available. Create one first.');
          return;
        }

        const items = tours.map(item => ({
          label: item.tour.title,
          description: item.progress?.completed ? 'Completed' : item.progress ? 'In Progress' : '',
          detail: `${item.tour.stops.length} stops • ${item.tour.description}`,
          tourId: item.tour.id
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a tour to start',
          title: 'Start Tour'
        });

        if (!selected) return;
        tourId = selected.tourId;
      }

      const tour = tourManager.getTour(tourId);
      if (!tour) {
        vscode.window.showWarningMessage('Tour not found');
        return;
      }

      if (tour.stops.length === 0) {
        vscode.window.showWarningMessage('This tour has no stops');
        return;
      }

      // Check for existing progress
      const progress = tourManager.getProgress(tourId);
      let startIndex = 0;

      if (progress && !progress.completed && progress.currentStopIndex > 0) {
        const result = await vscode.window.showInformationMessage(
          `Resume "${tour.title}" from stop ${progress.currentStopIndex + 1}?`,
          'Resume',
          'Start Over'
        );

        if (result === 'Resume') {
          startIndex = progress.currentStopIndex;
        } else if (result === 'Start Over') {
          await tourManager.resetProgress(tourId);
        } else {
          return; // Cancelled
        }
      }

      await tourRunner.start(tour, startIndex);
      trackEvent('tours.start', { tourId: tour.id, stopsCount: tour.stops.length });
    }),

    vscode.commands.registerCommand('codeCoach.tours.stop', () => {
      if (tourRunner.isRunning()) {
        tourRunner.stop();
        vscode.window.showInformationMessage('Tour stopped');
        trackEvent('tours.stop');
      }
    }),

    vscode.commands.registerCommand('codeCoach.tours.next', async () => {
      if (tourRunner.isRunning()) {
        await tourRunner.next();
      }
    }),

    vscode.commands.registerCommand('codeCoach.tours.previous', async () => {
      if (tourRunner.isRunning()) {
        await tourRunner.previous();
      }
    }),

    vscode.commands.registerCommand('codeCoach.tours.showCurrentStop', async () => {
      if (tourRunner.isRunning()) {
        await tourRunner.goToCurrentStop();
      }
    }),

    vscode.commands.registerCommand('codeCoach.tours.create', async () => {
      const tour = await tourManager.createTourWizard();
      if (tour) {
        trackEvent('tours.create', { tourId: tour.id });
      }
    }),

    vscode.commands.registerCommand('codeCoach.tours.addStop', async (tourId?: string) => {
      if (!tourId) {
        const tours = tourManager.getAllTours();
        if (tours.length === 0) {
          vscode.window.showInformationMessage('Create a tour first');
          return;
        }

        const items = tours.map(item => ({
          label: item.tour.title,
          description: `${item.tour.stops.length} stops`,
          tourId: item.tour.id
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a tour to add a stop to',
          title: 'Add Tour Stop'
        });

        if (!selected) return;
        tourId = selected.tourId;
      }

      const stop = await tourManager.addStopWizard(tourId);
      if (stop) {
        trackEvent('tours.addStop', { tourId });
      }
    }),

    vscode.commands.registerCommand('codeCoach.tours.delete', async (tourId?: string) => {
      if (!tourId) {
        const tours = tourManager.getAllTours();
        if (tours.length === 0) {
          vscode.window.showInformationMessage('No tours to delete');
          return;
        }

        const items = tours.map(item => ({
          label: item.tour.title,
          description: `${item.tour.stops.length} stops`,
          tourId: item.tour.id
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a tour to delete',
          title: 'Delete Tour'
        });

        if (!selected) return;
        tourId = selected.tourId;
      }

      const tour = tourManager.getTour(tourId);
      if (!tour) return;

      const confirm = await vscode.window.showWarningMessage(
        `Delete tour "${tour.title}"? This cannot be undone.`,
        { modal: true },
        'Delete'
      );

      if (confirm === 'Delete') {
        await tourManager.deleteTour(tourId);
        vscode.window.showInformationMessage(`Tour "${tour.title}" deleted`);
        trackEvent('tours.delete', { tourId });
      }
    })
  );

  // Code Change Subscriptions commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codeCoach.subscriptions.addFile', async () => {
      await subscriptionManager.subscribeToCurrentFile();
      trackEvent('subscriptions.addFile');
    }),

    vscode.commands.registerCommand('codeCoach.subscriptions.addSymbol', async () => {
      await subscriptionManager.subscribeToCurrentSymbol();
      trackEvent('subscriptions.addSymbol');
    }),

    vscode.commands.registerCommand('codeCoach.subscriptions.manage', async () => {
      await subscriptionManager.showManagementUI();
      trackEvent('subscriptions.manage');
    }),

    vscode.commands.registerCommand('codeCoach.subscriptions.checkChanges', async () => {
      const summary = await subscriptionManager.checkForChanges();
      if (summary.totalChanges === 0) {
        vscode.window.showInformationMessage('No changes detected in subscribed files.');
      }
      trackEvent('subscriptions.checkChanges', { changesFound: summary.totalChanges });
    }),

    vscode.commands.registerCommand('codeCoach.subscriptions.browse', async () => {
      const subscriptions = subscriptionManager.getAllSubscriptions();

      outputChannel?.appendLine('');
      outputChannel?.appendLine('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      outputChannel?.appendLine('Code Change Subscriptions');
      outputChannel?.appendLine('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      outputChannel?.appendLine('');

      if (subscriptions.length === 0) {
        outputChannel?.appendLine('No subscriptions yet.');
        outputChannel?.appendLine('');
        outputChannel?.appendLine('Subscribe to files or symbols to get notified when they change:');
        outputChannel?.appendLine('  • Right-click a file → "Subscribe to Changes"');
        outputChannel?.appendLine('  • Run "Code Coach: Subscribe to File/Symbol"');
      } else {
        for (const sub of subscriptions) {
          const statusIcon = sub.active ? '●' : '○';
          const label = sub.type === 'file' ? sub.pattern :
                        sub.type === 'symbol' ? `${sub.symbol} (${sub.filePath})` :
                        `${sub.path}${sub.recursive ? '/**' : '/*'}`;

          outputChannel?.appendLine(`${statusIcon} [${sub.type.toUpperCase()}] ${label}`);
          if (sub.reason) {
            outputChannel?.appendLine(`   Reason: ${sub.reason}`);
          }
          outputChannel?.appendLine(`   Notify: ${sub.notify} • Created: ${new Date(sub.createdAt).toLocaleDateString()}`);
          outputChannel?.appendLine('');
        }
      }

      outputChannel?.appendLine('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      outputChannel?.show(true);
      trackEvent('subscriptions.browse');
    })
  );

  // Explanation Cache commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codeCoach.cache.manage', async () => {
      await explanationCache.showManagementUI();
      trackEvent('cache.manage');
    }),

    vscode.commands.registerCommand('codeCoach.cache.clear', async () => {
      const stats = explanationCache.getStats();
      const confirm = await vscode.window.showWarningMessage(
        `Clear all ${stats.entryCount} cached explanations?`,
        { modal: true },
        'Clear'
      );
      if (confirm === 'Clear') {
        await explanationCache.clearCache();
        vscode.window.showInformationMessage('Explanation cache cleared');
        trackEvent('cache.clear');
      }
    }),

    vscode.commands.registerCommand('codeCoach.cache.stats', async () => {
      if (outputChannel) {
        explanationCache.showStats(outputChannel);
        outputChannel.show(true);
      }
      trackEvent('cache.stats');
    })
  );

  const hoverProvider: vscode.HoverProvider = {
    provideHover(document, position) {
      const diagnostics = vscode.languages.getDiagnostics(document.uri);
      const diag = diagnostics.find(d => d.range.contains(position));
      if (!diag) {
        return null;
      }

      const locationLabel = `${vscode.workspace.asRelativePath(document.uri.fsPath)}:${diag.range.start.line + 1}`;
      const explanation = explainDiagnostic(diag, document.languageId, locationLabel);
      const md = new vscode.MarkdownString(explanation);
      md.isTrusted = false;
      trackEvent('diagnostic.hover.shown', {
        languageId: document.languageId,
        code: typeof diag.code === 'number' ? diag.code : undefined
      });
      return new vscode.Hover(md, diag.range);
    }
  };

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      [
        { language: 'javascript' },
        { language: 'typescript' },
        { language: 'javascriptreact' },
        { language: 'typescriptreact' },
        { language: 'python' },
        { language: 'java' },
        { language: 'go' },
        { language: 'rust' }
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
      if (event.affectsConfiguration('codeCoach.deepDive.sections')) {
        applyDeepDiveSectionFilter();
      }
    })
  );

    console.log('[Code Coach] Activation complete - all commands registered');
  } catch (error) {
    console.error('[Code Coach] ACTIVATION FAILED:', error);
    trackEvent('error.occurred', { errorType: 'activation', message: String(error) });
    vscode.window.showErrorMessage(`Code Coach failed to activate: ${error}`);
    throw error; // Re-throw to mark activation as failed
  }
}

/**
 * Auto-prompt for config initialization on first use.
 * Triggers 3s after activation in workspaces without a config file.
 * Users can dismiss permanently via "Don't Ask Again".
 */
async function maybePromptConfigInit(context: vscode.ExtensionContext, configManager: ConfigManager): Promise<void> {
  // Check if we're in a workspace
  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
    return;
  }

  // Check if user has dismissed this prompt permanently
  const dismissed = context.globalState.get<boolean>(CONFIG_PROMPT_DISMISSED_KEY, false);
  if (dismissed) {
    return;
  }

  // Check if project config already exists
  const configPath = configManager.getProjectConfigPath();
  if (configPath && fs.existsSync(configPath)) {
    return;
  }

  // Delay the prompt to avoid interrupting startup
  setTimeout(async () => {
    const choice = await vscode.window.showInformationMessage(
      'Create a project configuration file to share Code Coach settings with your team?',
      'Create Config',
      'Not Now',
      "Don't Ask Again"
    );

    if (choice === 'Create Config') {
      await vscode.commands.executeCommand('codeCoach.config.init');
      trackEvent('config.auto_prompt', { action: 'create' });
    } else if (choice === "Don't Ask Again") {
      await context.globalState.update(CONFIG_PROMPT_DISMISSED_KEY, true);
      trackEvent('config.auto_prompt', { action: 'dismiss_permanently' });
    } else {
      trackEvent('config.auto_prompt', { action: 'dismiss_once' });
    }
  }, 3000);
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
    { label: 'Gemini', description: current === 'gemini' ? 'current' : '', provider: 'gemini' },
    { label: 'Ollama (local)', description: current === 'ollama' ? 'current' : '', provider: 'ollama' },
    { label: 'LM Studio (local)', description: current === 'lmstudio' ? 'current' : '', provider: 'lmstudio' }
  ];

  const allowed = getAllowedProviders();
  const filtered = allowed ? options.filter(option => allowed.has(option.provider)) : options;
  if (filtered.length === 0) {
    vscode.window.showWarningMessage('All AI providers are disabled by policy.');
    return undefined;
  }

  const picked = await vscode.window.showQuickPick(filtered, {
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

function getAllowedProviders(): Set<AiProvider> | undefined {
  const config = vscode.workspace.getConfiguration('codeCoach');
  const raw = config.get<string[]>('enterprise.allowedAiProviders');
  if (!raw || raw.length === 0) return undefined;
  const allowed = new Set<AiProvider>();
  for (const entry of raw) {
    const normalized = entry.trim().toLowerCase();
    if (
      normalized === 'openrouter' ||
      normalized === 'openai' ||
      normalized === 'anthropic' ||
      normalized === 'gemini' ||
      normalized === 'ollama' ||
      normalized === 'lmstudio'
    ) {
      allowed.add(normalized as AiProvider);
    }
  }
  return allowed.size > 0 ? allowed : undefined;
}

function getDeepDiveSections(): Array<{ id: DeepDiveSection; label: string }> {
  return [
    { id: 'overview', label: 'Overview' },
    { id: 'usages', label: 'Usages' },
    { id: 'blame', label: 'Blame' },
    { id: 'history', label: 'History' },
    { id: 'summary', label: 'Summary' },
    { id: 'tests', label: 'Tests' },
    { id: 'coverage', label: 'Coverage' }
  ];
}

function isSectionEnabled(section: DeepDiveSection): boolean {
  const config = vscode.workspace.getConfiguration('codeCoach');
  const raw = config.get<string[]>('deepDive.sections');
  if (!raw || raw.length === 0) return true;
  return raw.map(value => value.trim().toLowerCase()).includes(section);
}

function applyDeepDiveSectionFilter(): void {
  const config = vscode.workspace.getConfiguration('codeCoach');
  const raw = config.get<string[]>('deepDive.sections');
  if (!raw || raw.length === 0) {
    deepDiveProvider?.setSectionFilter(undefined);
    return;
  }
  const allowed = new Set<DeepDiveSection>();
  for (const entry of raw) {
    const normalized = entry.trim().toLowerCase();
    if (
      normalized === 'overview' ||
      normalized === 'usages' ||
      normalized === 'blame' ||
      normalized === 'history' ||
      normalized === 'summary' ||
      normalized === 'tests' ||
      normalized === 'coverage'
    ) {
      allowed.add(normalized as DeepDiveSection);
    }
  }
  deepDiveProvider?.setSectionFilter(allowed.size > 0 ? allowed : undefined);
}

function buildPinFromDeepDive(data: DeepDiveData): DeepDivePin {
  const line = data.overview.range.start.line + 1;
  const character = data.overview.range.start.character;
  const id = `${data.overview.filePath}:${line}:${data.overview.name}`;
  return {
    id,
    name: data.overview.name,
    kind: data.overview.kind,
    filePath: data.overview.filePath,
    line,
    character,
    pinnedAt: new Date().toISOString()
  };
}

function loadDeepDivePins(context: vscode.ExtensionContext): DeepDivePin[] {
  const raw = context.workspaceState.get<any[]>(DEEP_DIVE_PIN_KEY, []);
  if (!Array.isArray(raw)) return [];
  const pins: DeepDivePin[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    if (
      typeof entry.id !== 'string' ||
      typeof entry.name !== 'string' ||
      typeof entry.filePath !== 'string' ||
      typeof entry.line !== 'number' ||
      typeof entry.character !== 'number' ||
      typeof entry.kind !== 'number'
    ) {
      continue;
    }
    pins.push({
      id: entry.id,
      name: entry.name,
      kind: entry.kind,
      filePath: entry.filePath,
      line: entry.line,
      character: entry.character,
      pinnedAt: typeof entry.pinnedAt === 'string' ? entry.pinnedAt : new Date().toISOString()
    });
  }
  return pins;
}

async function persistDeepDivePins(context: vscode.ExtensionContext): Promise<void> {
  await context.workspaceState.update(DEEP_DIVE_PIN_KEY, deepDivePins);
}

async function pickDeepDivePinId(pins: DeepDivePin[], title: string): Promise<string | undefined> {
  const items = pins.map(pin => ({
    label: `${pin.name} (${symbolKindLabel(pin.kind)})`,
    description: `${vscode.workspace.asRelativePath(pin.filePath)}:${pin.line}`,
    id: pin.id
  }));
  const picked = await vscode.window.showQuickPick(items, { title });
  return picked?.id;
}

async function maybeAttachDeepDiveSummary(
  context: vscode.ExtensionContext,
  document: vscode.TextDocument,
  data: DeepDiveData
): Promise<void> {
  const config = vscode.workspace.getConfiguration('codeCoach');
  const summaryEnabled = config.get<boolean>('deepDive.aiSummary', true);
  const aiEnabled = config.get<boolean>('ai.enabled', false);
  const selectionText = document.getText(data.overview.range);

  if (!summaryEnabled) {
    data.summary = undefined;
    return;
  }

  if (!aiEnabled) {
    data.summary = { text: buildStaticDeepDiveSummary(data), source: 'static' };
    return;
  }

  try {
    const summaryContext = buildDeepDiveContext(data, document);
    const ai = await aiExplain(context, {
      kind: 'deepDive',
      languageId: document.languageId,
      code: selectionText,
      filePath: document.uri.fsPath,
      startLineNumber: data.overview.range.start.line + 1,
      endLineNumber: data.overview.range.end.line + 1,
      context: summaryContext
    });

    const verification = verifyAiResult(ai, {
      lineRange: { start: data.overview.range.start.line + 1, end: data.overview.range.end.line + 1 },
      requireCitations: true
    });

    let text = ai.explanationMarkdown.trim();
    if (!verification.verified) {
      text += `\n\n---\nVerification notes:\n${verification.notes.map(n => `- ${n}`).join('\n')}`;
    }
    data.summary = { text, source: 'ai' };
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err);
    data.summary = { text: `AI summary unavailable: ${message}`, source: 'static' };
  }
}

function buildDeepDiveContext(data: DeepDiveData, document: vscode.TextDocument): string[] {
  const relPath = vscode.workspace.asRelativePath(document.uri.fsPath);
  const percent =
    data.coverage && data.coverage.totalLines > 0
      ? Math.round((data.coverage.hitLines / data.coverage.totalLines) * 100)
      : undefined;

  const context: string[] = [
    `Symbol: ${data.overview.name} (${symbolKindLabel(data.overview.kind)})`,
    `Location: ${relPath}:${data.overview.range.start.line + 1}`,
    `Usages: ${data.usages.length}`,
    `Tests: ${data.tests.length}`,
    `Coverage: ${data.coverage ? `${percent ?? 0}%` : 'unknown'}`
  ];

  if (data.history.length > 0) {
    context.push(`History: ${data.history.length} recent commits`);
    for (const entry of data.history.slice(0, 3)) {
      context.push(`- ${entry.hash}: ${entry.summary}`);
    }
  }

  return context;
}

function buildStaticDeepDiveSummary(data: DeepDiveData): string {
  const relPath = vscode.workspace.asRelativePath(data.overview.filePath);
  const percent =
    data.coverage && data.coverage.totalLines > 0
      ? Math.round((data.coverage.hitLines / data.coverage.totalLines) * 100)
      : 0;
  return [
    `Symbol ${data.overview.name} (${symbolKindLabel(data.overview.kind)}) is defined at ${relPath}:${data.overview.range.start.line + 1}.`,
    `Usages: ${data.usages.length}. Tests: ${data.tests.length}. Coverage: ${data.coverage ? `${percent}%` : 'unknown'}.`
  ].join(' ');
}

function buildWhyWorksFallback(
  document: vscode.TextDocument,
  text: string,
  startLineNumber: number,
  filePath: string
): string {
  const out: string[] = [];
  out.push('Code Coach — Why This Works');
  out.push('');
  out.push('Assumptions (static inference):');
  out.push('- Inputs are valid and match expected types/shapes.');
  out.push('- Dependencies return the expected data formats.');
  out.push('');
  out.push('Edge cases handled:');
  out.push('- Not detectable without runtime or tests.');
  out.push('');
  out.push('Edge cases not handled:');
  out.push('- Null/undefined inputs or unexpected data shapes may break this code.');
  out.push('');
  out.push('What could break this:');
  out.push('- Changes in upstream APIs or data contracts.');
  out.push('- Silent failures in async calls or missing error handling.');
  out.push('');
  out.push('Static walkthrough:');
  out.push(explainSelection({ text, languageId: document.languageId, startLineNumber, filePath }));
  return out.join('\n');
}

function buildDiagnosticSnippet(document: vscode.TextDocument, range: vscode.Range): string {
  const startLine = Math.max(0, range.start.line - 2);
  const endLine = Math.min(document.lineCount - 1, range.end.line + 2);
  const endText = document.lineAt(endLine).text;
  const snippetRange = new vscode.Range(startLine, 0, endLine, endText.length);
  return document.getText(snippetRange).trim() || document.lineAt(range.start.line).text;
}

async function maybeShowOnboarding(context: vscode.ExtensionContext): Promise<void> {
  const shown = context.globalState.get<boolean>(ONBOARDING_SHOWN_KEY, false);
  if (shown) return;
  await runOnboarding(context, false);
  await context.globalState.update(ONBOARDING_SHOWN_KEY, true);
}

async function runOnboarding(context: vscode.ExtensionContext, force: boolean): Promise<void> {
  const config = vscode.workspace.getConfiguration('codeCoach');
  const currentMode = config.get<string>('privacy.mode', 'offline') ?? 'offline';

  const panel = vscode.window.createWebviewPanel(
    'codeCoachOnboarding',
    'Code Coach — Getting Started',
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  panel.webview.html = buildOnboardingHtml(currentMode);
  trackEvent('onboarding_opened', { mode: currentMode });

  panel.webview.onDidReceiveMessage(async message => {
    if (!message || typeof message.type !== 'string') return;
    switch (message.type) {
      case 'save': {
        const mode = typeof message.mode === 'string' ? message.mode : currentMode;
        await config.update('privacy.mode', mode, vscode.ConfigurationTarget.Global);
        trackEvent('onboarding_completed', { mode });
        panel.dispose();
        break;
      }
      case 'openCommands':
        await vscode.commands.executeCommand('workbench.action.showCommands');
        break;
      case 'runExplain':
        await vscode.commands.executeCommand('codeCoach.explainSelection');
        break;
      case 'runDeepDive':
        await vscode.commands.executeCommand('codeCoach.deepDive');
        break;
      case 'openSettings':
        await vscode.commands.executeCommand('workbench.action.openSettings', 'codeCoach');
        break;
      default:
        break;
    }
  });

  if (!force) {
    panel.onDidDispose(() => {
      // No-op; onboarding shown flag is handled by caller.
    });
  }
}

function buildOnboardingHtml(currentMode: string): string {
  const modes = [
    { id: 'offline', label: 'Offline', desc: 'No network calls (static only)' },
    { id: 'local', label: 'Local', desc: 'Local LLM only (Ollama / LM Studio)' },
    { id: 'redacted', label: 'Redacted', desc: 'Sanitized context to cloud LLMs' },
    { id: 'full', label: 'Full', desc: 'Full context to cloud LLMs' }
  ];

  const modeOptions = modes
    .map(
      mode => `
      <label class="option">
        <input type="radio" name="privacy" value="${mode.id}" ${mode.id === currentMode ? 'checked' : ''}/>
        <span class="option-title">${mode.label}</span>
        <span class="option-desc">${mode.desc}</span>
      </label>
    `
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Code Coach — Getting Started</title>
    <style>
      body {
        margin: 0;
        padding: 20px;
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
        background: var(--vscode-editor-background);
      }
      h1 {
        font-size: 20px;
        margin: 0 0 8px 0;
      }
      p {
        margin: 0 0 16px 0;
        color: var(--vscode-descriptionForeground);
      }
      .card {
        border: 1px solid var(--vscode-editorWidget-border);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
        background: var(--vscode-editorWidget-background);
      }
      .option {
        display: grid;
        grid-template-columns: 20px 1fr;
        column-gap: 12px;
        align-items: start;
        padding: 8px 0;
      }
      .option-title {
        font-weight: 600;
      }
      .option-desc {
        display: block;
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
      }
      .actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      button {
        border: 1px solid var(--vscode-button-border, transparent);
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
      }
      button.secondary {
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
      }
      ol {
        margin: 0;
        padding-left: 20px;
      }
    </style>
  </head>
  <body>
    <h1>Welcome to Code Coach</h1>
    <p>Your explainability layer for code you did not write.</p>

    <div class="card">
      <h2>Step 1 — Privacy Mode</h2>
      <p>Choose how Code Coach can use AI. You can change this later.</p>
      ${modeOptions}
      <div class="actions">
        <button id="save">Save & Close</button>
        <button class="secondary" id="settings">Open Settings</button>
      </div>
    </div>

    <div class="card">
      <h2>Step 2 — Try It</h2>
      <ol>
        <li>Select code and run Explain Selection.</li>
        <li>Hover a diagnostic to see the enhanced tooltip.</li>
        <li>Run Deep Dive on a symbol.</li>
      </ol>
      <div class="actions">
        <button class="secondary" id="commands">Open Command Palette</button>
        <button class="secondary" id="explain">Run Explain Selection</button>
        <button class="secondary" id="deepDive">Run Deep Dive</button>
      </div>
    </div>

    <script>
      const vscode = acquireVsCodeApi();
      document.getElementById('save').addEventListener('click', () => {
        const selected = document.querySelector('input[name="privacy"]:checked');
        vscode.postMessage({ type: 'save', mode: selected ? selected.value : '${currentMode}' });
      });
      document.getElementById('settings').addEventListener('click', () => {
        vscode.postMessage({ type: 'openSettings' });
      });
      document.getElementById('commands').addEventListener('click', () => {
        vscode.postMessage({ type: 'openCommands' });
      });
      document.getElementById('explain').addEventListener('click', () => {
        vscode.postMessage({ type: 'runExplain' });
      });
      document.getElementById('deepDive').addEventListener('click', () => {
        vscode.postMessage({ type: 'runDeepDive' });
      });
    </script>
  </body>
</html>`;
}

async function captureFeedback(helpful: boolean): Promise<void> {
  const options = [
    { label: 'Explain Selection', value: 'explain_selection' },
    { label: 'Explain Why This Works', value: 'explain_why_works' },
    { label: 'Explain Diagnostic', value: 'explain_diagnostic' },
    { label: 'Trace Diagnostic Origin', value: 'trace_origin' },
    { label: 'Trace Stack Trace', value: 'trace_stack' },
    { label: 'Code Smells', value: 'code_smells' },
    { label: 'Test Gaps', value: 'test_gaps' },
    { label: 'Deep Dive', value: 'deep_dive' }
  ];
  const picked = await vscode.window.showQuickPick(options, {
    title: helpful ? 'What was helpful?' : 'What was not helpful?'
  });
  if (!picked) return;
  trackEvent('feedback', { helpful, feature: picked.value });
  if (picked.value === 'explain_selection') {
    trackEvent('explain.selection.feedback', { helpful });
  }
  vscode.window.showInformationMessage('Thanks for the feedback.');
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

type StackFrameRef = {
  label: string;
  filePath: string;
  line: number;
  column?: number;
};

function parseStackTrace(stack: string): StackFrameRef[] {
  const frames: StackFrameRef[] = [];
  const lines = stack.replace(/\r\n/g, '\n').split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Node / V8 style: at func (path:line:col)
    let match = /at\s+(.+?)\s+\((.+):(\d+):(\d+)\)/.exec(trimmed);
    if (match) {
      const [, fn, filePath, lineNo, colNo] = match;
      const resolved = resolveCitationPath(filePath) ?? filePath;
      frames.push({
        label: `${fn} (${path.basename(filePath)}:${lineNo})`,
        filePath: resolved,
        line: Number(lineNo),
        column: Number(colNo)
      });
      continue;
    }

    // Node / V8 style without function: at path:line:col
    match = /at\s+(.+):(\d+):(\d+)/.exec(trimmed);
    if (match) {
      const [, filePath, lineNo, colNo] = match;
      const resolved = resolveCitationPath(filePath) ?? filePath;
      frames.push({
        label: `${path.basename(filePath)}:${lineNo}`,
        filePath: resolved,
        line: Number(lineNo),
        column: Number(colNo)
      });
      continue;
    }

    // Python style: File "path", line N, in func
    match = /File\s+"(.+)",\s+line\s+(\d+),\s+in\s+(.+)/.exec(trimmed);
    if (match) {
      const [, filePath, lineNo, fn] = match;
      const resolved = resolveCitationPath(filePath) ?? filePath;
      frames.push({
        label: `${fn.trim()} (${path.basename(filePath)}:${lineNo})`,
        filePath: resolved,
        line: Number(lineNo)
      });
      continue;
    }

    // Java style: at pkg.Class.method(File.java:123)
    match = /at\s+(.+)\((.+):(\d+)\)/.exec(trimmed);
    if (match) {
      const [, fn, filePath, lineNo] = match;
      const resolved = resolveCitationPath(filePath) ?? filePath;
      frames.push({
        label: `${fn} (${path.basename(filePath)}:${lineNo})`,
        filePath: resolved,
        line: Number(lineNo)
      });
      continue;
    }

    // Go/Rust: path/to/file.go:123 or path/to/file.rs:123:45
    match = /(.+\\.(?:go|rs|py|js|ts|tsx|jsx)):([0-9]+)(?::([0-9]+))?/.exec(trimmed);
    if (match) {
      const [, filePath, lineNo, colNo] = match;
      const resolved = resolveCitationPath(filePath) ?? filePath;
      frames.push({
        label: `${path.basename(filePath)}:${lineNo}`,
        filePath: resolved,
        line: Number(lineNo),
        column: colNo ? Number(colNo) : undefined
      });
    }
  }

  return frames.filter(frame => !Number.isNaN(frame.line) && frame.filePath);
}

function buildCallGraphFromFrames(frames: StackFrameRef[]): TraceCallGraph {
  const nodes: CallGraphNode[] = [];
  const edges: CallGraphEdge[] = [];

  const nodeIds: string[] = [];
  for (const frame of frames) {
    const id = makeCallGraphNodeId(frame.filePath, frame.line, frame.label);
    nodes.push({
      id,
      label: frame.label,
      uri: frame.filePath,
      line: frame.line
    });
    nodeIds.push(id);
  }

  for (let i = 0; i < nodeIds.length - 1; i += 1) {
    edges.push({ from: nodeIds[i + 1], to: nodeIds[i] });
  }

  return {
    nodes,
    edges,
    rootId: nodeIds[0] ?? 'stack',
    confidence: 'high'
  };
}
