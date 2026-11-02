const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const appConfig = require('./settings');

const {
  MAX_IMPORT_BYTES,
  backupFileName,
  autoBackupFileName,
  autoBackupsToPrune,
  serializeBackup,
  writeFileAtomic,
} = require('./backup-files');

function trustedSender(event) {
  const mainWindowID = appConfig.get('mainWindowID');
  const mainWindow = BrowserWindow.fromId(mainWindowID);
  if (!mainWindow) {
    return null;
  }
  return BrowserWindow.fromWebContents(event.sender) === mainWindow
    ? mainWindow
    : null;
}

ipcMain.handle('backup-export', async (event, payload) => {
  const win = trustedSender(event);
  if (!win || !payload || typeof payload !== 'object') {
    throw new Error('invalid request');
  }
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: path.join(
      app.getPath('documents'),
      backupFileName(new Date())
    ),
    filters: [{ name: 'Manta backup', extensions: ['json'] }],
  });
  if (canceled || !filePath) {
    return { canceled: true };
  }
  const text = serializeBackup(payload, app.getVersion(), new Date());
  await writeFileAtomic(filePath, text);
  return { canceled: false, filePath };
});

ipcMain.handle('backup-import', async event => {
  const win = trustedSender(event);
  if (!win) {
    throw new Error('invalid request');
  }
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'Manta backup', extensions: ['json'] }],
  });
  if (canceled || !filePaths?.length) {
    return { canceled: true };
  }
  const filePath = filePaths[0];
  const stat = await fs.promises.stat(filePath);
  if (stat.size > MAX_IMPORT_BYTES) {
    return { canceled: false, error: 'too-large' };
  }
  const text = await fs.promises.readFile(filePath, 'utf8');
  return { canceled: false, filePath, text };
});

ipcMain.handle('backup-snapshot', async (event, payload) => {
  const win = trustedSender(event);
  if (!win || !payload || typeof payload !== 'object') {
    throw new Error('invalid request');
  }
  const dir = path.join(app.getPath('userData'), 'backups');
  const filePath = path.join(dir, autoBackupFileName(new Date()));
  const text = serializeBackup(payload, app.getVersion(), new Date());
  await writeFileAtomic(filePath, text);
  let snapshotWarning = null;
  try {
    const names = await fs.promises.readdir(dir);
    const prune = autoBackupsToPrune(names);
    await Promise.all(
      prune.map(name => fs.promises.unlink(path.join(dir, name)))
    );
  } catch (err) {
    snapshotWarning = err.message;
  }
  return { filePath, snapshotWarning };
});

ipcMain.handle('csv-export', async (event, { text, defaultName }) => {
  const win = trustedSender(event);
  if (!win || typeof text !== 'string') {
    throw new Error('invalid request');
  }
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: path.join(
      app.getPath('documents'),
      path.basename(String(defaultName || 'manta-invoices.csv'))
    ),
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (canceled || !filePath) {
    return { canceled: true };
  }
  await writeFileAtomic(filePath, text);
  return { canceled: false, filePath };
});
