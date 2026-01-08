/**
 * Team Knowledge Graph Type Definitions
 *
 * Represents the structure of the codebase as a graph of modules,
 * files, and their relationships (imports, exports, calls).
 */

/** Node types in the knowledge graph */
export type NodeType = 'file' | 'module' | 'function' | 'class' | 'directory';

/** Edge types representing relationships */
export type EdgeType = 'imports' | 'exports' | 'calls' | 'extends' | 'implements' | 'contains';

/** A node in the knowledge graph */
export interface GraphNode {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Node type */
  type: NodeType;
  /** File path (for file/module nodes) */
  filePath?: string;
  /** Line number (for symbol nodes) */
  line?: number;
  /** Complexity score (for sizing) */
  complexity?: number;
  /** Number of lines */
  lineCount?: number;
  /** Whether this is a team-pinned symbol */
  isPinned?: boolean;
  /** Team pin annotation if pinned */
  pinAnnotation?: string;
  /** Number of times explained (hotspot indicator) */
  explainCount?: number;
  /** Export names (for module nodes) */
  exports?: string[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/** An edge in the knowledge graph */
export interface GraphEdge {
  /** Unique identifier */
  id: string;
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Edge type */
  type: EdgeType;
  /** Import/export name */
  name?: string;
  /** Weight for layout (higher = stronger connection) */
  weight?: number;
}

/** The complete knowledge graph */
export interface KnowledgeGraph {
  /** Graph nodes */
  nodes: GraphNode[];
  /** Graph edges */
  edges: GraphEdge[];
  /** Graph metadata */
  metadata: {
    /** Total file count */
    fileCount: number;
    /** Total edge count */
    edgeCount: number;
    /** Generation timestamp */
    generatedAt: string;
    /** Root directory */
    rootPath: string;
    /** Team pin IDs */
    teamPins: string[];
    /** Frequently explained files */
    hotspots: string[];
  };
}

/** Graph filter options */
export interface GraphFilter {
  /** File glob patterns to include */
  include?: string[];
  /** File glob patterns to exclude */
  exclude?: string[];
  /** Node types to show */
  nodeTypes?: NodeType[];
  /** Edge types to show */
  edgeTypes?: EdgeType[];
  /** Focus on specific file/module */
  focusNode?: string;
  /** Depth from focus node */
  focusDepth?: number;
  /** Show only pinned nodes and their connections */
  pinnedOnly?: boolean;
  /** Show only hotspots and their connections */
  hotspotsOnly?: boolean;
}

/** Graph layout options */
export interface GraphLayout {
  /** Layout algorithm */
  algorithm: 'force' | 'hierarchical' | 'circular' | 'grid';
  /** Node spacing */
  nodeSpacing: number;
  /** Link distance */
  linkDistance: number;
  /** Force strength */
  forceStrength: number;
}

/** Default graph filter */
export const DEFAULT_GRAPH_FILTER: GraphFilter = {
  include: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
  exclude: ['**/node_modules/**', '**/dist/**', '**/out/**', '**/*.d.ts', '**/*.test.*', '**/*.spec.*'],
  nodeTypes: ['file', 'module', 'directory'],
  edgeTypes: ['imports'],
  focusDepth: 2
};

/** Default graph layout */
export const DEFAULT_GRAPH_LAYOUT: GraphLayout = {
  algorithm: 'force',
  nodeSpacing: 100,
  linkDistance: 150,
  forceStrength: -300
};

/** Graph export options */
export interface GraphExportOptions {
  format: 'svg' | 'png' | 'json';
  width?: number;
  height?: number;
  background?: string;
}

/** Webview message types */
export type GraphWebviewMessage =
  | { type: 'ready' }
  | { type: 'nodeClick'; nodeId: string }
  | { type: 'nodeDoubleClick'; nodeId: string }
  | { type: 'filter'; filter: GraphFilter }
  | { type: 'layout'; layout: GraphLayout }
  | { type: 'export'; options: GraphExportOptions }
  | { type: 'search'; query: string }
  | { type: 'focus'; nodeId: string };

/** Extension to webview messages */
export type ExtensionMessage =
  | { type: 'graphData'; graph: KnowledgeGraph }
  | { type: 'updateFilter'; filter: GraphFilter }
  | { type: 'updateLayout'; layout: GraphLayout }
  | { type: 'highlight'; nodeIds: string[] }
  | { type: 'centerOn'; nodeId: string }
  | { type: 'searchResults'; nodeIds: string[] };

/** Node color scheme based on type and status */
export const NODE_COLORS: Record<NodeType | 'pinned' | 'hotspot', string> = {
  file: '#4A90A4',      // Blue
  module: '#5C6BC0',    // Indigo
  function: '#66BB6A',  // Green
  class: '#FFA726',     // Orange
  directory: '#78909C', // Blue-grey
  pinned: '#FFD700',    // Gold
  hotspot: '#E53935'    // Red
};

/** Edge color scheme based on type */
export const EDGE_COLORS: Record<EdgeType, string> = {
  imports: '#90A4AE',   // Grey
  exports: '#4DB6AC',   // Teal
  calls: '#7986CB',     // Light indigo
  extends: '#9575CD',   // Purple
  implements: '#BA68C8', // Light purple
  contains: '#A1887F'   // Brown
};

/**
 * Generate a unique ID for nodes
 */
export function generateNodeId(type: NodeType, filePath: string, name?: string): string {
  const base = `${type}:${filePath}`;
  return name ? `${base}:${name}` : base;
}

/**
 * Generate a unique ID for edges
 */
export function generateEdgeId(source: string, target: string, type: EdgeType): string {
  return `${source}--${type}-->${target}`;
}
