import { Server } from 'http';
import { app } from './app.js';
import { env } from './config/env.js';
import { ApiLogger } from './utils/logger.js';
import { connectMongoDB, disconnectMongoDB } from './infrastructure/database/mongodb.js';
import { connectRedis, disconnectRedis } from './infrastructure/redis/redis.js';
import { bootstrapAdminAndSampleUsers } from './services/bootstrap.service.js';
import { EncryptionService } from './services/encryption.service.js';

let server: Server | null = null;
let isShuttingDown = false;

export async function startServer(): Promise<Server> {
  const port = env.API_PORT;
  const host = env.API_HOST;

  ApiLogger.info('Server', 'Starting Credential Manager local API services...');

  // Validate AES-256-GCM master encryption engine and 32-byte key
  EncryptionService.validateEngine();

  // Concurrently initialize MongoDB Atlas and Redis connections (non-blocking)
  Promise.all([
    connectMongoDB(),
    connectRedis(),
  ])
    .then(async () => {
      // Seed default admin and sample employee accounts if not present
      await bootstrapAdminAndSampleUsers();
    })
    .catch((err) => {
      ApiLogger.warn('Server', 'Infrastructure startup warning:', err);
    });



  server = app.listen(port, host, () => {
    ApiLogger.info('Server', `Local REST API listening on http://${host}:${port}`);
    ApiLogger.info('Server', `Primary Health Endpoint: http://${host}:${port}/api/v1/health`);
    ApiLogger.info('Server', `Compatibility Alias: http://${host}:${port}/api/health`);
    ApiLogger.info('Server', `Environment: ${env.NODE_ENV}`);
  });

  return server;
}

// ----------------------------------------------------------------------------
// Graceful Multi-Resource Shutdown Handler
// ----------------------------------------------------------------------------

async function handleShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  ApiLogger.info('Server', `Received ${signal}. Initiating graceful multi-resource shutdown...`);

  // Force shutdown fallback timer (5 seconds)
  const forceTimer = setTimeout(() => {
    ApiLogger.warn('Server', 'Forced shutdown: cleanup timed out after 5s.');
    process.exit(1);
  }, 5000);
  forceTimer.unref();

  try {
    // 1. Close HTTP server
    if (server) {
      await new Promise<void>((resolve) => {
        server?.close(() => {
          ApiLogger.info('Server', 'Local HTTP server closed.');
          resolve();
        });
      });
    }

    // 2. Disconnect MongoDB Atlas
    await disconnectMongoDB();

    // 3. Disconnect local Redis
    await disconnectRedis();

    ApiLogger.info('Server', 'Graceful shutdown completed successfully.');
    clearTimeout(forceTimer);
    process.exit(0);
  } catch (error) {
    ApiLogger.error('Server', 'Error during graceful shutdown:', error);
    clearTimeout(forceTimer);
    process.exit(1);
  }
}

// ----------------------------------------------------------------------------
// Process-Level Exception & Signal Handling
// ----------------------------------------------------------------------------

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('uncaughtException', (error: Error) => {
  ApiLogger.error('Process', 'Uncaught Exception encountered:', error);
  handleShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason: unknown) => {
  ApiLogger.error('Process', 'Unhandled Promise Rejection encountered:', reason);
});

// Auto-start if executed directly
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { server };
