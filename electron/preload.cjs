const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
  togglePin: () => ipcRenderer.invoke('window-toggle-pin'),
  getPinState: () => ipcRenderer.invoke('window-get-pin'),
  getLaunchParams: () => ipcRenderer.invoke('get-launch-params'),
  selectActiveFile: () => ipcRenderer.invoke('dialog-select-file'),
  onProjectContextChange: (callback) => {
    ipcRenderer.on('set-project-context', (_event, data) => callback(data));
  },
});
