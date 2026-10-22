import { ipcMain } from 'electron';
import { DesktopApiStatus } from '@credential-manager/types';
import { APP_CONFIG } from '@credential-manager/config';

export interface ApiManagerDelegate {
  isApiRunning: () => boolean;
  getApiUptime: () => number;
  getRestartCount: () => number;
  restartApi: () => Promise<boolean>;
}

export function registerSystemIpcHandlers(delegate: ApiManagerDelegate): void {
  // Local Express API Status
  ipcMain.handle('desktop:get-api-status', (): DesktopApiStatus => {
    const isRunning = delegate.isApiRunning();
    const port = APP_CONFIG.defaultApiPort;
    const host = APP_CONFIG.defaultApiHost;

    return {
      isRunning,
      port,
      host,
      apiUrl: `http://${host}:${port}`,
      uptimeSeconds: delegate.getApiUptime(),
      restartCount: delegate.getRestartCount(),
    };
  });

  // Local Express API Restart Request
  ipcMain.handle('desktop:restart-api', async (): Promise<{ success: boolean; message: string }> => {
    try {
      const restarted = await delegate.restartApi();
      if (restarted) {
        return { success: true, message: 'Local API restarted successfully' };
      }
      return { success: false, message: 'Local API is managed externally in dev mode' };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown restart failure';
      return { success: false, message: `Failed to restart API: ${errorMsg}` };
    }
  });
}
