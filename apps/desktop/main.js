const { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Notification, shell, Tray } = require('electron');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const path = require('node:path');
const http = require('node:http');
const semver = require('semver');

app.setName('邻传');
if (process.platform === 'win32') app.setAppUserModelId('com.linktran.desktop');

const PORT = 9527;
const RELEASE_API = 'https://api.github.com/repos/wogua-307/Linktran/releases/latest';
const RELEASE_URL_PREFIX = 'https://github.com/wogua-307/Linktran/releases/';
const hostInstanceId = crypto.randomUUID();
let hostProcess;
let mainWindow;
let tray;

function unreadOverlay(count) {
  if (!count) return null;
  const label = count > 99 ? '99+' : String(count);
  const fontSize = label.length > 2 ? 13 : 17;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="15" fill="#e5484d"/><text x="16" y="21" fill="white" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="700" text-anchor="middle">${label}</text></svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}

function setUnreadCount(value) {
  const count = Math.max(0, Math.min(9999, Number(value) || 0));
  if (process.platform === 'win32') mainWindow?.setOverlayIcon(unreadOverlay(count), count ? `${count} 条未读消息` : '');
  else app.setBadgeCount(count);
}

function showMessageNotification(payload) {
  if (!Notification.isSupported() || !mainWindow || mainWindow.isDestroyed()) return false;
  const title = String(payload?.title || '邻传').slice(0, 100);
  const body = String(payload?.body || '').slice(0, 500);
  const chatId = String(payload?.chatId || '').slice(0, 140);
  const notification = new Notification({ title, body, icon: trayIconPath() });
  notification.on('click', () => {
    showWindow();
    if (chatId) mainWindow.webContents.send('linktran:notification-click', chatId);
  });
  notification.show();
  return true;
}

async function checkForUpdate() {
  const response = await fetch(RELEASE_API, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': `Linktran/${app.getVersion()}` },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
  const release = await response.json();
  const currentVersion = semver.clean(app.getVersion());
  const latestVersion = semver.clean(release.tag_name);
  if (!currentVersion || !latestVersion) throw new Error('Invalid release version');
  return {
    currentVersion,
    latestVersion,
    hasUpdate: semver.gt(latestVersion, currentVersion),
    releaseUrl: release.html_url
  };
}

ipcMain.handle('linktran:check-update', checkForUpdate);
ipcMain.handle('linktran:get-version', () => app.getVersion());
ipcMain.handle('linktran:get-host-instance-id', () => hostInstanceId);
ipcMain.handle('linktran:set-unread-count', (_event, count) => setUnreadCount(count));
ipcMain.handle('linktran:notify', (_event, payload) => showMessageNotification(payload));
ipcMain.handle('linktran:open-release', (_event, url) => {
  if (typeof url !== 'string' || !url.startsWith(RELEASE_URL_PREFIX)) throw new Error('Invalid release URL');
  return shell.openExternal(url);
});

function hostRoot() {
  return app.isPackaged ? path.join(process.resourcesPath, 'lan-host') : path.resolve(__dirname, '../..');
}

function trayIconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'tray-icon.png')
    : path.join(__dirname, 'build/icons/icon-32.png');
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  updateTrayMenu();
}

function hideWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.hide();
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;
  const visible = Boolean(mainWindow?.isVisible());
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: visible ? '隐藏邻传' : '显示邻传', click: visible ? hideWindow : showWindow },
    { type: 'separator' },
    { label: '退出邻传', click: () => { app.isQuitting = true; app.quit(); } }
  ]));
}

function createTray() {
  if (tray) return;
  const size = process.platform === 'darwin' ? 18 : 20;
  const icon = nativeImage.createFromPath(trayIconPath()).resize({ width: size, height: size });
  tray = new Tray(icon);
  tray.setToolTip('邻传');
  updateTrayMenu();
  if (process.platform !== 'darwin') tray.on('click', showWindow);
  tray.on('double-click', showWindow);
}

function startLanHost() {
  const root = hostRoot();
  hostProcess = spawn(process.execPath, [path.join(root, 'server.js')], {
    cwd: root,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(PORT),
      PUBLIC_DIR: path.join(root, 'public'),
      DATA_DIR: path.join(app.getPath('userData'), 'data'),
      UPLOADS_DIR: path.join(app.getPath('userData'), 'uploads'),
      LINKTRAN_HOST_TYPE: 'desktop',
      LINKTRAN_HOST_INSTANCE_ID: hostInstanceId
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  hostProcess.stdout.on('data', data => process.stdout.write(data));
  hostProcess.stderr.on('data', data => process.stderr.write(data));
  hostProcess.on('exit', code => {
    if (code && !app.isQuitting) dialog.showErrorBox('邻传服务异常', `局域网服务已退出，代码：${code}`);
  });
}

function checkHost() {
  return new Promise(resolve => {
    const request = http.get(`http://127.0.0.1:${PORT}/api/health`, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        try { resolve(response.statusCode === 200 && JSON.parse(Buffer.concat(chunks)).app === 'linktran'); }
        catch { resolve(false); }
      });
    });
    request.on('error', () => resolve(false));
    request.setTimeout(500, () => { request.destroy(); resolve(false); });
  });
}

function waitForHost(attempts = 40) {
  return new Promise((resolve, reject) => {
    const check = async () => {
      if (await checkHost()) return resolve();
      if (attempts-- > 0) return setTimeout(check, 150);
      reject(new Error('局域网服务启动超时，请检查 9527 端口'));
    };
    check();
  });
}

async function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) return showWindow();
  if (!hostProcess && !(await checkHost())) startLanHost();
  await waitForHost();
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 860,
    minHeight: 600,
    title: '邻传',
    backgroundColor: '#f4f4f0',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  mainWindow.on('close', event => {
    if (app.isQuitting) return;
    event.preventDefault();
    hideWindow();
  });
  mainWindow.on('show', updateTrayMenu);
  mainWindow.on('hide', updateTrayMenu);
  createTray();
  await mainWindow.loadURL(`http://127.0.0.1:${PORT}/?desktop=1`);
}

app.whenReady().then(createWindow).catch(error => dialog.showErrorBox('启动失败', error.message));
app.on('activate', () => { if (mainWindow && !mainWindow.isDestroyed()) showWindow(); else createWindow(); });
app.on('window-all-closed', () => {});
app.on('before-quit', () => { app.isQuitting = true; setUnreadCount(0); hostProcess?.kill('SIGTERM'); });
