// Electron Libs
const ipc = require('electron').ipcMain;
const dialog = require('electron').dialog;
const { BrowserWindow } = require('electron');

ipc.on('open-file-dialog', async event => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(window, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'png', 'svg'] }],
  });
  if (!canceled && filePaths.length) event.sender.send('file-selected', filePaths[0]);
});
