import * as vscode from 'vscode';
import * as fs from 'fs';

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
  const auditPath = (config.get<string>('enterprise.auditLogPath', '') ?? '').trim();
  if (!enabled && !auditPath) return;

  const payload = {
    event: name,
    session: sessionId,
    timestamp: new Date().toISOString(),
    properties: sanitize(properties)
  };

  const line = JSON.stringify(payload);
  if (enabled && outputChannel) {
    outputChannel.appendLine(line);
  }
  if (auditPath) {
    try {
      fs.appendFileSync(auditPath, `${line}\n`, { encoding: 'utf8' });
    } catch {
      // Ignore audit log failures to avoid breaking the extension.
    }
  }
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
