/**
 * Graph Builder - Analyzes codebase to build knowledge graph
 *
 * Scans TypeScript/JavaScript files to extract:
 * - Module dependencies (import/export)
 * - Directory structure
 * - Team pins and hotspots
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import {
  KnowledgeGraph,
  GraphNode,
  GraphEdge,
  GraphFilter,
  NodeType,
  DEFAULT_GRAPH_FILTER,
  generateNodeId,
  generateEdgeId
} from './graphTypes';
import { TeamPinManager } from '../teamPins';
import { ExplanationCache } from '../cache/explanationCache';

/**
 * GraphBuilder - Builds knowledge graph from codebase
 */
export class GraphBuilder {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private workspaceRoot: string;
  private filter: GraphFilter;

  constructor(workspaceRoot: string, filter: GraphFilter = DEFAULT_GRAPH_FILTER) {
    this.workspaceRoot = workspaceRoot;
    this.filter = filter;
  }

  /**
   * Build the knowledge graph
   */
  async build(): Promise<KnowledgeGraph> {
    this.nodes.clear();
    this.edges.clear();

    // Find all matching files
    const files = await this.findFiles();

    // Process each file
    for (const file of files) {
      await this.processFile(file);
    }

    // Add directory structure
    this.buildDirectoryStructure();

    // Mark team pins
    this.markTeamPins();

    // Mark hotspots (frequently explained files)
    await this.markHotspots();

    // Apply focus filter if specified
    if (this.filter.focusNode) {
      this.applyFocusFilter();
    }

    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      metadata: {
        fileCount: files.length,
        edgeCount: this.edges.size,
        generatedAt: new Date().toISOString(),
        rootPath: this.workspaceRoot,
        teamPins: this.getTeamPinIds(),
        hotspots: this.getHotspotIds()
      }
    };
  }

  /**
   * Find all files matching the filter
   */
  private async findFiles(): Promise<string[]> {
    const includes = this.filter.include || DEFAULT_GRAPH_FILTER.include!;
    const excludes = this.filter.exclude || DEFAULT_GRAPH_FILTER.exclude!;

    const files: string[] = [];

    for (const include of includes) {
      const pattern = new vscode.RelativePattern(this.workspaceRoot, include);
      const found = await vscode.workspace.findFiles(pattern, `{${excludes.join(',')}}`);
      files.push(...found.map(f => f.fsPath));
    }

    return [...new Set(files)]; // Deduplicate
  }

  /**
   * Process a single file
   */
  private async processFile(filePath: string): Promise<void> {
    const relativePath = path.relative(this.workspaceRoot, filePath);
    const nodeId = generateNodeId('file', relativePath);

    // Skip if already processed
    if (this.nodes.has(nodeId)) return;

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lineCount = content.split('\n').length;

      // Create file node
      const node: GraphNode = {
        id: nodeId,
        label: path.basename(filePath),
        type: 'file',
        filePath: relativePath,
        lineCount,
        complexity: this.calculateComplexity(content),
        exports: []
      };
      this.nodes.set(nodeId, node);

      // Parse imports and exports
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      this.extractImportsExports(sourceFile, relativePath, node);
    } catch (err) {
      console.warn(`[Code Coach] Failed to process file ${filePath}:`, err);
    }
  }

  /**
   * Extract imports and exports from a source file
   */
  private extractImportsExports(
    sourceFile: ts.SourceFile,
    filePath: string,
    node: GraphNode
  ): void {
    const visit = (tsNode: ts.Node) => {
      // Import declarations
      if (ts.isImportDeclaration(tsNode)) {
        const moduleSpecifier = tsNode.moduleSpecifier;
        if (ts.isStringLiteral(moduleSpecifier)) {
          const importPath = moduleSpecifier.text;
          this.addImportEdge(filePath, importPath, tsNode);
        }
      }

      // Export declarations
      if (ts.isExportDeclaration(tsNode)) {
        if (tsNode.moduleSpecifier && ts.isStringLiteral(tsNode.moduleSpecifier)) {
          // Re-export
          const exportPath = tsNode.moduleSpecifier.text;
          this.addReExportEdge(filePath, exportPath);
        } else if (tsNode.exportClause && ts.isNamedExports(tsNode.exportClause)) {
          // Named exports
          for (const element of tsNode.exportClause.elements) {
            node.exports?.push(element.name.text);
          }
        }
      }

      // Export assignment (export default)
      if (ts.isExportAssignment(tsNode)) {
        node.exports?.push('default');
      }

      // Function/class declarations with export modifier
      if (
        (ts.isFunctionDeclaration(tsNode) || ts.isClassDeclaration(tsNode)) &&
        tsNode.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        const name = tsNode.name?.text || 'anonymous';
        node.exports?.push(name);
      }

      ts.forEachChild(tsNode, visit);
    };

    ts.forEachChild(sourceFile, visit);
  }

  /**
   * Add an import edge
   */
  private addImportEdge(
    fromPath: string,
    importPath: string,
    tsNode: ts.ImportDeclaration
  ): void {
    // Skip external packages
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return;
    }

    // Resolve the import path
    const fromDir = path.dirname(fromPath);
    let resolvedPath = path.join(fromDir, importPath);

    // Try different extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
    for (const ext of extensions) {
      const fullPath = path.join(this.workspaceRoot, resolvedPath + ext);
      if (fs.existsSync(fullPath)) {
        resolvedPath = resolvedPath + ext;
        break;
      }
    }

    const sourceId = generateNodeId('file', fromPath);
    const targetId = generateNodeId('file', resolvedPath);
    const edgeId = generateEdgeId(sourceId, targetId, 'imports');

    // Get import names
    let importNames: string[] = [];
    if (tsNode.importClause) {
      if (tsNode.importClause.name) {
        importNames.push(tsNode.importClause.name.text);
      }
      if (tsNode.importClause.namedBindings) {
        if (ts.isNamedImports(tsNode.importClause.namedBindings)) {
          for (const element of tsNode.importClause.namedBindings.elements) {
            importNames.push(element.name.text);
          }
        } else if (ts.isNamespaceImport(tsNode.importClause.namedBindings)) {
          importNames.push(`* as ${tsNode.importClause.namedBindings.name.text}`);
        }
      }
    }

    if (!this.edges.has(edgeId)) {
      this.edges.set(edgeId, {
        id: edgeId,
        source: sourceId,
        target: targetId,
        type: 'imports',
        name: importNames.join(', '),
        weight: importNames.length || 1
      });
    }
  }

  /**
   * Add a re-export edge
   */
  private addReExportEdge(fromPath: string, exportPath: string): void {
    // Skip external packages
    if (!exportPath.startsWith('.') && !exportPath.startsWith('/')) {
      return;
    }

    const fromDir = path.dirname(fromPath);
    const resolvedPath = path.join(fromDir, exportPath);

    const sourceId = generateNodeId('file', fromPath);
    const targetId = generateNodeId('file', resolvedPath);
    const edgeId = generateEdgeId(sourceId, targetId, 'exports');

    if (!this.edges.has(edgeId)) {
      this.edges.set(edgeId, {
        id: edgeId,
        source: sourceId,
        target: targetId,
        type: 'exports'
      });
    }
  }

  /**
   * Build directory structure nodes
   */
  private buildDirectoryStructure(): void {
    const directories = new Set<string>();

    for (const node of this.nodes.values()) {
      if (node.type === 'file' && node.filePath) {
        const parts = node.filePath.split(path.sep);
        let current = '';
        for (let i = 0; i < parts.length - 1; i++) {
          current = current ? path.join(current, parts[i]) : parts[i];
          directories.add(current);
        }
      }
    }

    // Skip directory nodes if not in filter
    if (!this.filter.nodeTypes?.includes('directory')) {
      return;
    }

    for (const dir of directories) {
      const nodeId = generateNodeId('directory', dir);
      if (!this.nodes.has(nodeId)) {
        this.nodes.set(nodeId, {
          id: nodeId,
          label: path.basename(dir),
          type: 'directory',
          filePath: dir
        });
      }
    }

    // Add contains edges for directories
    for (const node of this.nodes.values()) {
      if (node.type === 'file' && node.filePath) {
        const parentDir = path.dirname(node.filePath);
        const parentId = generateNodeId('directory', parentDir);
        if (this.nodes.has(parentId)) {
          const edgeId = generateEdgeId(parentId, node.id, 'contains');
          this.edges.set(edgeId, {
            id: edgeId,
            source: parentId,
            target: node.id,
            type: 'contains'
          });
        }
      }
    }
  }

  /**
   * Mark team-pinned nodes
   */
  private markTeamPins(): void {
    const teamPinManager = TeamPinManager.getInstance();
    const pins = teamPinManager.getAllPins();

    for (const pin of pins) {
      // Find the corresponding file node
      const nodeId = generateNodeId('file', pin.filePath);
      const node = this.nodes.get(nodeId);
      if (node) {
        node.isPinned = true;
        node.pinAnnotation = pin.annotation;
      }
    }
  }

  /**
   * Mark hotspot nodes (frequently explained)
   */
  private async markHotspots(): Promise<void> {
    const cache = ExplanationCache.getInstance();
    const entries = cache.getAllEntries();

    // Count explanations per file
    const fileCounts = new Map<string, number>();
    for (const entry of entries) {
      const count = fileCounts.get(entry.filePath) || 0;
      fileCounts.set(entry.filePath, count + 1);
    }

    // Mark nodes with high explanation counts
    const threshold = 3; // Files explained 3+ times are hotspots
    for (const [filePath, count] of fileCounts) {
      if (count >= threshold) {
        const nodeId = generateNodeId('file', filePath);
        const node = this.nodes.get(nodeId);
        if (node) {
          node.explainCount = count;
        }
      }
    }
  }

  /**
   * Apply focus filter to show only nodes near the focus node
   */
  private applyFocusFilter(): void {
    if (!this.filter.focusNode) return;

    const focusId = this.filter.focusNode;
    const depth = this.filter.focusDepth ?? 2;
    const connected = new Set<string>();
    connected.add(focusId);

    // BFS to find connected nodes within depth
    const queue: Array<{ id: string; level: number }> = [{ id: focusId, level: 0 }];
    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      if (level >= depth) continue;

      // Find connected edges
      for (const edge of this.edges.values()) {
        if (edge.source === id && !connected.has(edge.target)) {
          connected.add(edge.target);
          queue.push({ id: edge.target, level: level + 1 });
        }
        if (edge.target === id && !connected.has(edge.source)) {
          connected.add(edge.source);
          queue.push({ id: edge.source, level: level + 1 });
        }
      }
    }

    // Remove nodes not in connected set
    for (const nodeId of this.nodes.keys()) {
      if (!connected.has(nodeId)) {
        this.nodes.delete(nodeId);
      }
    }

    // Remove edges where either node is removed
    for (const [edgeId, edge] of this.edges) {
      if (!connected.has(edge.source) || !connected.has(edge.target)) {
        this.edges.delete(edgeId);
      }
    }
  }

  /**
   * Calculate file complexity (simple heuristic)
   */
  private calculateComplexity(content: string): number {
    const lines = content.split('\n').length;
    const braces = (content.match(/[{}]/g) || []).length;
    const conditionals = (content.match(/\b(if|else|switch|case|for|while|do)\b/g) || []).length;
    return Math.round(lines * 0.1 + braces * 0.5 + conditionals * 2);
  }

  /**
   * Get team pin node IDs
   */
  private getTeamPinIds(): string[] {
    return Array.from(this.nodes.values())
      .filter(n => n.isPinned)
      .map(n => n.id);
  }

  /**
   * Get hotspot node IDs
   */
  private getHotspotIds(): string[] {
    return Array.from(this.nodes.values())
      .filter(n => (n.explainCount ?? 0) >= 3)
      .map(n => n.id);
  }
}
