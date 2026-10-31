const { ipcMain } = require('electron');
const store = require('./settings');

ipcMain.on('settings:get', (event, key) => {
  event.returnValue = store.get(key);
});

ipcMain.on('settings:has', (event, key) => {
  event.returnValue = store.has(key);
});

ipcMain.on('settings:set', (event, key, value) => {
  store.set(key, value);
  event.returnValue = true;
});
