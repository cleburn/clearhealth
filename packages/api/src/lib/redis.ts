/**
 * ClearHealth API — Redis Client Singleton
 *
 * Creates and exports a single Redis (ioredis) instance for caching,
 * refresh token storage, and rate limiting.
 */

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('error', (err: Error) => {
  // Use stderr to avoid circular dependency with logger
  process.stderr.write(`Redis connection error: ${err.message}\n`);
});
