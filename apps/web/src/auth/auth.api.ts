import { ApiResponse, AuthResponseData, RegisterDto, SafeUser } from '@credential-manager/types';
import { APP_CONFIG } from '@credential-manager/config';

const API_BASE_URL =
  window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? '' // Use Vite proxy in local dev
    : `http://127.0.0.1:${APP_CONFIG.defaultApiPort}`;

let isRefreshing = false;

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  retryOn401: boolean = true
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const config: RequestInit = {
    ...options,
    credentials: 'include', // Crucial for HTTP-only cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };


  const response = await fetch(url, config);

  if (response.status === 401 && retryOn401 && endpoint !== '/api/v1/auth/login' && endpoint !== '/api/v1/auth/refresh' && endpoint !== '/api/v1/auth/register') {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshSuccess = await apiRefresh();
        isRefreshing = false;
        if (refreshSuccess) {
          // Retry original request once
          return request<T>(endpoint, options, false);
        }
      } catch {
        isRefreshing = false;
      }
    }
  }

  const json: ApiResponse<T> = await response.json();

  if (!response.ok || !json.success) {
    if (!json.success) {
      const errorMsg =
        typeof json.error === 'string'
          ? json.error
          : json.error?.message || `HTTP ${response.status} ${response.statusText}`;
      throw new Error(errorMsg);
    }
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  return json.data;
}

const request = apiRequest;

export async function apiRegister(dto: RegisterDto): Promise<SafeUser> {
  const data = await request<{ user: SafeUser }>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(dto),
  }, false);
  return data.user;
}

export async function apiLogin(email: string, password: string): Promise<SafeUser> {
  const data = await request<AuthResponseData>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }, false);
  return data.user;
}

export async function apiRefresh(): Promise<boolean> {
  try {
    await request<AuthResponseData>('/api/v1/auth/refresh', {
      method: 'POST',
    }, false);
    return true;
  } catch {
    return false;
  }
}

export async function apiLogout(): Promise<void> {
  try {
    await request<null>('/api/v1/auth/logout', {
      method: 'POST',
    }, false);
  } catch {
    // Ignore network errors during logout
  }
}

export async function apiGetMe(): Promise<SafeUser> {
  const data = await request<AuthResponseData>('/api/v1/auth/me', {
    method: 'GET',
  });
  return data.user;
}

export async function apiChangePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await request<null>('/api/v1/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
