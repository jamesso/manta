const { BrowserWindow, ipcMain } = require('electron');
const centerOnPrimaryDisplay = require('../helpers/center-on-primary-display');
const { SECURE_WEB_PREFERENCES, loadPage } = require('../helpers/windows');
const store = require('./settings');

ipcMain.on('show-modal', (event, dialogOptions, returnChannel = '', ...rest) => {
  const width = 450;
  const height = 220;
  const winPOS = centerOnPrimaryDisplay(width, height);
  const modalWin = new BrowserWindow({
    x: Math.round(winPOS.x),
    y: Math.round(winPOS.y),
    width,
    height,
    backgroundColor: '#282828',
    frame: false,
    show: false,
    webPreferences: SECURE_WEB_PREFERENCES,
  });
  loadPage(modalWin, 'modal');
  modalWin.webContents.on('did-finish-load', () => {
    modalWin.webContents.send('update-modal', dialogOptions, returnChannel, ...rest);
  });
  modalWin.on('ready-to-show', () => {
    modalWin.show();
    modalWin.focus();
  });
});

ipcMain.on('modal-response', (event, returnChannel, index, ...rest) => {
  if (returnChannel) {
    const mainWindow = BrowserWindow.fromId(store.get('mainWindowID'));
    mainWindow.webContents.send(returnChannel, index, ...rest);
  }
  BrowserWindow.fromWebContents(event.sender).close();
});
