import {
  PasswordRequestListItem,
  PasswordRequestOverviewResponse,
  PasswordRequestStatus,
  PasswordRequestType,
  SubmitForgotPasswordRequestDto,
  SubmitPasswordChangeRequestDto,
} from '@credential-manager/types';
import { apiRequest } from '../auth/auth.api.js';

/**
 * Submits a password change request from authenticated user (Profile/Settings).
 */
export async function submitPasswordChangeRequest(
  dto: SubmitPasswordChangeRequestDto
): Promise<{ success: boolean; message: string; requestId: string }> {
  return apiRequest<{ success: boolean; message: string; requestId: string }>(
    '/api/v1/auth/password-requests/change',
    {
      method: 'POST',
      body: JSON.stringify(dto),
    }
  );
}

/**
 * Submits a forgot-password reset request from login screen (Public).
 */
export async function submitForgotPasswordRequest(
  dto: SubmitForgotPasswordRequestDto
): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>(
    '/api/v1/auth/password-requests/forgot',
    {
      method: 'POST',
      body: JSON.stringify(dto),
    }
  );
}

/**
 * Checks if the current authenticated user has an active pending password request.
 */
export async function getMyPendingPasswordRequest(): Promise<{
  hasPending: boolean;
  request?: PasswordRequestListItem;
}> {
  return apiRequest<{
    hasPending: boolean;
    request?: PasswordRequestListItem;
  }>('/api/v1/auth/password-requests/my-pending');
}

/**
 * Fetches paginated, filterable list of password requests for administrators.
 */
export async function fetchAdminPasswordRequests(query: {
  status?: PasswordRequestStatus | 'ALL';
  requestType?: PasswordRequestType | 'ALL';
  search?: string;
  page?: number;
  limit?: number;
} = {}): Promise<PasswordRequestOverviewResponse> {
  const params = new URLSearchParams();
  if (query.status && query.status !== 'ALL') params.append('status', query.status);
  if (query.requestType && query.requestType !== 'ALL') params.append('requestType', query.requestType);
  if (query.search) params.append('search', query.search);
  if (query.page) params.append('page', String(query.page));
  if (query.limit) params.append('limit', String(query.limit));

  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiRequest<PasswordRequestOverviewResponse>(`/api/v1/admin/password-requests${qs}`);
}

/**
 * Approves a pending password request.
 */
export async function approveAdminPasswordRequest(
  id: string
): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>(
    `/api/v1/admin/password-requests/${id}/approve`,
    {
      method: 'POST',
    }
  );
}

/**
 * Rejects a pending password request with an optional reason.
 */
export async function rejectAdminPasswordRequest(
  id: string,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>(
    `/api/v1/admin/password-requests/${id}/reject`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }
  );
}
