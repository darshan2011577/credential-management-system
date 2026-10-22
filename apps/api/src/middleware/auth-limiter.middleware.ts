import rateLimit from 'express-rate-limit';
import { SECURITY_LIMITS } from '@credential-manager/config';
import { AppError } from '../utils/errors.js';

export const authRateLimiter = rateLimit({
  windowMs: SECURITY_LIMITS.rateLimitWindowMs, // 15 minutes
  max: SECURITY_LIMITS.authRateLimitMaxRequests, // 15 attempts
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(
      AppError.rateLimited(
        'Too many authentication requests from this IP address. Please wait 15 minutes before trying again.'
      )
    );
  },
});
