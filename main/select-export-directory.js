// Node Libs
const fs = require('fs');

// Electron Libs
const ipc = require('electron').ipcMain;
const dialog = require('electron').dialog;
const BrowserWindow = require('electron').BrowserWindow;

ipc.on('select-export-directory', async event => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(window, {
    properties: ['openDirectory'],
  });
  if (canceled || !filePaths.length) return;
  const dir = filePaths[0];
  fs.access(dir, fs.constants.W_OK, err => {
    if (err) {
      event.sender.send('no-access-directory', err.message);
    } else {
      event.sender.send('confirmed-export-directory', dir);
    }
  });
});
