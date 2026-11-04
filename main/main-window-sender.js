import { BrowserWindow } from 'electron';

import appConfig from './settings';

/**
 * True only when the IPC event comes from the main frame of the main window.
 * Sub-frames and other windows (also the hidden preview window) are
 * rejected.
 */
export function isMainWindowMainFrame(event) {
  if (!event || !event.sender) {
    return false;
  }
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) {
    return false;
  }
  if (event.senderFrame !== event.sender.mainFrame) {
    return false;
  }
  return win.id === appConfig.get('mainWindowID');
}

export function getMainWindow() {
  const win = BrowserWindow.fromId(appConfig.get('mainWindowID'));
  if (!win || win.isDestroyed()) {
    return null;
  }
  return win;
}
