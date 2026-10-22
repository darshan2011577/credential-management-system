import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existingId = req.get('x-request-id');
  const requestId = existingId && existingId.length > 0 ? existingId : randomUUID();

  req.id = requestId;
  req.startTime = Date.now();

  res.setHeader('X-Request-ID', requestId);
  next();
}
