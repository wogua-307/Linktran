const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('linktranDesktop', Object.freeze({
  platform: process.platform,
  desktop: true,
  getVersion: () => ipcRenderer.invoke('linktran:get-version'),
  getHostInstanceId: () => ipcRenderer.invoke('linktran:get-host-instance-id'),
  checkForUpdate: () => ipcRenderer.invoke('linktran:check-update'),
  openRelease: url => ipcRenderer.invoke('linktran:open-release', url)
}));
