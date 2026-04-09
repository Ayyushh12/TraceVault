/**
 * Redis Cache Layer – Upstash REST-based
 *
 * Uses @upstash/redis which works via HTTPS (no TCP needed).
 * Falls back gracefully if credentials are missing or the
 * service is unreachable.
 */

import config from './config.js';
import { logger } from '../utils/logger.js';

let redisClient = null;
let redisAvailable = false;

/**
 * Initialize and return the Upstash Redis client.
 * Returns null if Upstash isn't configured.
 */
export async function getRedisClient() {
    if (redisClient) return redisClient;

    if (!config.redis.url || !config.redis.token) {
        logger.warn('Upstash Redis not configured – caching disabled');
        return null;
    }

    try {
        // Dynamic import so the app can still run without the package installed
        const { Redis } = await import('@upstash/redis');
        redisClient = new Redis({
            url: config.redis.url,
            token: config.redis.token,
        });
        redisAvailable = true;
        logger.info('Upstash Redis client created (REST-based)');
        return redisClient;
    } catch (error) {
        logger.warn({ err: error.message }, 'Failed to create Upstash Redis client – caching disabled');
        return null;
    }
}

/**
 * Connect (ping) Redis to verify connectivity at startup.
 */
export async function connectRedis() {
    const client = await getRedisClient();
    if (!client) return null;

    try {
        const pong = await client.ping();
        if (pong === 'PONG') {
            logger.info('Upstash Redis connected ✓');
            redisAvailable = true;
        }
        return client;
    } catch (error) {
        logger.warn({ err: error.message }, 'Redis ping failed – continuing without cache');
        redisAvailable = false;
        return null;
    }
}

/**
 * Disconnect Redis (no-op for REST, but keeps the interface).
 */
export async function disconnectRedis() {
    redisClient = null;
    redisAvailable = false;
    logger.info('Redis client reference cleared');
}

// ──────────────────────────────────────────────────────────────
// Cache utility functions
// ──────────────────────────────────────────────────────────────

/**
 * Get a cached value by key.
 * @param {string} key
 * @returns {Promise<any|null>}
 */
export async function cacheGet(key) {
    if (!redisAvailable) return null;
    try {
        const client = await getRedisClient();
        if (!client) return null;
        const value = await client.get(key);
        // Upstash auto-deserializes JSON
        return value ?? null;
    } catch (error) {
        logger.debug({ key, err: error.message }, 'Cache GET failed');
        return null;
    }
}

/**
 * Set a cached value with TTL.
 * @param {string} key
 * @param {any} value
 * @param {number} ttlSeconds - default 5 minutes
 */
export async function cacheSet(key, value, ttlSeconds = 300) {
    if (!redisAvailable) return;
    try {
        const client = await getRedisClient();
        if (!client) return;
        await client.set(key, JSON.stringify(value), { ex: ttlSeconds });
    } catch (error) {
        logger.debug({ key, err: error.message }, 'Cache SET failed');
    }
}

/**
 * Delete a cached key.
 * @param {string} key
 */
export async function cacheDelete(key) {
    if (!redisAvailable) return;
    try {
        const client = await getRedisClient();
        if (!client) return;
        await client.del(key);
    } catch (error) {
        logger.debug({ key, err: error.message }, 'Cache DEL failed');
    }
}

/**
 * Delete all keys matching a glob pattern.
 * Note: Upstash supports SCAN-based key listing.
 * @param {string} pattern
 */
export async function cacheDeletePattern(pattern) {
    if (!redisAvailable) return;
    try {
        const client = await getRedisClient();
        if (!client) return;

        let cursor = 0;
        do {
            const [nextCursor, keys] = await client.scan(cursor, { match: pattern, count: 100 });
            cursor = nextCursor;
            if (keys.length > 0) {
                await client.del(...keys);
            }
        } while (cursor !== 0);
    } catch (error) {
        logger.debug({ pattern, err: error.message }, 'Cache pattern DEL failed');
    }
}

/**
 * Check if Redis is currently healthy.
 */
export function isRedisAvailable() {
    return redisAvailable;
}
