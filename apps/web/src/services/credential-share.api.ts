import {
  CreateShareDto,
  ICredentialShare,
  PublicShareAccessData,
  PublicShareMetadata,
  SharedCredentialItem,
  SharedFileItem,
  SharedRevealResponse,
  ShareRecipientOption,
} from '@credential-manager/types';
import { APP_CONFIG } from '@credential-manager/config';
import { apiRequest } from '../auth/auth.api.js';

const API_BASE_URL =
  window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? '' // Use Vite proxy in local dev
    : `http://127.0.0.1:${APP_CONFIG.defaultApiPort}`;

export async function createCredentialShare(
  dto: CreateShareDto
): Promise<{ share: ICredentialShare }> {
  return apiRequest<{ share: ICredentialShare }>('/api/v1/credential-shares', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function createShareWithFiles(
  formData: FormData
): Promise<{ share: ICredentialShare }> {
  const token = localStorage.getItem('access_token');
  const res = await fetch(`${API_BASE_URL}/api/v1/credential-shares`, {
    method: 'POST',
    credentials: 'include', // Crucial for session cookies
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    const errorMsg = json?.error?.message || json?.error || json?.message || 'Failed to create share.';
    throw new Error(errorMsg);
  }
  return json.data;
}

export async function fetchIncomingShares(): Promise<{ shares: ICredentialShare[] }> {
  return apiRequest<{ shares: ICredentialShare[] }>('/api/v1/credential-shares/incoming', {
    method: 'GET',
  });
}

export async function fetchOutgoingShares(): Promise<{ shares: ICredentialShare[] }> {
  return apiRequest<{ shares: ICredentialShare[] }>('/api/v1/credential-shares/outgoing', {
    method: 'GET',
  });
}

export async function fetchEmailShares(): Promise<{ shares: ICredentialShare[] }> {
  return apiRequest<{ shares: ICredentialShare[] }>('/api/v1/credential-shares/emails', {
    method: 'GET',
  });
}

export async function resendEmailShare(
  shareId: string
): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>(
    `/api/v1/credential-shares/${shareId}/resend-email`,
    {
      method: 'POST',
    }
  );
}

export async function fetchEligibleRecipients(): Promise<{ recipients: ShareRecipientOption[] }> {
  return apiRequest<{ recipients: ShareRecipientOption[] }>('/api/v1/credential-shares/recipients', {
    method: 'GET',
  });
}

export async function approveCredentialShare(
  shareId: string
): Promise<{ share: ICredentialShare }> {
  return apiRequest<{ share: ICredentialShare }>(`/api/v1/credential-shares/${shareId}/approve`, {
    method: 'POST',
  });
}

export async function rejectCredentialShare(
  shareId: string
): Promise<{ share: ICredentialShare }> {
  return apiRequest<{ share: ICredentialShare }>(`/api/v1/credential-shares/${shareId}/reject`, {
    method: 'POST',
  });
}

export async function revokeCredentialShare(
  shareId: string
): Promise<{ share: ICredentialShare }> {
  return apiRequest<{ share: ICredentialShare }>(`/api/v1/credential-shares/${shareId}/revoke`, {
    method: 'POST',
  });
}

export async function fetchSharedCredentials(): Promise<{ items: SharedCredentialItem[] }> {
  return apiRequest<{ items: SharedCredentialItem[] }>('/api/v1/credentials/shared', {
    method: 'GET',
  });
}

export async function fetchSharedFiles(): Promise<{ items: SharedFileItem[] }> {
  return apiRequest<{ items: SharedFileItem[] }>('/api/v1/credentials/shared/files', {
    method: 'GET',
  });
}

export async function fetchSharedCredentialById(
  credentialId: string
): Promise<{ credential: SharedCredentialItem }> {
  return apiRequest<{ credential: SharedCredentialItem }>(`/api/v1/credentials/shared/${credentialId}`, {
    method: 'GET',
  });
}

export async function revealSharedPassword(
  credentialId: string
): Promise<SharedRevealResponse> {
  return apiRequest<SharedRevealResponse>(`/api/v1/credentials/shared/${credentialId}/reveal`, {
    method: 'POST',
  });
}

export async function downloadPanelFile(
  shareId: string,
  filename: string,
  credentialPassword?: string
): Promise<void> {
  const token = localStorage.getItem('access_token');
  const res = await fetch(`${API_BASE_URL}/api/v1/credential-shares/${shareId}/download`, {
    credentials: 'include', // Crucial for session cookies
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(credentialPassword ? { 'x-credential-password': credentialPassword } : {}),
    },
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson?.error?.message || errorJson?.message || 'Failed to download file.');
  }

  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(downloadUrl);
  document.body.removeChild(a);
}

// ============================================================================
// Public External Share Endpoints
// ============================================================================

export async function fetchPublicShareMetadata(
  token: string
): Promise<{ metadata: PublicShareMetadata }> {
  const res = await fetch(`${API_BASE_URL}/api/v1/credential-shares/public/${token}`);
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || json?.message || 'Invalid or expired share link.');
  }
  return json.data;
}

export async function requestPublicShareOtp(
  token: string,
  email: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/v1/credential-shares/public/${token}/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || json?.message || 'Failed to request verification code.');
  }
  return json.data || json;
}

export async function verifyPublicShareOtp(
  token: string,
  email: string,
  otp: string
): Promise<{ accessData: PublicShareAccessData }> {
  const res = await fetch(`${API_BASE_URL}/api/v1/credential-shares/public/${token}/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error?.message || json?.message || 'Verification failed.');
  }
  return json.data;
}

export async function downloadPublicFile(
  token: string,
  filename: string,
  credentialPassword?: string
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/credential-shares/public/${token}/download`, {
    headers: {
      ...(credentialPassword ? { 'x-credential-password': credentialPassword } : {}),
    },
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson?.error?.message || errorJson?.message || 'Failed to download file.');
  }

  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(downloadUrl);
  document.body.removeChild(a);
}
