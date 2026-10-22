import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';

export function notFoundMiddleware(req: Request, _res: Response, next: NextFunction): void {
  next(
    AppError.routeNotFound(
      `The requested API endpoint was not found: ${req.method} ${req.originalUrl}`
    )
  );
}
