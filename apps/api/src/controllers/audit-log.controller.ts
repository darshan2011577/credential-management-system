import { Request, Response, NextFunction } from 'express';
import { createSuccessResponse } from '@credential-manager/shared';
import { AuditLogQuery } from '@credential-manager/types';
import { AuditService } from '../services/audit.service.js';
import { AppError } from '../utils/errors.js';

export class AuditLogController {
  /**
   * GET /api/v1/audit-logs
   * Admin-only endpoint to list paginated and filtered security audit logs.
   */
  public static async listAuditLogs(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const query = req.query as unknown as AuditLogQuery;
      const result = await AuditService.listLogs(query);

      res.status(200).json(
        createSuccessResponse(
          result,
          'Audit logs retrieved successfully.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/audit-logs/:id
   * Admin-only endpoint to retrieve a single audit log entry by ID.
   */
  public static async getAuditLogById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const { id } = req.params;
      const log = await AuditService.getLogById(id);

      res.status(200).json(
        createSuccessResponse(
          { log },
          'Audit log details retrieved successfully.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }
}
