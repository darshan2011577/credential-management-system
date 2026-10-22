import { app, BrowserWindow, net, shell } from 'electron';
import path from 'path';
import { fork, ChildProcess } from 'child_process';
import { APP_CONFIG } from '@credential-manager/config';
import { registerAppIpcHandlers } from './ipc/app';
import { registerSystemIpcHandlers, ApiManagerDelegate } from './ipc/system';
import { registerLicenseIpcHandlers } from './ipc/license';

let mainWindow: BrowserWindow | null = null;
let apiProcess: ChildProcess | null = null;
let apiStartTime: number = 0;
let apiRestartCount: number = 0;
let isQuitting: boolean = false;

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
const API_URL = `http://${APP_CONFIG.defaultApiHost}:${APP_CONFIG.defaultApiPort}`;
const HEALTH_URL = `${API_URL}/api/v1/health`;

// ----------------------------------------------------------------------------
// API Process Lifecycle Manager
// ----------------------------------------------------------------------------

function startLocalApiProcess(): boolean {
  if (isDev) {
    console.log('[Electron Main] Development mode active: API server is managed via pnpm dev / tsx');
    apiStartTime = Date.now();
    return true;
  }

  if (apiProcess) {
    console.log('[Electron Main] Local API process is already running');
    return true;
  }

  try {
    const apiPath = path.join(__dirname, '../../api/dist/server.js');
    console.log(`[Electron Main] Spawning local API child process from: ${apiPath}`);

    apiProcess = fork(apiPath, [], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        API_PORT: `${APP_CONFIG.defaultApiPort}`,
        API_HOST: APP_CONFIG.defaultApiHost,
      },
      stdio: 'inherit',
    });

    apiStartTime = Date.now();

    apiProcess.on('error', (err) => {
      console.error('[Electron Main] Local API process error:', err);
    });

    apiProcess.on('exit', (code, signal) => {
      console.log(`[Electron Main] Local API process exited with code ${code}, signal: ${signal}`);
      apiProcess = null;

      // If unexpected crash during normal runtime, notify renderer
      if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('desktop:api-crashed', `Local API service exited unexpectedly (code: ${code})`);
      }
    });

    return true;
  } catch (error) {
    console.error('[Electron Main] Failed to spawn local API child process:', error);
    return false;
  }
}

function stopLocalApiProcess(): void {
  if (apiProcess) {
    console.log('[Electron Main] Stopping local API child process...');
    try {
      apiProcess.kill('SIGTERM');
    } catch {
      // Process already terminated
    }
    apiProcess = null;
  }
}

async function restartLocalApi(): Promise<boolean> {
  apiRestartCount++;
  console.log(`[Electron Main] Attempting to restart local API (attempt #${apiRestartCount})...`);
  stopLocalApiProcess();

  if (isDev) {
    // In development mode, verify health directly
    return checkApiHealth(15, 300);
  }

  startLocalApiProcess();
  return checkApiHealth(20, 300);
}

// ----------------------------------------------------------------------------
// Health Probe & Readiness Check
// ----------------------------------------------------------------------------

function checkHealthOnce(): Promise<boolean> {
  return new Promise((resolve) => {
    const request = net.request({
      method: 'GET',
      url: HEALTH_URL,
    });

    request.on('response', (response) => {
      resolve(response.statusCode === 200);
    });

    request.on('error', () => {
      resolve(false);
    });

    request.end();
  });
}

async function checkApiHealth(maxRetries: number = 25, intervalMs: number = 400): Promise<boolean> {
  console.log(`[Electron Main] Waiting for API readiness at ${HEALTH_URL}...`);
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const isHealthy = await checkHealthOnce();
    if (isHealthy) {
      console.log(`[Electron Main] Local API is healthy and operational (verified on attempt ${attempt})`);
      return true;
    }
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  console.error(`[Electron Main] Local API readiness timeout exceeded after ${maxRetries} attempts.`);
  return false;
}

// ----------------------------------------------------------------------------
// Browser Window Creation & Error Fallback
// ----------------------------------------------------------------------------

function showStartupErrorScreen(win: BrowserWindow): void {
  const errorHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Application Startup Error - ${APP_CONFIG.appName}</title>
      <style>
        body {
          font-family: 'Segoe UI', -apple-system, sans-serif;
          background: #0b0f19;
          color: #f3f4f6;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
        }
        .container {
          background: #111827;
          border: 1px solid rgba(244, 63, 94, 0.3);
          border-radius: 12px;
          padding: 2.5rem;
          max-width: 480px;
          text-align: center;
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        }
        h1 { font-size: 1.4rem; color: #fb7185; margin-bottom: 0.75rem; }
        p { font-size: 0.95rem; color: #9ca3af; line-height: 1.5; margin-bottom: 1.5rem; }
        .btn-group { display: flex; gap: 0.75rem; justify-content: center; }
        button {
          padding: 0.6rem 1.4rem;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          font-size: 0.9rem;
        }
        .btn-retry { background: #3b82f6; color: white; }
        .btn-retry:hover { background: #2563eb; }
        .btn-exit { background: #374151; color: #d1d5db; }
        .btn-exit:hover { background: #4b5563; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Unable to start application services</h1>
        <p>The local application service (${API_URL}) could not be reached or failed to initialize. Please retry or restart the application.</p>
        <div class="btn-group">
          <button class="btn-retry" onclick="location.reload()">Retry Connection</button>
          <button class="btn-exit" onclick="window.close()">Exit Application</button>
        </div>
      </div>
    </body>
    </html>
  `;
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
}

function createMainWindow(apiReady: boolean): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 650,
    title: APP_CONFIG.appName,
    backgroundColor: '#0b0f19',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Security Navigation Boundary: Block unauthorized popups and delegate safe external URLs to system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url).catch((err) => {
        console.error('[Electron Security] Failed to open external URL:', err);
      });
    }
    return { action: 'deny' };
  });

  // Prevent renderer from navigating away from the application origin
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      const isAllowedDev = isDev && (parsedUrl.origin === 'http://127.0.0.1:5173' || parsedUrl.origin === 'http://localhost:5173');
      const isAllowedFile = parsedUrl.protocol === 'file:' || navigationUrl.startsWith('data:');

      if (!isAllowedDev && !isAllowedFile) {
        console.warn(`[Electron Security] Blocked unauthorized renderer navigation to: ${navigationUrl}`);
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });

  if (!apiReady) {
    showStartupErrorScreen(mainWindow);
  } else if (isDev) {
    const devUrl = 'http://127.0.0.1:5173';
    console.log(`[Electron Main] Loading development UI from: ${devUrl}`);
    mainWindow.loadURL(devUrl);
  } else {
    const indexPath = path.join(__dirname, '../../web/dist/index.html');
    console.log(`[Electron Main] Loading production build from: ${indexPath}`);
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ----------------------------------------------------------------------------
// IPC Registration & Delegation
// ----------------------------------------------------------------------------

const apiManagerDelegate: ApiManagerDelegate = {
  isApiRunning: () => Boolean(isDev || apiProcess),
  getApiUptime: () => (apiStartTime > 0 ? Math.floor((Date.now() - apiStartTime) / 1000) : 0),
  getRestartCount: () => apiRestartCount,
  restartApi: restartLocalApi,
};

registerAppIpcHandlers(() => mainWindow);
registerSystemIpcHandlers(apiManagerDelegate);
registerLicenseIpcHandlers(() => mainWindow);

// ----------------------------------------------------------------------------
// Application Lifecycle
// ----------------------------------------------------------------------------

app.whenReady().then(async () => {
  console.log('[Electron Main] Electron initialized. Launching startup flow...');

  // Step 1: Start API process
  startLocalApiProcess();

  // Step 2: Poll API Health
  const apiReady = await checkApiHealth(25, 400);

  // Step 3: Create Window
  createMainWindow(apiReady);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(true);
    }
  });
});

app.on('window-all-closed', () => {
  isQuitting = true;
  stopLocalApiProcess();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopLocalApiProcess();
});

process.on('SIGINT', () => {
  isQuitting = true;
  stopLocalApiProcess();
  app.quit();
});

process.on('SIGTERM', () => {
  isQuitting = true;
  stopLocalApiProcess();
  app.quit();
});
