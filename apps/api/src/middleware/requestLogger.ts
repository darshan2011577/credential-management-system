import { Request, Response, NextFunction } from 'express';
import { AppLogger } from '@credential-manager/shared';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl, ip } = req;
    const { statusCode } = res;

    AppLogger.info('HTTP', `${method} ${originalUrl} ${statusCode} - ${duration}ms`, {
      ip,
      userAgent: req.get('user-agent'),
    });
  });

  next();
}
