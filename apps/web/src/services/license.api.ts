import { ILicenseStatusResponse, ApiResponse } from '@credential-manager/types';
import { APP_CONFIG } from '@credential-manager/config';

const API_BASE_URL = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? ''
  : `http://127.0.0.1:${APP_CONFIG.defaultApiPort}`;

export async function fetchLicenseStatus(forceRefresh: boolean = false): Promise<ILicenseStatusResponse> {
  // If running inside Electron with bridge available, prefer bridge or standard fetch
  const url = `${API_BASE_URL}/api/v1/license/status${forceRefresh ? '?refresh=true' : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  const json: ApiResponse<ILicenseStatusResponse> = await response.json();
  if (json.success) {
    return json.data;
  }

  const errorMsg = typeof json.error === 'string' ? json.error : json.error?.message;
  throw new Error(errorMsg || 'Failed to fetch license status');

}

export async function importLicenseData(licenseContent: string): Promise<{ success: boolean; status: ILicenseStatusResponse; message: string }> {
  // If desktop bridge is available
  if (window.desktop?.importLicense) {
    try {
      return await window.desktop.importLicense(licenseContent);
    } catch {
      // Fallback to fetch
    }
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/license/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ licenseContent }),
  });

  const json = await response.json();
  if (!response.ok || !json.success) {
    throw new Error(json.error?.message || json.message || 'Failed to import license');
  }

  return {
    success: true,
    status: json.data?.status || json.data,
    message: json.message || 'License imported successfully',
  };
}

export async function getMachineIdentifier(): Promise<string> {
  if (window.desktop?.getMachineId) {
    try {
      return await window.desktop.getMachineId();
    } catch {
      // Fallback to API
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/license/machine-id`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const json = await response.json();
    return json.data?.machineId || 'UNKNOWN_HARDWARE_ID';
  } catch {
    return 'UNKNOWN_HARDWARE_ID';
  }
}

export async function selectLicenseFileNative(): Promise<{ canceled: boolean; filePath?: string; content?: string }> {
  if (window.desktop?.selectLicenseFile) {
    return await window.desktop.selectLicenseFile();
  }
  return { canceled: true };
}
