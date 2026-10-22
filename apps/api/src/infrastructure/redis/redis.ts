import { Redis } from 'ioredis';
import { DependencyStatus, RedisHealthDetail } from '@credential-manager/types';
import { REDIS_CONFIG } from '../../config/redis.config.js';
import { env } from '../../config/env.js';
import { ApiLogger } from '../../utils/logger.js';

let redisClient: Redis | null = null;
let isConnected = false;

function initRedisClient(): Redis {
  if (redisClient) {
    return redisClient;
  }

  // Create Redis client using URL or host/port config
  if (env.REDIS_URL && env.REDIS_URL.startsWith('redis://')) {
    redisClient = new Redis(env.REDIS_URL, REDIS_CONFIG);
  } else {
    redisClient = new Redis(REDIS_CONFIG);
  }

  redisClient.on('connect', () => {
    ApiLogger.info('Redis', `Connecting to local Redis at ${env.REDIS_HOST}:${env.REDIS_PORT}...`);
  });

  redisClient.on('ready', () => {
    isConnected = true;
    ApiLogger.info('Redis', `Connected to local Redis service at ${env.REDIS_HOST}:${env.REDIS_PORT} [Ready]`);
  });

  redisClient.on('error', (err: Error) => {
    isConnected = false;
    ApiLogger.warn('Redis', `Redis connection error: ${err.message}`);
  });

  redisClient.on('close', () => {
    isConnected = false;
    ApiLogger.warn('Redis', 'Redis connection closed.');
  });

  redisClient.on('reconnecting', () => {
    ApiLogger.info('Redis', 'Reconnecting to local Redis service...');
  });

  return redisClient;
}

export async function connectRedis(): Promise<boolean> {
  try {
    const client = initRedisClient();
    if (client.status === 'ready' || client.status === 'connect') {
      return true;
    }

    if (client.status === 'wait') {
      await client.connect();
      isConnected = true;
      return true;
    }

    return isConnected;
  } catch (err: unknown) {
    isConnected = false;
    const msg = err instanceof Error ? err.message : 'Unknown Redis error';
    ApiLogger.warn('Redis', `Could not establish immediate connection to Redis: ${msg}`);
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    ApiLogger.info('Redis', 'Closing local Redis connection...');
    try {
      await redisClient.quit();
      redisClient = null;
      isConnected = false;
      ApiLogger.info('Redis', 'Redis connection closed cleanly.');
    } catch {
      if (redisClient) {
        redisClient.disconnect();
        redisClient = null;
        isConnected = false;
      }
    }
  }
}

export function getRedisClient(): Redis | null {
  return redisClient;
}

export async function getRedisStatus(): Promise<RedisHealthDetail> {
  if (!redisClient || !isConnected) {
    return {
      status: 'disconnected',
    };
  }

  try {
    const start = performance.now();
    const pong = await redisClient.ping();
    const pingMs = Math.round(performance.now() - start);

    if (pong === 'PONG') {
      return {
        status: 'connected',
        pingMs,
      };
    }

    return {
      status: 'error',
    };
  } catch {
    return {
      status: 'disconnected',
    };
  }
}
