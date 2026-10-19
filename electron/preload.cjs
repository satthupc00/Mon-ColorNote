const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  bioAvailable: () => ipcRenderer.invoke('bio:available'),
  bioVerify: reason => ipcRenderer.invoke('bio:verify', reason),
  keySave: b64 => ipcRenderer.invoke('key:save', b64),
  keyLoad: () => ipcRenderer.invoke('key:load'),
  keyClear: () => ipcRenderer.invoke('key:clear'),
  version: () => ipcRenderer.invoke('app:version'),
  setTheme: t => ipcRenderer.invoke('app:theme', t),
  clipImage: () => ipcRenderer.invoke('clip:image'),
  readClipImage: url => ipcRenderer.invoke('clip:readImage', url),
  checkUpdate: () => ipcRenderer.invoke('upd:check'),
  downloadUpdate: () => ipcRenderer.invoke('upd:download'),
  installUpdate: () => ipcRenderer.invoke('upd:install'),
  onUpdate: cb => ipcRenderer.on('upd', (_e, d) => cb(d))
});
