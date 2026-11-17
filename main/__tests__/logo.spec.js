vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  nativeImage: { createFromPath: vi.fn() },
  BrowserWindow: { fromWebContents: vi.fn() },
}));

vi.mock('../settings', () => ({
  default: { get: vi.fn(), set: vi.fn() },
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  stat: vi.fn(),
}));

import { BrowserWindow, ipcMain, nativeImage } from 'electron';
import { readFile, stat } from 'node:fs/promises';
import appConfig from '../settings';

const FILE = '/tmp/manta-plan-028-logo.svg';
const SVG = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
const MAX = 2 * 1024 * 1024;

describe('process-logo', () => {
  let processLogo;
  const mainWin = { id: 1, isDestroyed: () => false };
  const trustedEvent = {
    sender: { mainFrame: 'frame' },
    senderFrame: 'frame',
  };

  beforeAll(async () => {
    ipcMain.handle.mockImplementation((channel, fn) => {
      if (channel === 'process-logo') processLogo = fn;
    });
    await import('../logo.js');
  });

  beforeEach(() => {
    appConfig.get.mockImplementation(key => {
      if (key === 'mainWindowID') return 1;
      if (key === 'previewWindowID') return 2;
      return undefined;
    });
    BrowserWindow.fromWebContents.mockReturnValue(mainWin);
    readFile.mockReset();
    stat.mockReset();
    nativeImage.createFromPath.mockReset();
  });

  it('returns an svg data url for a trusted main frame and a small svg', async () => {
    stat.mockResolvedValue({ size: SVG.length, isFile: () => true });
    readFile.mockResolvedValue(Buffer.from(SVG));
    const res = await processLogo(trustedEvent, FILE);
    expect(res.dataUrl).toBe(
      'data:image/svg+xml;base64,' + Buffer.from(SVG).toString('base64')
    );
    expect(res.dataUrl.startsWith('data:image/svg+xml;base64,')).toBe(true);
  });

  it('rejects the preview window and does not read', async () => {
    BrowserWindow.fromWebContents.mockReturnValue({
      id: 2,
      isDestroyed: () => false,
    });
    const res = await processLogo(trustedEvent, FILE);
    expect(res).toEqual({ ok: false, error: 'untrusted-sender' });
    expect(readFile).not.toHaveBeenCalled();
  });

  it('rejects a sub-frame and does not read', async () => {
    const res = await processLogo(
      { sender: { mainFrame: 'frame' }, senderFrame: 'child' },
      FILE
    );
    expect(res).toEqual({ ok: false, error: 'untrusted-sender' });
    expect(readFile).not.toHaveBeenCalled();
  });

  it('rejects a file over 2 MiB and does not read', async () => {
    stat.mockResolvedValue({ size: MAX + 1, isFile: () => true });
    const res = await processLogo(trustedEvent, FILE);
    expect(res).toEqual({ error: 'too-large' });
    expect(readFile).not.toHaveBeenCalled();
  });

  it('returns unsupported when the raster image is empty', async () => {
    stat.mockResolvedValue({ size: 8, isFile: () => true });
    readFile.mockResolvedValue(Buffer.from('not-an-svg'));
    nativeImage.createFromPath.mockReturnValue({ isEmpty: () => true });
    const res = await processLogo(trustedEvent, FILE);
    expect(res).toEqual({ error: 'Unsupported image file' });
  });
});
