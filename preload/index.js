const { contextBridge, ipcRenderer, webUtils } = require('electron');

const CHANNELS = new Set([
  'change-preview-window-language',
  'change-preview-window-profile',
  'check-for-updates',
  'confirmed-delete-contact',
  'confirmed-delete-invoice',
  'confirmed-export-directory',
  'end-tour',
  'file-selected',
  'menu-change-tab',
  'menu-form-add-item',
  'menu-form-clear',
  'menu-form-save',
  'menu-form-toggle-currency',
  'menu-form-toggle-discount',
  'menu-form-toggle-dueDate',
  'menu-form-toggle-note',
  'menu-form-toggle-settings',
  'menu-form-toggle-vat',
  'modal-response',
  'no-access-directory',
  'open-file-dialog',
  'pfd-exported',
  'preview-invoice',
  'quit-and-install',
  'quit-app',
  'reveal-file',
  'save-configs-to-invoice',
  'save-pdf',
  'select-export-directory',
  'show-modal',
  'start-tour',
  'update-available',
  'update-checking',
  'update-download-confirmed',
  'update-download-progress',
  'update-download-started',
  'update-downloaded',
  'update-error',
  'update-modal',
  'update-not-available',
  'update-preview',
  'update-preview-window',
  'upgade-confirmed',
  'upgrade-confirmed',
]);

const check = channel => {
  if (!CHANNELS.has(channel)) throw new Error(`Blocked IPC channel: ${channel}`);
};

const ipc = {
  send: (channel, ...args) => {
    check(channel);
    ipcRenderer.send(channel, ...args);
  },
  on: (channel, listener) => {
    check(channel);
    ipcRenderer.on(channel, (_event, ...args) => listener({}, ...args));
  },
  removeAllListeners: channels => {
    [].concat(channels).forEach(c => {
      check(c);
      ipcRenderer.removeAllListeners(c);
    });
  },
};

const api = {
  ipc,
  settings: {
    get: key => ipcRenderer.sendSync('settings:get', key),
    has: key => ipcRenderer.sendSync('settings:has', key),
    set: (key, value) => ipcRenderer.sendSync('settings:set', key, value),
  },
  processLogo: filePath => ipcRenderer.invoke('process-logo', filePath),
  getPathForFile: file => webUtils.getPathForFile(file),
  platform: process.platform,
};

if (process.contextIsolated) contextBridge.exposeInMainWorld('manta', api);
else window.manta = api;
