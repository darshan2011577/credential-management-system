import { ErrorCode } from '@credential-manager/types';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode | string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    code: ErrorCode | string,
    message: string,
    details?: unknown,
    isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string = 'Bad request', details?: unknown): AppError {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message: string = 'Authentication required', details?: unknown): AppError {
    return new AppError(401, 'UNAUTHORIZED', message, details);
  }

  static forbidden(message: string = 'Access forbidden', details?: unknown): AppError {
    return new AppError(403, 'FORBIDDEN', message, details);
  }

  static notFound(message: string = 'Resource not found', details?: unknown): AppError {
    return new AppError(404, 'RESOURCE_NOT_FOUND', message, details);
  }

  static routeNotFound(message: string = 'The requested API endpoint was not found'): AppError {
    return new AppError(404, 'ROUTE_NOT_FOUND', message);
  }

  static conflict(message: string = 'Resource conflict', details?: unknown): AppError {
    return new AppError(409, 'CONFLICT', message, details);
  }

  static unprocessableEntity(message: string = 'Validation failed', details?: unknown): AppError {
    return new AppError(422, 'VALIDATION_ERROR', message, details);
  }

  static tooManyRequests(message: string = 'Too many requests, please try again later'): AppError {
    return new AppError(429, 'RATE_LIMITED', message);
  }

  static rateLimited(message: string = 'Too many requests, please try again later'): AppError {
    return new AppError(429, 'RATE_LIMITED', message);
  }


  static internal(message: string = 'Internal server error', details?: unknown): AppError {
    return new AppError(500, 'INTERNAL_ERROR', message, details, false);
  }

  static serviceUnavailable(message: string = 'Service temporarily unavailable'): AppError {
    return new AppError(503, 'SERVICE_UNAVAILABLE', message);
  }
}
