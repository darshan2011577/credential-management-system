import {
  MarkAllNotificationsReadResponse,
  MarkNotificationReadResponse,
  NotificationPaginationResult,
  UnreadCountResponse,
} from '@credential-manager/types';
import { apiRequest } from '../auth/auth.api.js';

export async function fetchNotifications(
  page: number = 1,
  limit: number = 20
): Promise<NotificationPaginationResult> {
  return apiRequest<NotificationPaginationResult>(
    `/api/v1/notifications?page=${page}&limit=${limit}`,
    {
      method: 'GET',
    }
  );
}

export async function fetchUnreadNotificationCount(): Promise<UnreadCountResponse> {
  return apiRequest<UnreadCountResponse>('/api/v1/notifications/unread-count', {
    method: 'GET',
  });
}

export async function markNotificationRead(
  notificationId: string
): Promise<MarkNotificationReadResponse> {
  return apiRequest<MarkNotificationReadResponse>(
    `/api/v1/notifications/${notificationId}/read`,
    {
      method: 'POST',
    }
  );
}

export async function markAllNotificationsRead(): Promise<MarkAllNotificationsReadResponse> {
  return apiRequest<MarkAllNotificationsReadResponse>('/api/v1/notifications/read-all', {
    method: 'POST',
  });
}
