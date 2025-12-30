import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | undefined;
let sessionId: string | undefined;

export function initTelemetry(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel('Code Coach Telemetry');
  sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  context.subscriptions.push(outputChannel);
}

export function trackEvent(name: string, properties: Record<string, unknown> = {}): void {
  const config = vscode.workspace.getConfiguration('codeCoach');
  const enabled = config.get<boolean>('telemetry.enabled', false);
  if (!enabled || !outputChannel) return;

  const payload = {
    event: name,
    session: sessionId,
    timestamp: new Date().toISOString(),
    properties: sanitize(properties)
  };

  outputChannel.appendLine(JSON.stringify(payload));
}

function sanitize(input: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value.length > 120) {
      safe[key] = value.slice(0, 120);
    } else {
      safe[key] = value;
    }
  }
  return safe;
}
