/**
 * Onboarding Tours Type Definitions
 *
 * Tours are step-by-step codebase walkthroughs for new team members.
 * Stored in .code-coach/tours/*.json for team sharing via git.
 */

/** A single stop (step) in a tour */
export interface TourStop {
  /** Unique identifier for this stop */
  id: string;
  /** Display title for this stop */
  title: string;
  /** File path relative to workspace root */
  filePath: string;
  /** Line number to navigate to (1-indexed) */
  line: number;
  /** Optional character position */
  character?: number;
  /** Markdown content explaining this stop */
  content: string;
  /** Optional highlights to draw attention to specific ranges */
  highlights?: TourHighlight[];
  /** Optional: symbol name this stop refers to */
  symbolName?: string;
}

/** A highlight within a tour stop */
export interface TourHighlight {
  /** Start line (1-indexed) */
  startLine: number;
  /** End line (1-indexed) */
  endLine: number;
  /** Optional note for this highlight */
  note?: string;
}

/** A complete tour definition */
export interface Tour {
  /** Schema version */
  version: 1;
  /** Unique identifier */
  id: string;
  /** Display title */
  title: string;
  /** Brief description */
  description: string;
  /** Author username */
  author: string;
  /** Estimated time in minutes */
  estimatedMinutes?: number;
  /** Tour category/tags */
  tags?: string[];
  /** The stops in this tour */
  stops: TourStop[];
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt?: string;
}

/** User's progress on a tour */
export interface TourProgress {
  /** Tour ID */
  tourId: string;
  /** Current stop index (0-indexed) */
  currentStopIndex: number;
  /** Completed stop IDs */
  completedStops: string[];
  /** Whether the tour is fully completed */
  completed: boolean;
  /** Last accessed timestamp */
  lastAccessedAt: string;
  /** Started timestamp */
  startedAt: string;
}

/** Collection of user progress for all tours */
export interface TourProgressFile {
  version: 1;
  progress: TourProgress[];
}

/** Tour file stored in .code-coach/tours/ */
export interface TourFile extends Tour {
  // Same as Tour, stored as JSON
}

/** Tour list item for display */
export interface TourListItem {
  tour: Tour;
  progress?: TourProgress;
  filePath: string;
}

/** Tour runner state */
export interface TourRunnerState {
  /** Currently active tour */
  tour: Tour;
  /** Current stop index */
  currentIndex: number;
  /** Whether the tour is paused */
  paused: boolean;
}

/** Tour creation input */
export interface CreateTourInput {
  title: string;
  description: string;
  estimatedMinutes?: number;
  tags?: string[];
}

/** Stop creation input */
export interface CreateStopInput {
  title: string;
  filePath: string;
  line: number;
  character?: number;
  content: string;
  highlights?: TourHighlight[];
}

/** Suggested tour tags */
export const SUGGESTED_TOUR_TAGS = [
  { label: 'onboarding', description: 'New team member orientation' },
  { label: 'architecture', description: 'System architecture overview' },
  { label: 'auth', description: 'Authentication/authorization flow' },
  { label: 'api', description: 'API endpoints and patterns' },
  { label: 'database', description: 'Database schema and queries' },
  { label: 'frontend', description: 'Frontend components and state' },
  { label: 'testing', description: 'Testing patterns and examples' },
  { label: 'deployment', description: 'Build and deployment process' }
];

/** Default tour progress */
export function createEmptyProgress(tourId: string): TourProgress {
  return {
    tourId,
    currentStopIndex: 0,
    completedStops: [],
    completed: false,
    lastAccessedAt: new Date().toISOString(),
    startedAt: new Date().toISOString()
  };
}

/** Generate a unique ID for tours/stops */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
