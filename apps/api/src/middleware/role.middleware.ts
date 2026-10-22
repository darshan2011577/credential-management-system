import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@credential-manager/types';
import { AppError } from '../utils/errors.js';

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required.'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        AppError.forbidden(
          `Access denied. Role [${req.user.role}] is not authorized to access this resource.`
        )
      );
    }

    next();
  };
}
