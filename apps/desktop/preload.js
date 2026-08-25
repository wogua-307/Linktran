const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('linktranDesktop', Object.freeze({
  platform: process.platform,
  desktop: true,
  getVersion: () => ipcRenderer.invoke('linktran:get-version'),
  getHostInstanceId: () => ipcRenderer.invoke('linktran:get-host-instance-id'),
  setUnreadCount: count => ipcRenderer.invoke('linktran:set-unread-count', count),
  notify: payload => ipcRenderer.invoke('linktran:notify', payload),
  onNotificationClick: callback => {
    const listener = (_event, chatId) => callback(chatId);
    ipcRenderer.on('linktran:notification-click', listener);
    return () => ipcRenderer.removeListener('linktran:notification-click', listener);
  },
  checkForUpdate: () => ipcRenderer.invoke('linktran:check-update'),
  openRelease: url => ipcRenderer.invoke('linktran:open-release', url)
}));
