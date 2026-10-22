import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { DesktopBridge, ElectronAPIBridge } from '@credential-manager/types';

// Safe Desktop Bridge for Phase 2 Integration
const desktopBridge: DesktopBridge = {
  getAppInfo: () => {
    return ipcRenderer.invoke('desktop:get-app-info');
  },
  getApiStatus: () => {
    return ipcRenderer.invoke('desktop:get-api-status');
  },
  restartApi: () => {
    return ipcRenderer.invoke('desktop:restart-api');
  },
  minimizeWindow: () => {
    ipcRenderer.send('desktop:window-minimize');
  },
  maximizeWindow: () => {
    ipcRenderer.send('desktop:window-maximize');
  },
  closeWindow: () => {
    ipcRenderer.send('desktop:window-close');
  },
  isMaximized: () => {
    return ipcRenderer.invoke('desktop:window-is-maximized');
  },
  onApiCrashed: (callback: (error: string) => void) => {
    const handler = (_event: IpcRendererEvent, error: string) => callback(error);
    ipcRenderer.on('desktop:api-crashed', handler);
    return () => {
      ipcRenderer.removeListener('desktop:api-crashed', handler);
    };
  },
  ping: () => {
    return ipcRenderer.invoke('desktop:ping');
  },
  // Phase 11 License Bridge APIs
  getLicenseStatus: () => {
    return ipcRenderer.invoke('desktop:license:get-status');
  },
  importLicense: (licenseData: string) => {
    return ipcRenderer.invoke('desktop:license:import', licenseData);
  },
  selectLicenseFile: () => {
    return ipcRenderer.invoke('desktop:license:select-file');
  },
  getMachineId: () => {
    return ipcRenderer.invoke('desktop:license:get-machine-id');
  },
};


// Backwards-compatible minimal bridge
const electronAPIBridge: ElectronAPIBridge = {
  getAppVersion: () => {
    return ipcRenderer.invoke('app:get-version');
  },
  getPlatform: () => {
    return process.platform;
  },
  isPackaged: () => {
    return !process.env.VITE_DEV_SERVER_URL && process.env.NODE_ENV === 'production';
  },
  ping: () => {
    return ipcRenderer.invoke('app:ping');
  },
};

// Expose safe APIs via context bridge
contextBridge.exposeInMainWorld('desktop', desktopBridge);
contextBridge.exposeInMainWorld('electronAPI', electronAPIBridge);
