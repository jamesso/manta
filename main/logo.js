const { ipcMain, nativeImage } = require('electron');
const fs = require('fs');
const isSvg = require('is-svg');

ipcMain.handle('process-logo', async (_event, filePath) => {
  const data = await fs.promises.readFile(filePath);
  if (isSvg(data.toString('utf8'))) {
    return { dataUrl: 'data:image/svg+xml;base64,' + data.toString('base64') };
  }
  const image = nativeImage.createFromPath(filePath);
  if (image.isEmpty()) return { error: 'Unsupported image file' };
  return { dataUrl: image.resize({ width: 500 }).toDataURL() };
});
