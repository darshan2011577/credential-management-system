import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { APP_SERVER_CONFIG } from './config/app.config.js';
import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import { requestLoggerMiddleware } from './middleware/request-logger.middleware.js';
import { globalRateLimiter } from './middleware/rate-limiter.middleware.js';
import { notFoundMiddleware } from './middleware/not-found.middleware.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import apiRouter from './routes/index.js';

export function createApp(): Express {
  const app = express();

  // 1. Security Headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // 2. Cookie Parser
  app.use(cookieParser());

  // 3. Request ID Tracking
  app.use(requestIdMiddleware);


  // 3. CORS Configuration (Restricted to local desktop origins)
  app.use(
    cors({
      origin: (origin, callback) => {
        if (
          !origin ||
          APP_SERVER_CONFIG.cors.allowedOrigins.includes(origin as any) ||
          origin.startsWith('http://localhost:') ||
          origin.startsWith('http://127.0.0.1:')
        ) {
          return callback(null, true);
        }
        return callback(new Error(`CORS policy violation: origin ${origin} is not allowed.`));
      },
      credentials: true,
      methods: APP_SERVER_CONFIG.cors.allowedMethods as unknown as string[],
      allowedHeaders: APP_SERVER_CONFIG.cors.allowedHeaders as unknown as string[],
    })
  );

  // 4. Rate Limiting Protection
  app.use(globalRateLimiter);

  // 5. Body Parsing with Strict Size Limit (1MB)
  app.use(express.json({ limit: APP_SERVER_CONFIG.bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: APP_SERVER_CONFIG.bodyLimit }));

  // 6. Request Logging with Request ID
  app.use(requestLoggerMiddleware);

  // 7. Mount Primary API Router
  app.use(APP_SERVER_CONFIG.apiPrefix, apiRouter);

  // 8. 404 Route Not Found Handler
  app.use(notFoundMiddleware);

  // 9. Central Global Error Handler
  app.use(errorMiddleware);

  return app;
}

export const app = createApp();
export default app;
