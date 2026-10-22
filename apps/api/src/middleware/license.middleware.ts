import { Request, Response, NextFunction } from 'express';
import { ILicenseValidationResult } from '@credential-manager/types';
import { LicenseService } from '../services/license.service.js';

// Extend Express Request interface to include optional license context
declare global {
  namespace Express {
    interface Request {
      license?: ILicenseValidationResult;
    }
  }
}

/**
 * Middleware that validates active application license on all incoming requests.
 * Exempt routes: health checks, license status inspection, machine-id retrieval, and license import.
 */
export async function licenseMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Allow preflight CORS OPTIONS requests
  if (req.method === 'OPTIONS') {
    return next();
  }

  // Exempt Paths that must always be accessible
  const path = req.path || req.originalUrl || '';
  const isExempt =
    path.includes('/health') ||
    path.includes('/license/status') ||
    path.includes('/license/import') ||
    path.includes('/license/machine-id');

  try {
    const validation = await LicenseService.validateLicense();
    req.license = validation;

    if (isExempt) {
      return next();
    }

    if (!validation.isValid) {
      const isTampered = validation.status === 'TAMPERED';
      const isClockIssue = validation.status === 'CLOCK_SUSPICIOUS' || validation.status === 'OFFLINE_EXCEEDED';

      res.status(403).json({
        success: false,
        error: {
          code: isTampered
            ? 'LICENSE_TAMPERED'
            : isClockIssue
              ? 'LICENSE_CLOCK_ERROR'
              : 'LICENSE_EXPIRED',
          message: 'Your application access has expired. Please contact your administrator to renew your access.',
          status: validation.status,
          reason: validation.reason,
          daysRemaining: validation.daysRemaining ?? 0,
          validatedAt: validation.validatedAt,
        },
      });
      return;
    }

    next();
  } catch (err) {
    if (isExempt) {
      return next();
    }

    res.status(403).json({
      success: false,
      error: {
        code: 'LICENSE_CHECK_FAILED',
        message: 'Your application access has expired. Please contact your administrator to renew your access.',
        status: 'INVALID',
        reason: err instanceof Error ? err.message : 'Unknown license validation failure',
      },
    });
  }
}
