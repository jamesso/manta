const path = require('path');
const { app } = require('electron');
const remoteMain = require('@electron/remote/main');

const PRELOAD_PATH = path.join(__dirname, '../preload/index.js');

// Compatibility settings until isolation is turned on.
const COMPAT_WEB_PREFERENCES = {
  preload: PRELOAD_PATH,
  nodeIntegration: true,
  contextIsolation: false,
  sandbox: false,
};

function enableRemote(win) {
  remoteMain.enable(win.webContents);
}

// Production MUST stay on file:// — PouchDB data is stored per origin.
function loadPage(win, name) {
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    return win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/${name}/index.html`);
  }
  return win.loadFile(path.join(__dirname, `../renderer/${name}/index.html`));
}

module.exports = { COMPAT_WEB_PREFERENCES, enableRemote, loadPage };
