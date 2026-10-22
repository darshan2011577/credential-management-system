import dns from 'dns';
import mongoose from 'mongoose';
import { DependencyStatus, DatabaseHealthDetail } from '@credential-manager/types';
import { env } from '../../config/env.js';
import { MONGOOSE_CONFIG } from '../../config/database.config.js';
import { ApiLogger } from '../../utils/logger.js';

// Configure reliable DNS servers for Windows SRV query resolution (Atlas)
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch {
  // Ignore if unable to override DNS servers
}


let isConnecting = false;

// Setup Mongoose connection event listeners
mongoose.connection.on('connected', () => {
  ApiLogger.info('MongoDB', `Connected to MongoDB database: [${env.MONGODB_DATABASE}]`);
});

mongoose.connection.on('error', (err: Error) => {
  ApiLogger.error('MongoDB', 'Connection error encountered:', err);
});

mongoose.connection.on('disconnected', () => {
  ApiLogger.warn('MongoDB', 'Disconnected from MongoDB database.');
});

mongoose.connection.on('reconnected', () => {
  ApiLogger.info('MongoDB', 'Reconnected to MongoDB database.');
});

export async function connectMongoDB(): Promise<boolean> {
  if (mongoose.connection.readyState === 1) {
    return true; // Already connected
  }

  if (isConnecting) {
    return false; // Connection in progress
  }

  isConnecting = true;
  ApiLogger.info('MongoDB', `Connecting to MongoDB Atlas database: [${env.MONGODB_DATABASE}]...`);

  try {
    await mongoose.connect(env.MONGODB_URI, MONGOOSE_CONFIG);
    isConnecting = false;
    return true;
  } catch (error: unknown) {
    isConnecting = false;
    const message = error instanceof Error ? error.message : 'Unknown database error';
    ApiLogger.error('MongoDB', `Failed to connect to MongoDB Atlas: ${message}`);
    return false;
  }
}

export async function disconnectMongoDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    ApiLogger.info('MongoDB', 'Closing MongoDB Atlas connection...');
    try {
      await mongoose.disconnect();
      ApiLogger.info('MongoDB', 'MongoDB Atlas connection closed cleanly.');
    } catch (err) {
      ApiLogger.error('MongoDB', 'Error while disconnecting from MongoDB Atlas:', err);
    }
  }
}

export async function getMongoDBStatus(): Promise<DatabaseHealthDetail> {
  const readyState = mongoose.connection.readyState;
  let status: DependencyStatus = 'disconnected';

  switch (readyState) {
    case 1:
      status = 'connected';
      break;
    case 2:
      status = 'connecting';
      break;
    case 3:
      status = 'disconnected';
      break;
    default:
      status = 'disconnected';
      break;
  }

  if (status !== 'connected') {
    return {
      status,
      database: env.MONGODB_DATABASE,
    };
  }

  // Measure ping latency if connected
  try {
    const start = performance.now();
    if (mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
      const pingMs = Math.round(performance.now() - start);
      return {
        status: 'connected',
        database: env.MONGODB_DATABASE,
        pingMs,
      };
    }
    return {
      status: 'connected',
      database: env.MONGODB_DATABASE,
    };
  } catch {
    return {
      status: 'error',
      database: env.MONGODB_DATABASE,
    };
  }
}
