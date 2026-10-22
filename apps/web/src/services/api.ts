import { HealthResponse, ApiResponse } from '@credential-manager/types';
import { APP_CONFIG } from '@credential-manager/config';

// When running locally in browser/Electron, point to 127.0.0.1:5000 directly or via Vite proxy
const API_BASE_URL = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? '' // Uses Vite Proxy in dev or direct relative path
  : `http://127.0.0.1:${APP_CONFIG.defaultApiPort}`;

export interface HealthCheckResult {
  data: HealthResponse | null;
  latencyMs: number;
  error?: string;
}

export async function fetchApiHealth(): Promise<HealthCheckResult> {
  const startTime = performance.now();
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const latencyMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      throw new Error(`API responded with HTTP status ${response.status} (${response.statusText})`);
    }

    const json: ApiResponse<HealthResponse> = await response.json();
    if (json.success) {
      return {
        data: json.data,
        latencyMs,
      };
    } else {
      const errorMsg = typeof json.error === 'string' ? json.error : json.error.message;
      return {
        data: null,
        latencyMs,
        error: errorMsg || 'Unknown API error',
      };
    }
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - startTime);
    const errorMessage = err instanceof Error ? err.message : 'Unable to connect to local API';
    return {
      data: null,
      latencyMs,
      error: errorMessage,
    };
  }
}
