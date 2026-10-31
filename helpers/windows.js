const path = require('path');
const { app } = require('electron');

const PRELOAD_PATH = path.join(__dirname, '../preload/index.js');

const SECURE_WEB_PREFERENCES = {
  preload: PRELOAD_PATH,
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
};

// Production MUST stay on file:// — PouchDB data is stored per origin.
function loadPage(win, name) {
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    return win.loadURL(
      `${process.env.ELECTRON_RENDERER_URL}/${name}/index.html`
    );
  }
  return win.loadFile(path.join(__dirname, `../renderer/${name}/index.html`));
}

module.exports = { SECURE_WEB_PREFERENCES, loadPage };
