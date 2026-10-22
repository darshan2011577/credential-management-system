import { Request, Response, NextFunction } from 'express';
import { createErrorResponse, AppLogger } from '@credential-manager/shared';
import { env } from '../config/env.js';

export function errorHandler(
  err: Error & { statusCode?: number; code?: string },
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const isProduction = env.NODE_ENV === 'production';

  AppLogger.error('ErrorHandler', `Error processing ${req.method} ${req.originalUrl}: ${err.message}`, err);

  const errorMessage = isProduction && statusCode === 500
    ? 'An unexpected internal server error occurred. Please contact support.'
    : err.message || 'Internal Server Error';

  res.status(statusCode).json(
    createErrorResponse(
      errorMessage,
      err.code || 'INTERNAL_ERROR',
      !isProduction ? { stack: err.stack } : undefined
    )
  );
}
