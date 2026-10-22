import { ApiSuccessResponse, ApiErrorResponse } from '@credential-manager/types';

// ============================================================================
// Response Formatters
// ============================================================================

export function createSuccessResponse<T>(
  data: T,
  message?: string,
  requestId?: string
): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    ...(message && { message }),
    ...(requestId && { requestId }),
    timestamp: new Date().toISOString(),
  };
}

export function createErrorResponse(
  errorOrMessage: string | { code: string; message: string; details?: unknown },
  code?: string,
  details?: unknown,
  requestId?: string
): ApiErrorResponse {
  const errorObj = typeof errorOrMessage === 'string'
    ? {
        code: code || 'INTERNAL_ERROR',
        message: errorOrMessage,
        ...(details !== undefined && { details }),
      }
    : {
        code: errorOrMessage.code,
        message: errorOrMessage.message,
        ...(errorOrMessage.details !== undefined && { details: errorOrMessage.details }),
      };

  return {
    success: false,
    error: errorObj,
    ...(requestId && { requestId }),
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// Logging Utility (Safe, never logs secrets)
// ============================================================================

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export class AppLogger {
  private static format(level: LogLevel, context: string, message: string, meta?: unknown): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] [${context}]: ${message}${metaStr}`;
  }

  static info(context: string, message: string, meta?: unknown): void {
    console.log(this.format('INFO', context, message, meta));
  }

  static warn(context: string, message: string, meta?: unknown): void {
    console.warn(this.format('WARN', context, message, meta));
  }

  static error(context: string, message: string, error?: unknown): void {
    const errorDetails = error instanceof Error ? { message: error.message, stack: error.stack } : error;
    console.error(this.format('ERROR', context, message, errorDetails));
  }

  static debug(context: string, message: string, meta?: unknown): void {
    const isProduction = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
    if (!isProduction) {
      console.debug(this.format('DEBUG', context, message, meta));
    }
  }
}

export const logger = {
  info: (msg: string, meta?: unknown) => AppLogger.info('System', msg, meta),
  warn: (msg: string, meta?: unknown) => AppLogger.warn('System', msg, meta),
  error: (msg: string, error?: unknown) => AppLogger.error('System', msg, error),
  debug: (msg: string, meta?: unknown) => AppLogger.debug('System', msg, meta),
};


// ============================================================================
// Date and Validation Helpers
// ============================================================================

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function calculateDaysBetween(startDate: Date | string, endDate: Date | string): number {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const diffTime = end - start;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
