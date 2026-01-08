/**
 * Graph Panel - Webview panel for knowledge graph visualization
 *
 * Uses a D3.js-based force-directed graph to visualize module
 * relationships, team pins, and hotspots.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
  KnowledgeGraph,
  GraphFilter,
  GraphLayout,
  GraphWebviewMessage,
  ExtensionMessage,
  DEFAULT_GRAPH_FILTER,
  DEFAULT_GRAPH_LAYOUT,
  NODE_COLORS,
  EDGE_COLORS
} from './graphTypes';
import { GraphBuilder } from './graphBuilder';

/**
 * GraphPanel - Manages the knowledge graph webview
 */
export class GraphPanel {
  public static currentPanel: GraphPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private graph: KnowledgeGraph | undefined;
  private filter: GraphFilter = DEFAULT_GRAPH_FILTER;
  private layout: GraphLayout = DEFAULT_GRAPH_LAYOUT;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;

    // Update content when view changes
    this.panel.onDidChangeViewState(
      () => {
        if (this.panel.visible && this.graph) {
          this.sendMessage({ type: 'graphData', graph: this.graph });
        }
      },
      null,
      this.disposables
    );

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      this.handleMessage.bind(this),
      null,
      this.disposables
    );

    // Clean up on dispose
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  /**
   * Create or show the graph panel
   */
  public static async createOrShow(
    extensionUri: vscode.Uri,
    focusFile?: string
  ): Promise<GraphPanel> {
    const column = vscode.ViewColumn.Two;

    // If we already have a panel, show it
    if (GraphPanel.currentPanel) {
      GraphPanel.currentPanel.panel.reveal(column);
      if (focusFile) {
        GraphPanel.currentPanel.focusOn(focusFile);
      }
      return GraphPanel.currentPanel;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      'codeCoachGraph',
      'Code Coach: Knowledge Graph',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri]
      }
    );

    GraphPanel.currentPanel = new GraphPanel(panel, extensionUri);

    // Build and show the graph
    await GraphPanel.currentPanel.buildGraph(focusFile);

    return GraphPanel.currentPanel;
  }

  /**
   * Build the knowledge graph
   */
  public async buildGraph(focusFile?: string): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showWarningMessage('No workspace folder open');
      return;
    }

    // Show loading state
    this.panel.webview.html = this.getLoadingHtml();

    try {
      // Build filter with focus
      const filter: GraphFilter = { ...this.filter };
      if (focusFile) {
        filter.focusNode = `file:${focusFile}`;
      }

      const builder = new GraphBuilder(workspaceFolder.uri.fsPath, filter);
      this.graph = await builder.build();

      // Set the webview HTML
      this.panel.webview.html = this.getWebviewHtml();

      // Send graph data
      this.sendMessage({ type: 'graphData', graph: this.graph });
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to build graph: ${err}`);
    }
  }

  /**
   * Focus on a specific file
   */
  public async focusOn(filePath: string): Promise<void> {
    const relativePath = vscode.workspace.asRelativePath(filePath);
    this.filter.focusNode = `file:${relativePath}`;
    await this.buildGraph();
  }

  /**
   * Handle messages from the webview
   */
  private async handleMessage(message: GraphWebviewMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
        if (this.graph) {
          this.sendMessage({ type: 'graphData', graph: this.graph });
        }
        break;

      case 'nodeClick':
        // Show node info
        const node = this.graph?.nodes.find(n => n.id === message.nodeId);
        if (node?.filePath) {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (workspaceFolder) {
            const uri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, node.filePath));
            vscode.window.showTextDocument(uri, { preview: true });
          }
        }
        break;

      case 'nodeDoubleClick':
        // Deep dive on the node
        const dblNode = this.graph?.nodes.find(n => n.id === message.nodeId);
        if (dblNode?.filePath) {
          vscode.commands.executeCommand('codeCoach.deepDive');
        }
        break;

      case 'filter':
        this.filter = message.filter;
        await this.buildGraph();
        break;

      case 'layout':
        this.layout = message.layout;
        this.sendMessage({ type: 'updateLayout', layout: this.layout });
        break;

      case 'search':
        const results = this.searchNodes(message.query);
        this.sendMessage({ type: 'searchResults', nodeIds: results });
        break;

      case 'focus':
        await this.focusOn(message.nodeId);
        break;

      case 'export':
        vscode.window.showInformationMessage('Graph export coming soon');
        break;
    }
  }

  /**
   * Search nodes by query
   */
  private searchNodes(query: string): string[] {
    if (!this.graph || !query) return [];

    const lowerQuery = query.toLowerCase();
    return this.graph.nodes
      .filter(n =>
        n.label.toLowerCase().includes(lowerQuery) ||
        n.filePath?.toLowerCase().includes(lowerQuery)
      )
      .map(n => n.id);
  }

  /**
   * Send a message to the webview
   */
  private sendMessage(message: ExtensionMessage): void {
    this.panel.webview.postMessage(message);
  }

  /**
   * Get the loading HTML
   */
  private getLoadingHtml(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
          }
          .loader {
            text-align: center;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid var(--vscode-foreground);
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 16px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="loader">
          <div class="spinner"></div>
          <div>Building knowledge graph...</div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get the webview HTML with D3.js visualization
   */
  private getWebviewHtml(): string {
    const nonce = getNonce();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
        <title>Knowledge Graph</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 0;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            overflow: hidden;
          }
          .toolbar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 40px;
            background: var(--vscode-titleBar-activeBackground);
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            align-items: center;
            padding: 0 12px;
            gap: 12px;
            z-index: 100;
          }
          .toolbar input {
            flex: 1;
            max-width: 300px;
            padding: 4px 8px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
          }
          .toolbar button {
            padding: 4px 12px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
          }
          .toolbar button:hover {
            background: var(--vscode-button-hoverBackground);
          }
          .stats {
            font-size: 12px;
            opacity: 0.8;
          }
          #graph {
            position: fixed;
            top: 40px;
            left: 0;
            right: 0;
            bottom: 0;
          }
          .node {
            cursor: pointer;
          }
          .node:hover {
            stroke: var(--vscode-focusBorder);
            stroke-width: 2px;
          }
          .node-label {
            font-size: 10px;
            fill: var(--vscode-foreground);
            pointer-events: none;
          }
          .link {
            stroke-opacity: 0.6;
            fill: none;
          }
          .link:hover {
            stroke-opacity: 1;
            stroke-width: 2px !important;
          }
          .tooltip {
            position: absolute;
            padding: 8px 12px;
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 4px;
            font-size: 12px;
            pointer-events: none;
            z-index: 200;
            max-width: 300px;
          }
          .legend {
            position: fixed;
            bottom: 12px;
            right: 12px;
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 4px;
            padding: 8px;
            font-size: 11px;
          }
          .legend-item {
            display: flex;
            align-items: center;
            gap: 6px;
            margin: 4px 0;
          }
          .legend-color {
            width: 12px;
            height: 12px;
            border-radius: 2px;
          }
          .no-data {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            opacity: 0.7;
          }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <input type="text" id="search" placeholder="Search nodes...">
          <button id="refresh">Refresh</button>
          <button id="resetZoom">Reset View</button>
          <span class="stats" id="stats"></span>
        </div>
        <svg id="graph"></svg>
        <div class="legend">
          <div class="legend-item"><div class="legend-color" style="background: ${NODE_COLORS.file}"></div> File</div>
          <div class="legend-item"><div class="legend-color" style="background: ${NODE_COLORS.directory}"></div> Directory</div>
          <div class="legend-item"><div class="legend-color" style="background: ${NODE_COLORS.pinned}"></div> Team Pin</div>
          <div class="legend-item"><div class="legend-color" style="background: ${NODE_COLORS.hotspot}"></div> Hotspot</div>
        </div>
        <div class="tooltip" id="tooltip" style="display: none;"></div>
        <script nonce="${nonce}">
          ${this.getGraphScript()}
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Get the D3.js graph visualization script
   */
  private getGraphScript(): string {
    // Note: This uses DOM manipulation in a controlled VS Code webview context
    // with CSP policies. The data comes from our own extension, not user input.
    return `
      const vscode = acquireVsCodeApi();
      let graph = null;
      let simulation = null;
      let svg = null;
      let zoom = null;
      let g = null;

      // Node colors
      const NODE_COLORS = ${JSON.stringify(NODE_COLORS)};
      const EDGE_COLORS = ${JSON.stringify(EDGE_COLORS)};

      // Initialize
      function init() {
        svg = document.getElementById('graph');
        const rect = svg.getBoundingClientRect();

        svg.setAttribute('width', rect.width);
        svg.setAttribute('height', rect.height);

        // Create main group for zoom/pan
        g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        svg.appendChild(g);

        // Simple zoom/pan with mouse
        let viewBox = { x: 0, y: 0, w: rect.width, h: rect.height };
        let isPanning = false;
        let startPoint = { x: 0, y: 0 };

        svg.addEventListener('mousedown', (e) => {
          if (e.button === 0) {
            isPanning = true;
            startPoint = { x: e.clientX, y: e.clientY };
          }
        });

        svg.addEventListener('mousemove', (e) => {
          if (isPanning) {
            const dx = (e.clientX - startPoint.x) * viewBox.w / rect.width;
            const dy = (e.clientY - startPoint.y) * viewBox.h / rect.height;
            viewBox.x -= dx;
            viewBox.y -= dy;
            svg.setAttribute('viewBox', viewBox.x + ' ' + viewBox.y + ' ' + viewBox.w + ' ' + viewBox.h);
            startPoint = { x: e.clientX, y: e.clientY };
          }
        });

        svg.addEventListener('mouseup', () => { isPanning = false; });
        svg.addEventListener('mouseleave', () => { isPanning = false; });

        svg.addEventListener('wheel', (e) => {
          e.preventDefault();
          const scale = e.deltaY > 0 ? 1.1 : 0.9;
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          const svgX = viewBox.x + mouseX * viewBox.w / rect.width;
          const svgY = viewBox.y + mouseY * viewBox.h / rect.height;

          viewBox.w *= scale;
          viewBox.h *= scale;
          viewBox.x = svgX - mouseX * viewBox.w / rect.width;
          viewBox.y = svgY - mouseY * viewBox.h / rect.height;

          svg.setAttribute('viewBox', viewBox.x + ' ' + viewBox.y + ' ' + viewBox.w + ' ' + viewBox.h);
        });

        // Reset zoom button
        document.getElementById('resetZoom').addEventListener('click', () => {
          viewBox = { x: 0, y: 0, w: rect.width, h: rect.height };
          svg.setAttribute('viewBox', viewBox.x + ' ' + viewBox.y + ' ' + viewBox.w + ' ' + viewBox.h);
        });

        // Search
        document.getElementById('search').addEventListener('input', (e) => {
          vscode.postMessage({ type: 'search', query: e.target.value });
        });

        // Refresh
        document.getElementById('refresh').addEventListener('click', () => {
          vscode.postMessage({ type: 'filter', filter: {} });
        });

        // Tell extension we're ready
        vscode.postMessage({ type: 'ready' });
      }

      // Render the graph using safe DOM methods
      function renderGraph(data) {
        graph = data;
        while (g.firstChild) g.removeChild(g.firstChild);

        if (!data.nodes.length) {
          document.getElementById('stats').textContent = 'No nodes to display';
          return;
        }

        const rect = svg.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        // Update stats
        document.getElementById('stats').textContent =
          data.nodes.length + ' nodes, ' + data.edges.length + ' edges';

        // Simple force simulation
        const nodes = data.nodes.map(n => ({
          ...n,
          x: Math.random() * width,
          y: Math.random() * height
        }));

        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        const links = data.edges.filter(e => nodeMap.has(e.source) && nodeMap.has(e.target));

        // Draw links
        links.forEach(link => {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.classList.add('link');
          line.setAttribute('stroke', EDGE_COLORS[link.type] || '#999');
          line.setAttribute('stroke-width', '1');
          line.dataset.source = link.source;
          line.dataset.target = link.target;
          g.appendChild(line);
        });

        // Draw nodes
        nodes.forEach(node => {
          const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          group.classList.add('node');
          group.dataset.id = node.id;

          const size = Math.max(6, Math.min(20, (node.complexity || 10) / 5));
          let color = NODE_COLORS[node.type] || '#999';
          if (node.isPinned) color = NODE_COLORS.pinned;
          if (node.explainCount >= 3) color = NODE_COLORS.hotspot;

          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('r', size);
          circle.setAttribute('fill', color);
          group.appendChild(circle);

          const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          label.classList.add('node-label');
          label.setAttribute('dy', size + 12);
          label.setAttribute('text-anchor', 'middle');
          label.textContent = node.label;
          group.appendChild(label);

          // Events
          group.addEventListener('click', () => {
            vscode.postMessage({ type: 'nodeClick', nodeId: node.id });
          });
          group.addEventListener('dblclick', () => {
            vscode.postMessage({ type: 'nodeDoubleClick', nodeId: node.id });
          });
          group.addEventListener('mouseenter', (e) => showTooltip(e, node));
          group.addEventListener('mouseleave', hideTooltip);

          g.appendChild(group);
        });

        // Simple force simulation loop
        let iterations = 100;
        function simulate() {
          // Repulsion
          nodes.forEach(a => {
            nodes.forEach(b => {
              if (a === b) return;
              const dx = a.x - b.x;
              const dy = a.y - b.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const force = 500 / (dist * dist);
              a.x += dx / dist * force;
              a.y += dy / dist * force;
            });
          });

          // Attraction (links)
          links.forEach(link => {
            const source = nodeMap.get(link.source);
            const target = nodeMap.get(link.target);
            if (!source || !target) return;
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = (dist - 150) * 0.01;
            source.x += dx / dist * force;
            source.y += dy / dist * force;
            target.x -= dx / dist * force;
            target.y -= dy / dist * force;
          });

          // Center
          nodes.forEach(n => {
            n.x += (width / 2 - n.x) * 0.01;
            n.y += (height / 2 - n.y) * 0.01;
          });

          updatePositions();

          if (--iterations > 0) {
            requestAnimationFrame(simulate);
          }
        }

        simulate();
      }

      // Update node/link positions
      function updatePositions() {
        if (!graph) return;
        const nodeMap = new Map(graph.nodes.map((n, i) => [n.id, graph.nodes[i]]));

        g.querySelectorAll('.node').forEach(el => {
          const node = nodeMap.get(el.dataset.id);
          if (node) {
            el.setAttribute('transform', 'translate(' + node.x + ', ' + node.y + ')');
          }
        });

        g.querySelectorAll('.link').forEach(el => {
          const source = nodeMap.get(el.dataset.source);
          const target = nodeMap.get(el.dataset.target);
          if (source && target) {
            el.setAttribute('x1', source.x);
            el.setAttribute('y1', source.y);
            el.setAttribute('x2', target.x);
            el.setAttribute('y2', target.y);
          }
        });
      }

      // Tooltip - using textContent for safe content insertion
      function showTooltip(e, node) {
        const tooltip = document.getElementById('tooltip');
        // Clear previous content
        tooltip.textContent = '';

        // Build tooltip content safely using DOM methods
        const strong = document.createElement('strong');
        strong.textContent = node.label;
        tooltip.appendChild(strong);

        if (node.filePath) {
          tooltip.appendChild(document.createElement('br'));
          tooltip.appendChild(document.createTextNode(node.filePath));
        }
        if (node.lineCount) {
          tooltip.appendChild(document.createElement('br'));
          tooltip.appendChild(document.createTextNode(node.lineCount + ' lines'));
        }
        if (node.isPinned) {
          tooltip.appendChild(document.createElement('br'));
          const em = document.createElement('em');
          em.textContent = node.pinAnnotation || 'Team pinned';
          tooltip.appendChild(em);
        }
        if (node.explainCount) {
          tooltip.appendChild(document.createElement('br'));
          tooltip.appendChild(document.createTextNode('Explained ' + node.explainCount + ' times'));
        }

        tooltip.style.left = (e.clientX + 10) + 'px';
        tooltip.style.top = (e.clientY + 10) + 'px';
        tooltip.style.display = 'block';
      }

      function hideTooltip() {
        document.getElementById('tooltip').style.display = 'none';
      }

      // Highlight search results
      function highlightNodes(nodeIds) {
        g.querySelectorAll('.node circle').forEach(el => {
          const id = el.parentElement.dataset.id;
          if (nodeIds.includes(id)) {
            el.setAttribute('stroke', 'var(--vscode-focusBorder)');
            el.setAttribute('stroke-width', '3');
          } else {
            el.removeAttribute('stroke');
            el.removeAttribute('stroke-width');
          }
        });
      }

      // Handle messages from extension
      window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
          case 'graphData':
            renderGraph(message.graph);
            break;
          case 'searchResults':
            highlightNodes(message.nodeIds);
            break;
        }
      });

      // Initialize on load
      init();
    `;
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    GraphPanel.currentPanel = undefined;

    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}

/**
 * Generate a nonce for CSP
 */
function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
