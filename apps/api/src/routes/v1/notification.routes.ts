import { Router } from 'express';
import { NotificationController } from '../../controllers/notification.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validateRequest } from '../../middleware/validation.middleware.js';
import {
  notificationIdParamSchema,
  notificationQuerySchema,
} from '../../validators/notification.validator.js';

export const notificationRouter: Router = Router();

// All notification endpoints require valid authentication
notificationRouter.use(authenticate);

// GET /api/v1/notifications (Paginated notification feed)
notificationRouter.get(
  '/',
  validateRequest({ query: notificationQuerySchema }),
  NotificationController.listNotifications
);

// GET /api/v1/notifications/unread-count (Fast unread count with Redis cache)
notificationRouter.get(
  '/unread-count',
  NotificationController.getUnreadCount
);

// POST /api/v1/notifications/:id/read (Mark single notification read with IDOR protection)
notificationRouter.post(
  '/:id/read',
  validateRequest({ params: notificationIdParamSchema }),
  NotificationController.markAsRead
);

// POST /api/v1/notifications/read-all (Mark all unread notifications read for authenticated user)
notificationRouter.post(
  '/read-all',
  NotificationController.markAllAsRead
);
