const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('linktranDesktop', Object.freeze({ platform: process.platform, desktop: true }));
