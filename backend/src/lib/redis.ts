// =============================================================================
// Redis Client (Layer 5: Cache, Sessions, Leaderboard, Rate Limits)
// =============================================================================
// Uses ioredis for Redis connectivity. Provides:
//   1. A singleton Redis connection (reused across the app)
//   2. Helper functions for session caching
//
// Redis data structures used in this platform:
//   - STRING: session cache (user profile), rate limit counters
//   - SORTED SET: leaderboard (Phase 7)
//   - STRING with TTL: active problem cache (Phase 2)
//
// Connection string format: redis://:password@host:port
// =============================================================================

import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Singleton Redis client.
 * Connects using REDIS_URL from environment variables.
 * Falls back to localhost with no password for local development.
 */
// Strip the database number from the Redis URL (Upstash free tier only supports DB 0)
const rawRedisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisUrl = rawRedisUrl.replace(/\/\d+\s*"?\s*$/, '/0');

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    // Exponential backoff: 2^times * 50ms, capped at 2 seconds
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  // Reconnect on error only for specific error codes
  reconnectOnError(err: Error) {
    const targetErrors = ['READONLY', 'ECONNRESET', 'ECONNREFUSED'];
    return targetErrors.some((e) => err.message.includes(e));
  },
});

redis.on('connect', () => {
  console.log('✅ Redis connected');
});

redis.on('error', (err: Error) => {
  console.error('❌ Redis connection error:', err.message);
});

// =============================================================================
// Session Cache Helpers
// =============================================================================
// User profile data is cached after login to avoid hitting PostgreSQL on
// every authenticated request. TTL = 5 minutes balances freshness vs load.
//
// Key format: "session:user:{userId}"
// Value: JSON-serialized user profile (without passwordHash)
// =============================================================================

const SESSION_TTL = 300; // 5 minutes in seconds
const SESSION_PREFIX = 'session:user:';

/**
 * Cache a user profile in Redis.
 * @param userId - UUID of the user
 * @param profile - User profile object (must be JSON-serializable)
 * Time complexity: O(1) — Redis SET command
 */
export async function cacheUserProfile(
  userId: string,
  profile: Record<string, unknown>
): Promise<void> {
  await redis.set(
    `${SESSION_PREFIX}${userId}`,
    JSON.stringify(profile),
    'EX',
    SESSION_TTL
  );
}

/**
 * Retrieve a cached user profile from Redis.
 * @param userId - UUID of the user
 * @returns Parsed profile object, or null if cache miss
 * Time complexity: O(1) — Redis GET command
 */
export async function getCachedUserProfile(
  userId: string
): Promise<Record<string, unknown> | null> {
  const data = await redis.get(`${SESSION_PREFIX}${userId}`);
  if (!data) return null;
  return JSON.parse(data) as Record<string, unknown>;
}

/**
 * Invalidate a user's cached profile (e.g., after profile update).
 * @param userId - UUID of the user
 * Time complexity: O(1) — Redis DEL command
 */
export async function invalidateUserProfile(userId: string): Promise<void> {
  await redis.del(`${SESSION_PREFIX}${userId}`);
}

export default redis;
