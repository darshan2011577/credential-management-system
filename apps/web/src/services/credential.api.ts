import {
  CreateCredentialDto,
  CredentialPaginationQuery,
  CredentialPaginationResult,
  GeneratePasswordDto,
  GeneratePasswordResponse,
  ICredentialListItem,
  RevealCredentialResponse,
  UpdateCredentialDto,
} from '@credential-manager/types';
import { apiRequest } from '../auth/auth.api.js';

export async function fetchCredentials(
  query: CredentialPaginationQuery = {}
): Promise<CredentialPaginationResult> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', query.page.toString());
  if (query.limit) params.set('limit', query.limit.toString());
  if (query.search) params.set('search', query.search);
  if (query.category) params.set('category', query.category);
  if (query.favorite !== undefined) params.set('favorite', query.favorite.toString());

  const queryString = params.toString();
  const url = `/api/v1/credentials${queryString ? `?${queryString}` : ''}`;

  return apiRequest<CredentialPaginationResult>(url, { method: 'GET' });
}

export async function fetchCredentialById(
  id: string
): Promise<{ credential: ICredentialListItem }> {
  return apiRequest<{ credential: ICredentialListItem }>(`/api/v1/credentials/${id}`, { method: 'GET' });
}

export async function createCredential(
  dto: CreateCredentialDto
): Promise<{ credential: ICredentialListItem }> {
  return apiRequest<{ credential: ICredentialListItem }>('/api/v1/credentials', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function updateCredential(
  id: string,
  dto: UpdateCredentialDto
): Promise<{ credential: ICredentialListItem }> {
  return apiRequest<{ credential: ICredentialListItem }>(`/api/v1/credentials/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}

export async function deleteCredential(
  id: string
): Promise<{ deleted: boolean }> {
  return apiRequest<{ deleted: boolean }>(`/api/v1/credentials/${id}`, {
    method: 'DELETE',
  });
}

export async function revealCredential(
  id: string
): Promise<RevealCredentialResponse> {
  return apiRequest<RevealCredentialResponse>(`/api/v1/credentials/${id}/reveal`, {
    method: 'POST',
  });
}

export async function generatePassword(
  dto: GeneratePasswordDto = {}
): Promise<GeneratePasswordResponse> {
  return apiRequest<GeneratePasswordResponse>('/api/v1/credentials/generate-password', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}
