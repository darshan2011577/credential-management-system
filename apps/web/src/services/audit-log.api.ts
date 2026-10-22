import {
  AuditLogPaginationResult,
  AuditLogQuery,
  IAuditLog,
} from '@credential-manager/types';
import { apiRequest } from '../auth/auth.api.js';

export async function fetchAuditLogs(
  query: AuditLogQuery = {}
): Promise<AuditLogPaginationResult> {
  const params = new URLSearchParams();

  if (query.page) params.append('page', query.page.toString());
  if (query.limit) params.append('limit', query.limit.toString());
  if (query.category) params.append('category', query.category);
  if (query.action) params.append('action', query.action);
  if (query.result) params.append('result', query.result);
  if (query.actorId) params.append('actorId', query.actorId);
  if (query.targetUserId) params.append('targetUserId', query.targetUserId);
  if (query.resourceType) params.append('resourceType', query.resourceType);
  if (query.resourceId) params.append('resourceId', query.resourceId);
  if (query.from) params.append('from', query.from);
  if (query.to) params.append('to', query.to);
  if (query.search) params.append('search', query.search);

  const queryString = params.toString();
  const endpoint = queryString ? `/api/v1/audit-logs?${queryString}` : '/api/v1/audit-logs';

  return apiRequest<AuditLogPaginationResult>(endpoint, {
    method: 'GET',
  });
}

export async function fetchAuditLogById(id: string): Promise<{ log: IAuditLog }> {
  return apiRequest<{ log: IAuditLog }>(`/api/v1/audit-logs/${encodeURIComponent(id)}`, {
    method: 'GET',
  });
}
