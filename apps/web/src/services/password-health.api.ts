import {
  PasswordHealthDetailsResponse,
  PasswordHealthResult,
  PasswordHealthSummary,
} from '@credential-manager/types';
import { apiRequest } from '../auth/auth.api.js';

/**
 * Fetches aggregated password health summary for authenticated user.
 */
export async function fetchPasswordHealthSummary(): Promise<PasswordHealthSummary> {
  return apiRequest<PasswordHealthSummary>('/api/v1/password-health', {
    method: 'GET',
  });
}

/**
 * Fetches full credential-level password health analysis list and summary.
 */
export async function fetchCredentialHealthList(): Promise<PasswordHealthDetailsResponse> {
  return apiRequest<PasswordHealthDetailsResponse>('/api/v1/password-health/credentials', {
    method: 'GET',
  });
}

/**
 * Fetches password health analysis for a single credential by ID.
 */
export async function fetchSingleCredentialHealth(
  credentialId: string
): Promise<PasswordHealthResult> {
  return apiRequest<PasswordHealthResult>(
    `/api/v1/password-health/credentials/${credentialId}`,
    {
      method: 'GET',
    }
  );
}
