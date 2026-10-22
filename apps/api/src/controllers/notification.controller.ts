import { Request, Response, NextFunction } from 'express';
import { createSuccessResponse } from '@credential-manager/shared';
import { NotificationService } from '../services/notification.service.js';
import { AppError } from '../utils/errors.js';

export class NotificationController {
  /**
   * GET /api/v1/notifications
   * Retrieves paginated notifications for the authenticated user.
   */
  public static async listNotifications(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized('Authentication required.');

      const page = typeof req.query.page === 'number' ? req.query.page : parseInt(req.query.page as string, 10) || 1;
      const limit = typeof req.query.limit === 'number' ? req.query.limit : parseInt(req.query.limit as string, 10) || 20;

      const result = await NotificationService.listNotifications(req.user.id, page, limit);

      res.status(200).json(
        createSuccessResponse(result, 'Notifications retrieved successfully.', req.id)
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/notifications/unread-count
   * Retrieves unread notifications count for the authenticated user (Redis accelerated).
   */
  public static async getUnreadCount(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized('Authentication required.');

      const result = await NotificationService.getUnreadCount(req.user.id);

      res.status(200).json(
        createSuccessResponse(result, 'Unread notification count retrieved successfully.', req.id)
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/notifications/:id/read
   * Marks a single notification as read (Strict IDOR protection).
   */
  public static async markAsRead(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized('Authentication required.');

      const result = await NotificationService.markAsRead(req.user.id, req.params.id);

      res.status(200).json(
        createSuccessResponse(result, 'Notification marked as read.', req.id)
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/notifications/read-all
   * Marks all notifications as read for the authenticated user.
   */
  public static async markAllAsRead(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized('Authentication required.');

      const result = await NotificationService.markAllAsRead(req.user.id);

      res.status(200).json(
        createSuccessResponse(result, 'All notifications marked as read.', req.id)
      );
    } catch (error) {
      next(error);
    }
  }
}
