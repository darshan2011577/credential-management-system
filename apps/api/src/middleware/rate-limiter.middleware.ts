import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { createErrorResponse } from '@credential-manager/shared';
import { APP_SERVER_CONFIG } from '../config/app.config.js';

export const globalRateLimiter = rateLimit({
  windowMs: APP_SERVER_CONFIG.rateLimit.windowMs,
  max: APP_SERVER_CONFIG.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Never rate-limit liveness health probes, preflight OPTIONS requests, or license status checks
    if (req.method === 'OPTIONS') return true;
    const url = req.originalUrl || req.url || '';
    if (url.includes('/health') || url.includes('/license/status')) return true;
    return false;
  },
  handler: (req: Request, res: Response) => {
    res.status(429).json(
      createErrorResponse(
        {
          code: 'RATE_LIMITED',
          message: 'Too many requests from this client. Please try again later.',
        },
        undefined,
        undefined,
        req.id
      )
    );
  },
});
