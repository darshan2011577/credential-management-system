import { dialog, ipcMain, BrowserWindow } from 'electron';
import fs from 'fs';
import { ILicenseStatusResponse } from '@credential-manager/types';
import { APP_CONFIG } from '@credential-manager/config';

const API_BASE = `http://${APP_CONFIG.defaultApiHost}:${APP_CONFIG.defaultApiPort}/api/v1`;

export function registerLicenseIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  // 1. Get License Status
  ipcMain.handle('desktop:license:get-status', async (): Promise<ILicenseStatusResponse> => {
    try {
      const response = await fetch(`${API_BASE}/license/status?refresh=true`);
      const json = await response.json();
      if (json.data) {
        return json.data as ILicenseStatusResponse;
      }
      return {
        isValid: false,
        status: 'INVALID',
        reason: json.error?.message || 'Failed to parse license response',
        validatedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        isValid: false,
        status: 'INVALID',
        reason: `License status request failed: ${err instanceof Error ? err.message : String(err)}`,
        validatedAt: new Date().toISOString(),
      };
    }
  });

  // 2. Select License File via native OS file dialog
  ipcMain.handle('desktop:license:select-file', async (): Promise<{
    canceled: boolean;
    filePath?: string;
    content?: string;
  }> => {
    const win = getMainWindow();
    const result = await dialog.showOpenDialog(win || undefined as any, {
      title: 'Select Signed License File',
      filters: [
        { name: 'License Files (*.lic, *.json)', extensions: ['lic', 'json'] },
        { name: 'All Files (*.*)', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const filePath = result.filePaths[0];
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return {
        canceled: false,
        filePath,
        content,
      };
    } catch (err) {
      throw new Error(`Failed to read selected file: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // 3. Import License File Content
  ipcMain.handle(
    'desktop:license:import',
    async (
      _event,
      licenseData: string
    ): Promise<{ success: boolean; status: ILicenseStatusResponse; message: string }> => {
      try {
        const response = await fetch(`${API_BASE}/license/import`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ licenseContent: licenseData }),
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
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // 4. Get Machine ID
  ipcMain.handle('desktop:license:get-machine-id', async (): Promise<string> => {
    try {
      const response = await fetch(`${API_BASE}/license/machine-id`);
      const json = await response.json();
      return json.data?.machineId || 'UNKNOWN';
    } catch {
      return 'UNKNOWN';
    }
  });
}
