import { Request, Response, NextFunction } from 'express';
import { createSuccessResponse } from '@credential-manager/shared';
import { PasswordRequestService } from '../services/password-request.service.js';
import { AppError } from '../utils/errors.js';
import { PasswordRequestStatus, PasswordRequestType } from '@credential-manager/types';

export class PasswordRequestController {
  /**
   * POST /api/v1/auth/password-requests/change
   * Authenticated user requests a password change.
   */
  public static async submitChangeRequest(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const { currentPassword, newPassword, reason } = req.body;
      const result = await PasswordRequestService.submitChangeRequest(
        req.user.id,
        { currentPassword, newPassword, reason },
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
   * POST /api/v1/auth/password-requests/forgot
   * Public endpoint: submit a forgot password reset request.
   */
  public static async submitForgotPassword(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { emailOrEmployeeId, newPassword, reason } = req.body;
      const result = await PasswordRequestService.submitForgotPasswordRequest(
        { emailOrEmployeeId, newPassword, reason },
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
   * GET /api/v1/auth/password-requests/my-pending
   * Authenticated user checks if they have a pending password change request.
   */
  public static async getMyPendingRequest(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const result = await PasswordRequestService.getUserPendingRequest(req.user.id);
      res.status(200).json(
        createSuccessResponse(
          result,
          'Pending password request status retrieved successfully.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/password-requests
   * Admin: List and filter all password requests.
   */
  public static async listRequests(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        throw AppError.forbidden('Access denied. Administrator privileges required.');
      }

      const status = req.query.status as PasswordRequestStatus | undefined;
      const requestType = req.query.requestType as PasswordRequestType | undefined;
      const search = req.query.search as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

      const result = await PasswordRequestService.listRequests({
        status,
        requestType,
        search,
        page,
        limit,
      });

      res.status(200).json(
        createSuccessResponse(
          result,
          'Password requests retrieved successfully.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/password-requests/:id/approve
   * Admin: Approve a password change or reset request.
   */
  public static async approveRequest(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        throw AppError.forbidden('Access denied. Administrator privileges required.');
      }

      const result = await PasswordRequestService.approveRequest(
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
   * POST /api/v1/admin/password-requests/:id/reject
   * Admin: Reject a password change or reset request.
   */
  public static async rejectRequest(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        throw AppError.forbidden('Access denied. Administrator privileges required.');
      }

      const { reason } = req.body;
      const result = await PasswordRequestService.rejectRequest(
        req.params.id,
        reason || '',
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
