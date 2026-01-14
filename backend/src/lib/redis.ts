/**
 * Redis Client Configuration
 * Used for BullMQ queues and caching
 */

import Redis from 'ioredis';
import { logger } from './logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Create Redis connection for BullMQ
 */
export const redisConnection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

/**
 * Create separate Redis client for caching
 */
export const redisCache = new Redis(REDIS_URL, {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

// Connection events
redisConnection.on('connect', () => {
  logger.info('✓ Redis connection established (BullMQ)');
});

redisConnection.on('error', (err) => {
  logger.error('Redis connection error (BullMQ):', err);
});

redisCache.on('connect', () => {
  logger.info('✓ Redis cache connected');
});

redisCache.on('error', (err) => {
  logger.error('Redis cache error:', err);
});

/**
 * Cache helper functions
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const data = await redisCache.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Cache get error:', error);
    return null;
  }
}

export async function setCache(
  key: string,
  value: any,
  ttlSeconds: number = 300
): Promise<void> {
  try {
    await redisCache.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    logger.error('Cache set error:', error);
  }
}

export async function deleteCache(key: string): Promise<void> {
  try {
    await redisCache.del(key);
  } catch (error) {
    logger.error('Cache delete error:', error);
  }
}

export async function clearCachePattern(pattern: string): Promise<void> {
  try {
    const keys = await redisCache.keys(pattern);
    if (keys.length > 0) {
      await redisCache.del(...keys);
    }
  } catch (error) {
    logger.error('Cache clear pattern error:', error);
  }
}

/**
 * Health check for Redis
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    await redisConnection.ping();
    return true;
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return false;
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await redisConnection.quit();
  await redisCache.quit();
  logger.info('Redis connections closed');
});

export default redisConnection;
