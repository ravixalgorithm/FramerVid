import { Redis } from 'ioredis';

/**
 * Redis Cache Layer for FrameVid Dashboard
 * 
 * Uses your existing Upstash Redis to cache hot data (video metadata,
 * workspace lookups) so viral traffic doesn't hammer Supabase.
 * 
 * Cache keys are prefixed with `fv:` to avoid collision with BullMQ keys.
 */

let cacheClient: Redis | null = null;

function getCache(): Redis | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  if (!cacheClient) {
    cacheClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      connectTimeout: 3000,
      // Don't let cache failures crash the app
      enableOfflineQueue: false,
    });

    cacheClient.on('error', (err: any) => {
      if (err.code === 'ECONNRESET') return;
      console.warn('[Cache] Redis error (non-fatal):', err.message);
    });
  }

  return cacheClient;
}

// ─── Core Cache Primitives ───────────────────────────────────────────

/**
 * Get a cached value. Returns null on miss or error (fail-open).
 */
export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  try {
    const redis = getCache();
    if (!redis) return null;

    const raw = await redis.get(`fv:${key}`);
    if (!raw) return null;

    return JSON.parse(raw) as T;
  } catch {
    return null; // fail-open: cache miss = just query DB
  }
}

/**
 * Set a cached value with TTL (in seconds). Fails silently.
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number = 60): Promise<void> {
  try {
    const redis = getCache();
    if (!redis) return;

    await redis.set(`fv:${key}`, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // fail-open: if cache write fails, that's fine
  }
}

/**
 * Delete a cached key. Used for cache invalidation. Fails silently.
 */
export async function cacheDel(key: string): Promise<void> {
  try {
    const redis = getCache();
    if (!redis) return;

    await redis.del(`fv:${key}`);
  } catch {
    // fail-open
  }
}

/**
 * Delete multiple cached keys by pattern prefix. Fails silently.
 * Use sparingly — SCAN is O(N) on large keyspaces.
 */
export async function cacheDelPrefix(prefix: string): Promise<void> {
  try {
    const redis = getCache();
    if (!redis) return;

    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, found] = await redis.scan(cursor, 'MATCH', `fv:${prefix}*`, 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...found);
    } while (cursor !== '0');

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // fail-open
  }
}

// ─── Domain-Specific Cache Keys ─────────────────────────────────────

/** Cache key for video metadata (the hottest endpoint) */
export function videoMetaKey(videoId: string): string {
  return `vid:${videoId}:meta`;
}

/** Cache key for workspace data */
export function workspaceKey(workspaceId: string): string {
  return `ws:${workspaceId}`;
}

/** Cache key for folder list */
export function foldersKey(workspaceId: string): string {
  return `ws:${workspaceId}:folders`;
}

// ─── High-Level Cache Helpers ───────────────────────────────────────

/**
 * Invalidate all caches for a specific video.
 * Call this whenever a video is updated, deleted, or transcoded.
 */
export async function invalidateVideoCache(videoId: string): Promise<void> {
  await cacheDel(videoMetaKey(videoId));
}

/**
 * Invalidate workspace-level caches (folders, video lists).
 */
export async function invalidateWorkspaceCache(workspaceId: string): Promise<void> {
  await cacheDel(workspaceKey(workspaceId));
  await cacheDel(foldersKey(workspaceId));
}
