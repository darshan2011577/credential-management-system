import { HealthResponse } from '@credential-manager/types';
import { APP_CONFIG } from '@credential-manager/config';
import { env } from '../config/env.js';
import { getMongoDBStatus } from '../infrastructure/database/mongodb.js';
import { getRedisStatus } from '../infrastructure/redis/redis.js';

export class HealthService {
  private static startTime: number = Date.now();

  static async getHealthStatus(): Promise<HealthResponse> {
    const memoryUsage = process.memoryUsage();
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);

    const [dbStatus, redisStatus] = await Promise.all([
      getMongoDBStatus(),
      getRedisStatus(),
    ]);

    // Determine overall system health
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (dbStatus.status === 'connected' && redisStatus.status === 'connected') {
      overallStatus = 'healthy';
    } else if (dbStatus.status === 'connected' || redisStatus.status === 'connected') {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      service: APP_CONFIG.appName,
      version: APP_CONFIG.version,
      uptime: uptimeSeconds,
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsageMB: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
      },
      services: {
        api: 'ok',
        database: dbStatus.status,
        redis: redisStatus.status,
      },
      dependencies: {
        mongodb: dbStatus,
        redis: redisStatus,
      },
    };
  }
}
