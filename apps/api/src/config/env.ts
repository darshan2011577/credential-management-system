import path from 'path';
import dotenv from 'dotenv';
import { APP_CONFIG } from '@credential-manager/config';

import fs from 'fs';

// Load .env searching from current directory up to workspace root
const candidateEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(process.cwd(), '../.env'),
  path.resolve(process.cwd(), 'apps/api/.env'),
];

for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}
dotenv.config();


export interface AppEnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  API_PORT: number;
  API_HOST: string;
  MONGODB_URI: string;
  MONGODB_DATABASE: string;
  REDIS_URL: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  COOKIE_SECURE: boolean;
  COOKIE_SAME_SITE: 'lax' | 'strict' | 'none';
  ADMIN_BOOTSTRAP_EMAIL: string;
  ADMIN_BOOTSTRAP_PASSWORD: string;
  ADMIN_BOOTSTRAP_EMPLOYEE_ID: string;
  ADMIN_BOOTSTRAP_NAME: string;
  CREDENTIAL_ENCRYPTION_KEY: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER: string;
  SMTP_PASSWORD?: string;
  SMTP_FROM: string;
  LICENSE_PUBLIC_KEY: string;
}

export const env: AppEnvConfig = {
  NODE_ENV: (process.env.NODE_ENV as AppEnvConfig['NODE_ENV']) || 'development',
  API_PORT: parseInt(process.env.API_PORT || `${APP_CONFIG.defaultApiPort}`, 10),
  API_HOST: process.env.API_HOST || APP_CONFIG.defaultApiHost,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017',
  MONGODB_DATABASE: process.env.MONGODB_DATABASE || process.env.MONGODB_DB_NAME || 'credentialManagementSystem',
  REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,
  JWT_SECRET: process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || 'dev_secret_key_change_in_production_jwt_access',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_key_change_in_production_jwt_refresh',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  COOKIE_SECURE: process.env.COOKIE_SECURE === 'true' || (process.env.NODE_ENV === 'production'),
  COOKIE_SAME_SITE: (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') || 'lax',
  ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@toptechdevelopers.com',
  ADMIN_BOOTSTRAP_PASSWORD: process.env.ADMIN_BOOTSTRAP_PASSWORD || 'Admin@12345',
  ADMIN_BOOTSTRAP_EMPLOYEE_ID: process.env.ADMIN_BOOTSTRAP_EMPLOYEE_ID || 'ADM001',
  ADMIN_BOOTSTRAP_NAME: process.env.ADMIN_BOOTSTRAP_NAME || 'System Administrator',
  CREDENTIAL_ENCRYPTION_KEY: process.env.CREDENTIAL_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.ethereal.email',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER || 'dev@example.com',
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  SMTP_FROM: process.env.SMTP_FROM || `Credential Manager <noreply@${APP_CONFIG.organization.toLowerCase().replace(/\s+/g, '')}.com>`,
  LICENSE_PUBLIC_KEY: process.env.LICENSE_PUBLIC_KEY || '',
};

