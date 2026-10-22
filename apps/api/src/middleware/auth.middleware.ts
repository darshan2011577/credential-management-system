import { Request, Response, NextFunction } from 'express';
import { AUTH_CONFIG } from '@credential-manager/config';
import { TokenService } from '../services/token.service.js';
import { AppError } from '../utils/errors.js';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    let token: string | undefined;

    // 1. Check HTTP-only cookie first
    if (req.cookies && req.cookies[AUTH_CONFIG.cookieNames.accessToken]) {
      token = req.cookies[AUTH_CONFIG.cookieNames.accessToken];
    }

    // 2. Fallback to Authorization Header (Bearer token)
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      throw AppError.unauthorized('Authentication required. Please log in to access this resource.');
    }

    const decoded = TokenService.verifyAccessToken(token);

    req.user = {
      id: decoded.sub,
      employeeId: decoded.employeeId,
      role: decoded.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}
