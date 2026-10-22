import { ConnectOptions } from 'mongoose';
import { env } from './env.js';

export const MONGOOSE_CONFIG: ConnectOptions = {
  dbName: env.MONGODB_DATABASE,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  minPoolSize: 2,
  retryWrites: true,
  retryReads: true,
  autoIndex: env.NODE_ENV !== 'production',
};
