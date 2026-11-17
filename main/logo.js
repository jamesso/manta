import { ipcMain, nativeImage } from 'electron';
import { readFile, stat } from 'node:fs/promises';

import isSvg from 'is-svg';
import { isMainWindowMainFrame } from './main-window-sender';

const MAX_BYTES = 2 * 1024 * 1024;

ipcMain.handle('process-logo', async (event, filePath) => {
  if (!isMainWindowMainFrame(event)) {
    return { ok: false, error: 'untrusted-sender' };
  }
  let info;
  try {
    info = await stat(filePath);
  } catch {
    return { error: 'not-a-file' };
  }
  if (!info.isFile()) {
    return { error: 'not-a-file' };
  }
  if (info.size > MAX_BYTES) {
    return { error: 'too-large' };
  }
  const data = await readFile(filePath);
  if (isSvg(data.toString('utf8'))) {
    return { dataUrl: 'data:image/svg+xml;base64,' + data.toString('base64') };
  }
  const image = nativeImage.createFromPath(filePath);
  if (image.isEmpty()) return { error: 'Unsupported image file' };
  return { dataUrl: image.resize({ width: 500 }).toDataURL() };
});
