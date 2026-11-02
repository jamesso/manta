const { powerMonitor, BrowserWindow } = require('electron');
const appConfig = require('./settings');

powerMonitor.on('resume', () => {
  const win = BrowserWindow.fromId(appConfig.get('mainWindowID'));
  if (win && !win.isDestroyed()) {
    win.webContents.send('system-resumed');
  }
});
