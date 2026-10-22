import rateLimit from 'express-rate-limit';
import { SECURITY_LIMITS } from '@credential-manager/config';
import { AppError } from '../utils/errors.js';

export const revealRateLimiter = rateLimit({
  windowMs: SECURITY_LIMITS.rateLimitWindowMs, // 15 minutes
  max: SECURITY_LIMITS.revealRateLimitMaxRequests, // 30 reveal attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(
      AppError.rateLimited(
        'Too many credential reveal attempts. To protect secret integrity, please wait before revealing more credentials.'
      )
    );
  },
});
