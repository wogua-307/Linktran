const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('linktranDesktop', Object.freeze({
  platform: process.platform,
  desktop: true,
  getVersion: () => ipcRenderer.invoke('linktran:get-version'),
  checkForUpdate: () => ipcRenderer.invoke('linktran:check-update'),
  openRelease: url => ipcRenderer.invoke('linktran:open-release', url)
}));
