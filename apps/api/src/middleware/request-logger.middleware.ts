import { Request, Response, NextFunction } from 'express';
import { ApiLogger } from '../utils/logger.js';

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.on('finish', () => {
    const duration = req.startTime ? Date.now() - req.startTime : 0;
    const { method, originalUrl, ip } = req;
    const { statusCode } = res;
    const requestId = req.id;

    ApiLogger.info(
      'HTTP',
      `${method} ${originalUrl} ${statusCode} ${duration}ms ip=${ip}`,
      requestId
    );
  });

  next();
}
