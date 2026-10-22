import {
  RegistrationListItem,
  RegistrationListQuery,
  RegistrationPaginationResult,
  SafeUser,
} from '@credential-manager/types';
import { apiRequest } from '../auth/auth.api.js';

/**
 * Fetches list of employee registrations with optional status and department filters.
 */
export async function fetchRegistrations(
  query: RegistrationListQuery = {}
): Promise<RegistrationPaginationResult> {
  const params = new URLSearchParams();
  if (query.status) params.append('status', query.status);
  if (query.department) params.append('department', query.department);
  if (query.search) params.append('search', query.search);
  if (query.page) params.append('page', String(query.page));
  if (query.limit) params.append('limit', String(query.limit));

  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiRequest<RegistrationPaginationResult>(`/api/v1/admin/registrations${qs}`);
}

/**
 * Fetches full details for a single registration request.
 */
export async function fetchRegistrationDetails(id: string): Promise<RegistrationListItem> {
  const data = await apiRequest<{ registration: RegistrationListItem }>(
    `/api/v1/admin/registrations/${id}`
  );
  return data.registration;
}

/**
 * Approves a pending employee registration.
 */
export async function approveRegistration(
  id: string
): Promise<{ user: SafeUser; message: string }> {
  return apiRequest<{ user: SafeUser; message: string }>(
    `/api/v1/admin/registrations/${id}/approve`,
    {
      method: 'POST',
    }
  );
}

/**
 * Rejects a pending employee registration with an optional reason.
 */
export async function rejectRegistration(
  id: string,
  reason?: string
): Promise<{ user: SafeUser; message: string }> {
  return apiRequest<{ user: SafeUser; message: string }>(
    `/api/v1/admin/registrations/${id}/reject`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }
  );
}

/**
 * Dispatches login credentials email to approved employee.
 */
export async function sendLoginCredentials(
  id: string
): Promise<{ success: boolean; message: string; deliveryStatus: string }> {
  return apiRequest<{ success: boolean; message: string; deliveryStatus: string }>(
    `/api/v1/admin/registrations/${id}/send-credentials`,
    {
      method: 'POST',
    }
  );
}

/**
 * Generates fresh temporary password and resends login credentials email.
 */
export async function resendLoginCredentials(
  id: string
): Promise<{ success: boolean; message: string; deliveryStatus: string }> {
  return apiRequest<{ success: boolean; message: string; deliveryStatus: string }>(
    `/api/v1/admin/registrations/${id}/resend-credentials`,
    {
      method: 'POST',
    }
  );
}

/**
 * Suspends an employee account, preventing them from logging in.
 */
export async function suspendEmployee(
  id: string
): Promise<{ user: SafeUser; message: string }> {
  return apiRequest<{ user: SafeUser; message: string }>(
    `/api/v1/admin/employees/${id}/suspend`,
    {
      method: 'POST',
    }
  );
}

/**
 * Reactivates a suspended employee account.
 */
export async function reactivateEmployee(
  id: string
): Promise<{ user: SafeUser; message: string }> {
  return apiRequest<{ user: SafeUser; message: string }>(
    `/api/v1/admin/employees/${id}/reactivate`,
    {
      method: 'POST',
    }
  );
}

/**
 * Permanently deletes an employee profile and associated records.
 */
export async function deleteEmployee(
  id: string
): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>(
    `/api/v1/admin/employees/${id}`,
    {
      method: 'DELETE',
    }
  );
}

