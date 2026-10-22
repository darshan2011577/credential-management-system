import {
  AdminDashboardData,
  AdminDashboardQuery,
  AdminDashboardEmployeeOverviewItem,
  AdminDashboardRecentActivityItem,
} from '@credential-manager/types';
import { apiRequest } from '../auth/auth.api.js';

export async function fetchAdminDashboardStats(
  query: AdminDashboardQuery = {}
): Promise<AdminDashboardData> {
  const params = new URLSearchParams();

  if (query.dateRange) params.append('dateRange', query.dateRange);
  if (query.employeeId) params.append('employeeId', query.employeeId);
  if (query.from) params.append('from', query.from);
  if (query.to) params.append('to', query.to);

  const queryString = params.toString();
  const endpoint = queryString ? `/api/v1/admin/dashboard?${queryString}` : '/api/v1/admin/dashboard';

  return apiRequest<AdminDashboardData>(endpoint, {
    method: 'GET',
  });
}

export async function fetchAdminEmployeeOverview(
  query: AdminDashboardQuery = {}
): Promise<{ employees: AdminDashboardEmployeeOverviewItem[] }> {
  const params = new URLSearchParams();
  if (query.dateRange) params.append('dateRange', query.dateRange);
  if (query.employeeId) params.append('employeeId', query.employeeId);

  const queryString = params.toString();
  const endpoint = queryString ? `/api/v1/admin/dashboard/employees?${queryString}` : '/api/v1/admin/dashboard/employees';

  return apiRequest<{ employees: AdminDashboardEmployeeOverviewItem[] }>(endpoint, {
    method: 'GET',
  });
}

export async function fetchAdminActivityFeed(
  query: AdminDashboardQuery = {}
): Promise<{ recentActivity: AdminDashboardRecentActivityItem[] }> {
  const params = new URLSearchParams();
  if (query.dateRange) params.append('dateRange', query.dateRange);
  if (query.employeeId) params.append('employeeId', query.employeeId);

  const queryString = params.toString();
  const endpoint = queryString ? `/api/v1/admin/dashboard/activity?${queryString}` : '/api/v1/admin/dashboard/activity';

  return apiRequest<{ recentActivity: AdminDashboardRecentActivityItem[] }>(endpoint, {
    method: 'GET',
  });
}
