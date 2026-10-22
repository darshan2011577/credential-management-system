type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'secret',
  'encryptionkey',
  'credentialencryptionkey',
  'smtppassword',
  'mongodburi',
  'privatekey',
]);

function sanitizeData(data: unknown): unknown {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('secret') || lowerKey.includes('password')) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export class ApiLogger {
  private static format(
    level: LogLevel,
    context: string,
    message: string,
    requestId?: string,
    meta?: unknown
  ): string {
    const timestamp = new Date().toISOString();
    const reqTag = requestId ? ` [ReqID: ${requestId}]` : '';
    const metaStr = meta ? ` | ${JSON.stringify(sanitizeData(meta))}` : '';
    return `[${timestamp}] [${level}] [${context}]${reqTag}: ${message}${metaStr}`;
  }

  static info(context: string, message: string, requestId?: string, meta?: unknown): void {
    console.log(this.format('INFO', context, message, requestId, meta));
  }

  static warn(context: string, message: string, requestId?: string, meta?: unknown): void {
    console.warn(this.format('WARN', context, message, requestId, meta));
  }

  static error(context: string, message: string, error?: unknown, requestId?: string): void {
    const errorDetails = error instanceof Error
      ? { message: error.message, stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined }
      : error;
    console.error(this.format('ERROR', context, message, requestId, errorDetails));
  }

  static debug(context: string, message: string, requestId?: string, meta?: unknown): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.format('DEBUG', context, message, requestId, meta));
    }
  }
}
