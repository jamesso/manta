import { BrowserWindow, ipcMain } from 'electron';

import { isMainWindowMainFrame } from './main-window-sender';
import store from './settings';

// Window ids come from the IPC sender. The renderer payload is not an id.
function canReadSettings(event) {
  if (!event || !event.sender) {
    return false;
  }
  if (event.senderFrame !== event.sender.mainFrame) {
    return false;
  }
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) {
    return false;
  }
  const id = win.id;
  return (
    id === store.get('mainWindowID') || id === store.get('previewWindowID')
  );
}

ipcMain.on('settings:get', (event, key) => {
  if (!canReadSettings(event)) {
    event.returnValue = undefined;
    return;
  }
  event.returnValue = store.get(key);
});

ipcMain.on('settings:has', (event, key) => {
  if (!canReadSettings(event)) {
    event.returnValue = false;
    return;
  }
  event.returnValue = store.has(key);
});

ipcMain.on('settings:set', (event, key, value) => {
  // app.js owns these ids. A renderer must not move the trust anchor.
  // electron-store treats an object key as a bulk write.
  if (
    typeof key !== 'string' ||
    key === 'mainWindowID' ||
    key === 'previewWindowID' ||
    !isMainWindowMainFrame(event)
  ) {
    event.returnValue = false;
    return;
  }
  store.set(key, value);
  event.returnValue = true;
});
