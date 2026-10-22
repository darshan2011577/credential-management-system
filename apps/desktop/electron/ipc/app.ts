import { app, BrowserWindow, ipcMain } from 'electron';
import { APP_CONFIG } from '@credential-manager/config';
import { DesktopAppInfo } from '@credential-manager/types';

export function registerAppIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  // Application Information
  ipcMain.handle('desktop:get-app-info', (): DesktopAppInfo => {
    return {
      appName: APP_CONFIG.appName,
      version: app.getVersion() || APP_CONFIG.version,
      platform: process.platform,
      architecture: process.arch,
      electronVersion: process.versions.electron || 'unknown',
      nodeVersion: process.versions.node || 'unknown',
      chromeVersion: process.versions.chrome || 'unknown',
      isPackaged: app.isPackaged,
    };
  });

  // Window Controls
  ipcMain.on('desktop:window-minimize', () => {
    const win = getMainWindow();
    if (win) win.minimize();
  });

  ipcMain.on('desktop:window-maximize', () => {
    const win = getMainWindow();
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  ipcMain.on('desktop:window-close', () => {
    const win = getMainWindow();
    if (win) win.close();
  });

  ipcMain.handle('desktop:window-is-maximized', (): boolean => {
    const win = getMainWindow();
    return win ? win.isMaximized() : false;
  });

  // Diagnostics & Ping
  ipcMain.handle('desktop:ping', (): string => {
    return 'pong';
  });

  // Backwards compatibility handlers
  ipcMain.handle('app:get-version', () => {
    return app.getVersion() || APP_CONFIG.version;
  });

  ipcMain.handle('app:ping', () => {
    return 'pong';
  });
}
