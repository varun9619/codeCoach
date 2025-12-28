import * as vscode from 'vscode';
import { explainSelection } from './explainSelection';
import { explainDiagnostic } from './explainDiagnostics';

let outputChannel: vscode.OutputChannel | undefined;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Code Coach');

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
      const explanation = explainSelection({
        text,
        languageId: editor.document.languageId,
        startLineNumber: selection.start.line + 1
      });

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

export function deactivate() {
  outputChannel?.dispose();
  outputChannel = undefined;
}
