import { Request, Response, NextFunction } from 'express';
import { createErrorResponse } from '@credential-manager/shared';
import { AppError } from '../utils/errors.js';
import { ApiLogger } from '../utils/logger.js';
import { env } from '../config/env.js';

export function errorMiddleware(
  err: Error & { statusCode?: number; code?: string; details?: unknown },
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const isProduction = env.NODE_ENV === 'production';
  const requestId = req.id;

  let statusCode = err.statusCode || 500;
  let errorCode = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Internal Server Error';
  let details = err.details;

  // Handle invalid JSON body syntax errors from Express json()
  if (err instanceof SyntaxError && 'body' in err) {
    statusCode = 400;
    errorCode = 'BAD_REQUEST';
    message = 'Malformed JSON payload in request body';
  }

  // Handle standard AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.code;
    message = err.message;
    details = err.details;
  }

  // Sanitize internal server errors in production
  if (isProduction && statusCode === 500) {
    message = 'An unexpected internal server error occurred. Please contact support.';
    details = undefined;
  }

  // Log error with request ID
  ApiLogger.error(
    'ErrorHandler',
    `Error on ${req.method} ${req.originalUrl}: ${err.message}`,
    err,
    requestId
  );

  res.status(statusCode).json(
    createErrorResponse(
      {
        code: errorCode,
        message,
        details: !isProduction && details === undefined && statusCode === 500 ? { stack: err.stack } : details,
      },
      undefined,
      undefined,
      requestId
    )
  );
}
