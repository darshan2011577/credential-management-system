export const APP_SERVER_CONFIG = {
  apiPrefix: '/api',
  v1Prefix: '/api/v1',
  bodyLimit: '1mb',
  cors: {
    allowedOrigins: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5000',
      'http://127.0.0.1:5000',
      'app://-',
      'file://',
    ],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID'],
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5000, // Allow high capacity for local desktop UI polling & dashboard workflows
  },
} as const;
