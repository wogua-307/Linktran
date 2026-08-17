const { app, BrowserWindow, dialog, shell } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const http = require('node:http');

const PORT = 9527;
let hostProcess;

function hostRoot() {
  return app.isPackaged ? path.join(process.resourcesPath, 'lan-host') : path.resolve(__dirname, '../..');
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
      UPLOADS_DIR: path.join(app.getPath('userData'), 'uploads')
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
  if (!hostProcess && !(await checkHost())) startLanHost();
  await waitForHost();
  const window = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 860,
    minHeight: 600,
    title: '邻传',
    backgroundColor: '#f4f4f0',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true }
  });
  window.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  await window.loadURL(`http://127.0.0.1:${PORT}/?desktop=1`);
}

app.whenReady().then(createWindow).catch(error => dialog.showErrorBox('启动失败', error.message));
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { app.isQuitting = true; hostProcess?.kill('SIGTERM'); });
