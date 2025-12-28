import * as vscode from 'vscode';

export type RuntimeTracingHandle = {
  getLastExceptionReport: () => string | undefined;
};

type StoppedEventBody = {
  reason?: string;
  threadId?: number;
  description?: string;
  text?: string;
};

type StackFrame = {
  id: number;
  name: string;
  line: number;
  column: number;
  source?: { name?: string; path?: string };
};

type StackTraceResponse = {
  stackFrames: StackFrame[];
};

type Scope = {
  name: string;
  variablesReference: number;
};

type ScopesResponse = {
  scopes: Scope[];
};

type Variable = {
  name: string;
  value: string;
  type?: string;
};

type VariablesResponse = {
  variables: Variable[];
};

export function registerRuntimeTracing(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel
): RuntimeTracingHandle {
  let lastExceptionReport: string | undefined;

  const trackerFactory: vscode.DebugAdapterTrackerFactory = {
    createDebugAdapterTracker(session: vscode.DebugSession) {
      return {
        onDidSendMessage: (message: any) => {
          // DAP message from adapter -> editor. We're interested in the "stopped" event.
          if (!isStoppedEvent(message)) return;

          const config = vscode.workspace.getConfiguration('codeCoach');
          const enabled = config.get<boolean>('runtime.enabled', false);
          if (!enabled) return;

          const body = message.body as StoppedEventBody;
          if (body.reason !== 'exception') return;

          const threadId = body.threadId;
          if (typeof threadId !== 'number') return;

          void (async () => {
            const report = await buildExceptionReport(session, threadId);
            if (!report) return;

            lastExceptionReport = report;

            const autoExplain = config.get<boolean>('runtime.autoExplainOnException', true);
            if (autoExplain) {
              outputChannel.clear();
              outputChannel.appendLine(report);
              outputChannel.show(true);
            }
          })();
        }
      };
    }
  };

  // Register for common Node debug types. If the user uses a different adapter,
  // they can still run the manual command to explain last exception (if captured).
  const debugTypes = ['node', 'pwa-node'];
  for (const type of debugTypes) {
    context.subscriptions.push(vscode.debug.registerDebugAdapterTrackerFactory(type, trackerFactory));
  }

  return {
    getLastExceptionReport: () => lastExceptionReport
  };
}

function isStoppedEvent(message: any): message is { type: 'event'; event: 'stopped'; body: StoppedEventBody } {
  return message && message.type === 'event' && message.event === 'stopped' && typeof message.body === 'object';
}

async function buildExceptionReport(session: vscode.DebugSession, threadId: number): Promise<string | undefined> {
  const config = vscode.workspace.getConfiguration('codeCoach');
  const maxVariables = config.get<number>('runtime.maxVariables', 30);

  let stack: StackTraceResponse;
  try {
    stack = (await session.customRequest('stackTrace', { threadId, startFrame: 0, levels: 1 })) as StackTraceResponse;
  } catch {
    return undefined;
  }

  const frame = stack.stackFrames?.[0];
  if (!frame) return undefined;

  let scopes: ScopesResponse;
  try {
    scopes = (await session.customRequest('scopes', { frameId: frame.id })) as ScopesResponse;
  } catch {
    return formatReport(frame, undefined, ['Could not read variables for this exception.']);
  }

  const localsScope = scopes.scopes?.find(s => s.name.toLowerCase().includes('local')) ?? scopes.scopes?.[0];
  if (!localsScope || !localsScope.variablesReference) {
    return formatReport(frame, undefined, ['No variable scope was available at the stop location.']);
  }

  let vars: VariablesResponse;
  try {
    vars = (await session.customRequest('variables', { variablesReference: localsScope.variablesReference })) as VariablesResponse;
  } catch {
    return formatReport(frame, undefined, ['Could not read local variables for this exception.']);
  }

  const shown = (vars.variables ?? []).slice(0, Math.max(5, Math.min(200, maxVariables)));
  return formatReport(frame, shown);
}

function formatReport(frame: StackFrame, vars?: Variable[], notes: string[] = []): string {
  const location = frame.source?.path
    ? `${frame.source.path}:${frame.line}:${frame.column}`
    : `${frame.name} @ ${frame.line}:${frame.column}`;

  const out: string[] = [];
  out.push('Code Coach — Runtime Exception');
  out.push('');
  out.push(`Stopped at: ${location}`);
  out.push('');

  if (vars && vars.length > 0) {
    out.push('Locals (snapshot):');
    for (const v of vars) {
      const typeSuffix = v.type ? `: ${v.type}` : '';
      out.push(`- ${v.name}${typeSuffix} = ${v.value}`);
    }
    out.push('');
  }

  out.push('What this usually means:');
  out.push('- An exception was thrown and execution paused at the throw site or the first frame the debugger could map.');
  out.push('- The most useful next step is to look at the variables above and ask: which one violates the expected shape/value?');
  out.push('');

  out.push('Suggested next checks:');
  out.push('- If a value is `undefined`/`null`, trace where it was supposed to be set (missing return, missing await, failed lookup).');
  out.push('- If a value is an object, confirm it has the properties your code assumes.');
  out.push('- If this is async code, confirm you are awaiting promises before using their results.');

  if (notes.length > 0) {
    out.push('');
    out.push('Notes:');
    for (const n of notes) out.push(`- ${n}`);
  }

  return out.join('\n');
}
