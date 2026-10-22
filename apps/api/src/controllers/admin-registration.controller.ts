import { Request, Response, NextFunction } from 'express';
import { createSuccessResponse } from '@credential-manager/shared';
import { RegistrationListQuery } from '@credential-manager/types';
import { RegistrationService } from '../services/registration.service.js';
import { AppError } from '../utils/errors.js';

export class AdminRegistrationController {
  /**
   * GET /api/v1/admin/registrations
   * Lists employee registrations with status, department, and search filters.
   */
  public static async listRegistrations(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        throw AppError.forbidden('Access denied. Administrator privileges required.');
      }

      const query = req.query as unknown as RegistrationListQuery;
      const data = await RegistrationService.listRegistrations(query);

      res.status(200).json(
        createSuccessResponse(
          data,
          'Employee registrations retrieved successfully.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/registrations/:id
   * Retrieves full details for a registration request.
   */
  public static async getRegistrationDetails(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        throw AppError.forbidden('Access denied. Administrator privileges required.');
      }

      const registration = await RegistrationService.getRegistrationDetails(req.params.id);

      res.status(200).json(
        createSuccessResponse(
          { registration },
          'Registration details retrieved successfully.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/registrations/:id/approve
   * Approves a pending registration and securely hashes a generated temporary password.
   */
  public static async approveRegistration(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        throw AppError.forbidden('Access denied. Administrator privileges required.');
      }

      const result = await RegistrationService.approveRegistration(
        req.params.id,
        {
          id: req.user.id,
          employeeId: req.user.employeeId,
        },
        {
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          requestId: req.id,
        }
      );

      res.status(200).json(
        createSuccessResponse(
          result,
          'Employee registration approved successfully.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/registrations/:id/send-credentials
   * Dispatches login credentials email to approved employee.
   */
  public static async sendCredentials(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        throw AppError.forbidden('Access denied. Administrator privileges required.');
      }

      const result = await RegistrationService.sendCredentials(
        req.params.id,
        {
          id: req.user.id,
          employeeId: req.user.employeeId,
        },
        {
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          requestId: req.id,
        }
      );

      res.status(200).json(
        createSuccessResponse(
          result,
          result.message,
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/registrations/:id/resend-credentials
   * Generates new temporary password and resends login credentials.
   */
  public static async resendCredentials(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        throw AppError.forbidden('Access denied. Administrator privileges required.');
      }

      const result = await RegistrationService.resendCredentials(
        req.params.id,
        {
          id: req.user.id,
          employeeId: req.user.employeeId,
        },
        {
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          requestId: req.id,
        }
      );

      res.status(200).json(
        createSuccessResponse(
          result,
          result.message,
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/registrations/:id/reject
   * Rejects a pending registration.
   */
  public static async rejectRegistration(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        throw AppError.forbidden('Access denied. Administrator privileges required.');
      }

      const reason = req.body?.reason;
      const result = await RegistrationService.rejectRegistration(
        req.params.id,
        reason,
        {
          id: req.user.id,
          employeeId: req.user.employeeId,
        },
        {
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          requestId: req.id,
        }
      );

      res.status(200).json(
        createSuccessResponse(
          result,
          'Registration rejected successfully.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/registrations/:id/suspend
   * Suspends an active employee account.
   */
  public static async suspendUser(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        throw AppError.forbidden('Access denied. Administrator privileges required.');
      }

      const result = await RegistrationService.suspendUser(
        req.params.id,
        {
          id: req.user.id,
          employeeId: req.user.employeeId,
        },
        {
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          requestId: req.id,
        }
      );

      res.status(200).json(
        createSuccessResponse(
          result,
          result.message,
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/registrations/:id/reactivate
   * Reactivates a suspended employee account.
   */
  public static async reactivateUser(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        throw AppError.forbidden('Access denied. Administrator privileges required.');
      }

      const result = await RegistrationService.reactivateUser(
        req.params.id,
        {
          id: req.user.id,
          employeeId: req.user.employeeId,
        },
        {
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          requestId: req.id,
        }
      );

      res.status(200).json(
        createSuccessResponse(
          result,
          result.message,
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/admin/registrations/:id
   * Permanently deletes an employee profile and associated records.
   */
  public static async deleteUser(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        throw AppError.forbidden('Access denied. Administrator privileges required.');
      }

      const result = await RegistrationService.deleteUser(
        req.params.id,
        {
          id: req.user.id,
          employeeId: req.user.employeeId,
        },
        {
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          requestId: req.id,
        }
      );

      res.status(200).json(
        createSuccessResponse(
          result,
          result.message,
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }
}

