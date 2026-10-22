import { Request, Response, NextFunction } from 'express';
import { createSuccessResponse } from '@credential-manager/shared';
import { PasswordHealthService } from '../services/password-health/password-health.service.js';
import { AuditService } from '../services/audit.service.js';
import { AppError } from '../utils/errors.js';

export class PasswordHealthController {
  /**
   * GET /api/v1/password-health
   * Retrieves overall password health summary for the authenticated user.
   */
  public static async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const summary = await PasswordHealthService.getSummary(req.user.id);

      await AuditService.record({
        actorId: req.user.id,
        actorEmail: req.user.employeeId,
        actorRole: req.user.role,
        action: 'PASSWORD_HEALTH_VIEWED',
        category: 'PASSWORD_HEALTH',
        resourceType: 'PasswordHealthSummary',
        result: 'SUCCESS',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
        metadata: {
          score: summary.score,
          status: summary.status,
          totalCredentials: summary.totalCredentials,
        },
      });

      res.status(200).json(
        createSuccessResponse(
          summary,
          'Password health summary retrieved successfully.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/password-health/credentials
   * Retrieves detailed credential health analysis for all owned credentials.
   */
  public static async getCredentialHealthList(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const details = await PasswordHealthService.getCredentialHealthList(req.user.id);

      await AuditService.record({
        actorId: req.user.id,
        actorEmail: req.user.employeeId,
        actorRole: req.user.role,
        action: 'PASSWORD_HEALTH_ANALYZED',
        category: 'PASSWORD_HEALTH',
        resourceType: 'Credential',
        result: 'SUCCESS',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
        metadata: {
          analyzedCount: details.items.length,
          score: details.summary.score,
        },
      });

      res.status(200).json(
        createSuccessResponse(
          details,
          'Credential password health analysis retrieved successfully.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/password-health/credentials/:id
   * Retrieves password health analysis for a single credential.
   */
  public static async getSingleCredentialHealth(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const health = await PasswordHealthService.getSingleCredentialHealth(
        req.user.id,
        req.params.id
      );

      res.status(200).json(
        createSuccessResponse(
          health,
          'Credential password health retrieved successfully.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }
}
