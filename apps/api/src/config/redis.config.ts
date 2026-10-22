import { RedisOptions } from 'ioredis';
import { env } from './env.js';

export const REDIS_CONFIG: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  connectTimeout: 4000,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  lazyConnect: true,
  retryStrategy(times: number): number | null {
    if (times > 5) {
      // Stop retrying after 5 attempts to avoid infinite CPU loops
      return null;
    }
    const delay = Math.min(times * 500, 2000);
    return delay;
  },
};
