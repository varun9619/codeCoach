/**
 * Shared Explanation Cache Type Definitions
 *
 * Caches AI explanations to avoid redundant API calls and share
 * insights across the team. Stored in .code-coach/cache/explanations.json.
 */

import * as crypto from 'crypto';

/** Cache entry representing a single explanation */
export interface CacheEntry {
  /** Unique cache key */
  key: string;
  /** File path this explanation is for */
  filePath: string;
  /** Start line (1-indexed) */
  startLine: number;
  /** End line (1-indexed) */
  endLine: number;
  /** Template ID used for this explanation */
  templateId: string;
  /** Privacy mode used (redacted explanations don't include code) */
  privacyMode: 'redacted' | 'full';
  /** The cached explanation content */
  explanation: string;
  /** Hash of the source code for invalidation */
  sourceHash: string;
  /** Who created this cache entry */
  createdBy: string;
  /** Creation timestamp */
  createdAt: string;
  /** Expiration timestamp */
  expiresAt: string;
  /** Number of times this cache entry was used */
  hitCount: number;
  /** Last accessed timestamp */
  lastAccessedAt: string;
  /** AI provider used */
  provider?: string;
  /** Model used */
  model?: string;
}

/** Cache file format stored in .code-coach/cache/explanations.json */
export interface CacheFile {
  version: 1;
  entries: CacheEntry[];
  /** Metadata about the cache */
  metadata: {
    /** Total number of cache hits */
    totalHits: number;
    /** Total number of cache misses */
    totalMisses: number;
    /** Last cleanup timestamp */
    lastCleanupAt?: string;
  };
}

/** Cache configuration */
export interface CacheConfig {
  /** Whether caching is enabled */
  enabled: boolean;
  /** Share cache with team (store in .code-coach/) */
  shareWithTeam: boolean;
  /** Time-to-live in days */
  ttlDays: number;
  /** Maximum number of entries */
  maxEntries: number;
  /** Minimum code lines to cache (don't cache tiny snippets) */
  minLines: number;
}

/** Default cache configuration */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  shareWithTeam: true,
  ttlDays: 7,
  maxEntries: 500,
  minLines: 3
};

/** Cache lookup request */
export interface CacheLookupRequest {
  /** File path */
  filePath: string;
  /** Start line */
  startLine: number;
  /** End line */
  endLine: number;
  /** Source code content */
  sourceCode: string;
  /** Template ID */
  templateId: string;
  /** Privacy mode */
  privacyMode: 'redacted' | 'full';
}

/** Cache store request */
export interface CacheStoreRequest extends CacheLookupRequest {
  /** Explanation to cache */
  explanation: string;
  /** Author username */
  author: string;
  /** AI provider used */
  provider?: string;
  /** Model used */
  model?: string;
}

/** Cache lookup result */
export interface CacheLookupResult {
  /** Whether a cache hit occurred */
  hit: boolean;
  /** The cached entry (if hit) */
  entry?: CacheEntry;
  /** Cache key (for storing if miss) */
  key: string;
}

/**
 * Generate a cache key from request parameters
 *
 * Key format: {filePathHash}:{startLine}-{endLine}:{templateId}:{privacyMode}:{sourceHash}
 */
export function generateCacheKey(request: CacheLookupRequest): string {
  const filePathHash = hashString(request.filePath).slice(0, 8);
  const sourceHash = hashString(request.sourceCode).slice(0, 8);

  return [
    filePathHash,
    `${request.startLine}-${request.endLine}`,
    request.templateId || 'default',
    request.privacyMode,
    sourceHash
  ].join(':');
}

/**
 * Hash a string using SHA-256
 */
export function hashString(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Create a new cache entry
 */
export function createCacheEntry(request: CacheStoreRequest, config: CacheConfig): CacheEntry {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + config.ttlDays);

  return {
    key: generateCacheKey(request),
    filePath: request.filePath,
    startLine: request.startLine,
    endLine: request.endLine,
    templateId: request.templateId || 'default',
    privacyMode: request.privacyMode,
    explanation: request.explanation,
    sourceHash: hashString(request.sourceCode),
    createdBy: request.author,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    hitCount: 0,
    lastAccessedAt: now.toISOString(),
    provider: request.provider,
    model: request.model
  };
}

/**
 * Check if a cache entry is expired
 */
export function isExpired(entry: CacheEntry): boolean {
  return new Date(entry.expiresAt) < new Date();
}

/**
 * Check if source code matches the cached entry
 */
export function sourceMatches(entry: CacheEntry, sourceCode: string): boolean {
  return entry.sourceHash === hashString(sourceCode);
}

/**
 * Create an empty cache file
 */
export function createEmptyCacheFile(): CacheFile {
  return {
    version: 1,
    entries: [],
    metadata: {
      totalHits: 0,
      totalMisses: 0
    }
  };
}

/**
 * Format cache entry for display
 */
export function formatCacheEntryLabel(entry: CacheEntry): string {
  const lines = entry.endLine - entry.startLine + 1;
  return `${entry.filePath}:${entry.startLine}-${entry.endLine} (${lines} lines)`;
}
