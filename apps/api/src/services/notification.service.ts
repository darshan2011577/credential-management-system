import mongoose from 'mongoose';
import {
  CreateNotificationDto,
  INotification,
  MarkAllNotificationsReadResponse,
  MarkNotificationReadResponse,
  NotificationPaginationResult,
  UnreadCountResponse,
} from '@credential-manager/types';
import { NOTIFICATION_CONFIG } from '@credential-manager/config';
import { NotificationModel } from '../models/notification.model.js';
import { getRedisClient } from '../infrastructure/redis/redis.js';
import { AppError } from '../utils/errors.js';
import { ApiLogger } from '../utils/logger.js';

export interface CreateNotificationParams extends CreateNotificationDto {
  dispatchEmail?: () => Promise<unknown>;
}

export class NotificationService {
  private static getCacheKey(recipientId: string): string {
    return `notifications:unread:${recipientId}`;
  }

  /**
   * Invalidates or resets the cached unread notification count in Redis.
   */
  public static async invalidateUnreadCache(recipientId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      if (redis) {
        await redis.del(this.getCacheKey(recipientId));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown Redis error';
      ApiLogger.warn('NotificationService', `Failed to invalidate unread count cache: ${msg}`);
    }
  }

  /**
   * Creates an in-app notification and optionally dispatches an asynchronous email.
   * Email delivery failure will never fail notification creation or caller transaction.
   */
  public static async createNotification(
    params: CreateNotificationParams
  ): Promise<INotification> {
    if (!mongoose.Types.ObjectId.isValid(params.recipientId)) {
      throw AppError.badRequest('Invalid recipient user identifier.');
    }

    const doc = await NotificationModel.create({
      recipientId: new mongoose.Types.ObjectId(params.recipientId),
      type: params.type,
      title: params.title.trim(),
      message: params.message.trim(),
      relatedEntityType: params.relatedEntityType,
      relatedEntityId: params.relatedEntityId
        ? new mongoose.Types.ObjectId(params.relatedEntityId)
        : undefined,
      isRead: false,
    });

    // Invalidate Redis unread count cache
    await this.invalidateUnreadCache(params.recipientId);

    // Asynchronously dispatch email if provided (fire-and-forget with safe error isolation)
    if (params.dispatchEmail && typeof params.dispatchEmail === 'function') {
      params
        .dispatchEmail()
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Unknown email dispatch error';
          ApiLogger.warn('NotificationService', `Background email dispatch failed: ${msg}`);
        });
    }

    return doc.toSafeNotification();
  }

  /**
   * Lists paginated notifications for the authenticated recipient.
   * Strictly enforces user isolation (IDOR protection).
   */
  public static async listNotifications(
    recipientId: string,
    page: number = NOTIFICATION_CONFIG.defaultPage,
    limit: number = NOTIFICATION_CONFIG.defaultLimit
  ): Promise<NotificationPaginationResult> {
    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
      throw AppError.badRequest('Invalid user identifier.');
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), NOTIFICATION_CONFIG.maxLimit);
    const skip = (safePage - 1) * safeLimit;

    const query = { recipientId: new mongoose.Types.ObjectId(recipientId) };

    const [docs, total] = await Promise.all([
      NotificationModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .exec(),
      NotificationModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    return {
      items: docs.map((doc) => doc.toSafeNotification()),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Returns the count of unread notifications for a user, accelerated with Redis caching.
   */
  public static async getUnreadCount(recipientId: string): Promise<UnreadCountResponse> {
    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
      throw AppError.badRequest('Invalid user identifier.');
    }

    const cacheKey = this.getCacheKey(recipientId);
    const redis = getRedisClient();

    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached !== null) {
          return { unreadCount: parseInt(cached, 10) || 0 };
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown Redis error';
        ApiLogger.warn('NotificationService', `Redis unread cache lookup error: ${msg}`);
      }
    }

    const count = await NotificationModel.countDocuments({
      recipientId: new mongoose.Types.ObjectId(recipientId),
      isRead: false,
    }).exec();

    if (redis) {
      try {
        await redis.setex(cacheKey, NOTIFICATION_CONFIG.unreadCacheTtlSeconds, count.toString());
      } catch {
        // Silently continue if Redis write fails
      }
    }

    return { unreadCount: count };
  }

  /**
   * Marks a single notification as read.
   * Strict IDOR check: verified that recipientId matches authenticated user.
   */
  public static async markAsRead(
    recipientId: string,
    notificationId: string
  ): Promise<MarkNotificationReadResponse> {
    if (!mongoose.Types.ObjectId.isValid(recipientId) || !mongoose.Types.ObjectId.isValid(notificationId)) {
      throw AppError.badRequest('Invalid identifier format.');
    }

    const notification = await NotificationModel.findOne({
      _id: new mongoose.Types.ObjectId(notificationId),
      recipientId: new mongoose.Types.ObjectId(recipientId),
    });

    if (!notification) {
      // Check if it exists for another user to throw forbidden, or notFound otherwise
      const existsElsewhere = await NotificationModel.exists({
        _id: new mongoose.Types.ObjectId(notificationId),
      });
      if (existsElsewhere) {
        throw AppError.forbidden('Access denied. You can only modify your own notifications.');
      }
      throw AppError.notFound('Notification record not found.');
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();
      await this.invalidateUnreadCache(recipientId);
    }

    return {
      id: notification._id.toString(),
      isRead: true,
      readAt: notification.readAt ? notification.readAt.toISOString() : new Date().toISOString(),
    };
  }

  /**
   * Marks all unread notifications as read for the authenticated recipient in a single atomic bulk operation.
   */
  public static async markAllAsRead(
    recipientId: string
  ): Promise<MarkAllNotificationsReadResponse> {
    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
      throw AppError.badRequest('Invalid user identifier.');
    }

    const now = new Date();
    const result = await NotificationModel.updateMany(
      {
        recipientId: new mongoose.Types.ObjectId(recipientId),
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: now,
        },
      }
    );

    const redis = getRedisClient();
    if (redis) {
      try {
        await redis.setex(this.getCacheKey(recipientId), NOTIFICATION_CONFIG.unreadCacheTtlSeconds, '0');
      } catch {
        // Silently continue
      }
    }

    return {
      modifiedCount: result.modifiedCount || 0,
    };
  }
}
