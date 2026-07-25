import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import chokidar from 'chokidar';
import os from 'os';
import { registerIpcHandlers } from './ipc/handlers';
import { getDb, listPending } from '@devlog/core';

let tray: Tray | null = null;
let dashboardWindow: BrowserWindow | null = null;

const DASHBOARD_DEV_URL = 'http://localhost:5173';
const DASHBOARD_BUILD_PATH = path.join(__dirname, '..', '..', 'dashboard', 'dist', 'index.html');
const isDev = !app.isPackaged;

function createDashboardWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    title: 'devlog',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL(DASHBOARD_DEV_URL);
  } else {
    win.loadFile(DASHBOARD_BUILD_PATH);
  }

  win.on('close', (event) => {
    // Hide instead of quitting — this is a background app, tray controls lifecycle.
    if (!(app as unknown as { isQuitting?: boolean }).isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  return win;
}

function updateTrayBadge(): void {
  if (!tray) return;
  try {
    const db = getDb();
    const pendingCount = listPending(db).length;
    db.close();
    tray.setToolTip(
      pendingCount > 0 ? `devlog — ${pendingCount} draft(s) awaiting review` : 'devlog — all caught up'
    );
  } catch (err) {
    console.error('[devlog:electron] Failed to update tray badge:', err);
  }
}

function createTray(): void {
  // Simple 16x16 dot icon as a placeholder — swap for a real .png/.icns asset.
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon.isEmpty() ? nativeImage.createFromNamedImage('NSStatusAvailable') : icon);

  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Dashboard',
      click: () => {
        if (!dashboardWindow || dashboardWindow.isDestroyed()) {
          dashboardWindow = createDashboardWindow();
        }
        dashboardWindow.show();
        dashboardWindow.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit devlog',
      click: () => {
        (app as unknown as { isQuitting: boolean }).isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
  tray.setToolTip('devlog');
  tray.on('click', () => {
    if (!dashboardWindow || dashboardWindow.isDestroyed()) {
      dashboardWindow = createDashboardWindow();
    }
    dashboardWindow.isVisible() ? dashboardWindow.hide() : dashboardWindow.show();
  });

  updateTrayBadge();
}

function watchDbForChanges(): void {
  const dbPath = path.join(os.homedir(), '.devlog', 'devlog.sqlite');
  const watcher = chokidar.watch(dbPath, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 300 } });

  watcher.on('change', () => {
    updateTrayBadge();
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
      dashboardWindow.webContents.send('devlog:db-changed');
    }
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createTray();
  dashboardWindow = createDashboardWindow();
  watchDbForChanges();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      dashboardWindow = createDashboardWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Intentionally do nothing — this is a tray app, it stays alive with no windows open.
});
