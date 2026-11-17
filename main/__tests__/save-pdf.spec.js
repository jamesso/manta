vi.mock('electron', () => ({
  ipcMain: { on: vi.fn(), handle: vi.fn() },
  shell: { openPath: vi.fn(), showItemInFolder: vi.fn() },
  BrowserWindow: { fromId: vi.fn(), fromWebContents: vi.fn() },
}));

vi.mock('../settings', () => ({
  default: { get: vi.fn(), set: vi.fn() },
}));

vi.mock('../print-invoice-pdf', () => ({
  writeInvoicePdf: vi.fn(),
}));

vi.mock('../preview-pdf-coordinator', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, runPreviewPdfJob: vi.fn() };
});

import path from 'node:path';
import os from 'node:os';
import { BrowserWindow, ipcMain, shell } from 'electron';
import appConfig from '../settings';
import { runPreviewPdfJob } from '../preview-pdf-coordinator';
import { writeInvoicePdf } from '../print-invoice-pdf';

const EXPORT_DIR = path.join(os.tmpdir(), 'manta-save-pdf');

describe('save-pdf ipc handler', () => {
  let savePdf;
  let revealFile;
  let store;
  const mainWin = {
    id: 1,
    isDestroyed: () => false,
    webContents: { send: vi.fn() },
  };
  const trustedEvent = {
    sender: { mainFrame: 'frame', send: vi.fn() },
    senderFrame: 'frame',
  };
  const payload = {
    invoice: { _id: 'inv-1', docType: 'invoice', invoiceID: 'INV-1' },
    snapshot: {
      profile: { company: 'Co' },
      configs: { template: 'business' },
      language: 'en',
    },
    docType: 'invoice',
  };

  beforeAll(async () => {
    ipcMain.handle.mockImplementation((channel, fn) => {
      if (channel === 'save-pdf') savePdf = fn;
    });
    ipcMain.on.mockImplementation((channel, fn) => {
      if (channel === 'reveal-file') revealFile = fn;
    });
    await import('../save-pdf.js');
  });

  beforeEach(() => {
    store = {
      mainWindowID: 1,
      previewWindowID: 2,
      'invoice.exportDir': EXPORT_DIR,
      'onboarding.exportedPdf': false,
      'general.previewPDF': true,
    };
    appConfig.get.mockImplementation(key => store[key]);
    appConfig.set.mockImplementation((key, value) => {
      store[key] = value;
    });
    BrowserWindow.fromWebContents.mockReturnValue(mainWin);
    BrowserWindow.fromId.mockReturnValue(mainWin);
    runPreviewPdfJob.mockReset();
    shell.openPath.mockClear();
    shell.showItemInFolder.mockClear();
    mainWin.webContents.send.mockClear();
    trustedEvent.sender.send.mockClear();
  });

  it('registers save-pdf as an invoke handler', () => {
    expect(savePdf).toBeTypeOf('function');
    expect(ipcMain.on.mock.calls.map(c => c[0])).not.toContain('save-pdf');
  });

  it('rejects the hidden preview window', async () => {
    BrowserWindow.fromWebContents.mockReturnValueOnce({
      id: 2,
      isDestroyed: () => false,
    });
    const res = await savePdf(trustedEvent, payload);
    expect(res).toEqual({ ok: false, error: 'untrusted-sender' });
    expect(runPreviewPdfJob).not.toHaveBeenCalled();
  });

  it('rejects a sub-frame of the main window', async () => {
    const res = await savePdf(
      { sender: { mainFrame: 'frame' }, senderFrame: 'child' },
      payload
    );
    expect(res).toEqual({ ok: false, error: 'untrusted-sender' });
    expect(runPreviewPdfJob).not.toHaveBeenCalled();
  });

  it('rejects an invalid snapshot', async () => {
    const res = await savePdf(trustedEvent, {
      ...payload,
      snapshot: { language: 'xx' },
    });
    expect(res).toEqual({ ok: false, error: 'invalid-request' });
    expect(runPreviewPdfJob).not.toHaveBeenCalled();
  });

  it('prints the snapshot into the export dir and returns the path', async () => {
    runPreviewPdfJob.mockImplementation(async (_cfg, _write, params) =>
      Promise.resolve(params.pdfPath)
    );
    const res = await savePdf(trustedEvent, payload);
    expect(res.ok).toBe(true);
    expect(path.dirname(res.pdfPath)).toBe(EXPORT_DIR);
    expect(runPreviewPdfJob).toHaveBeenCalledWith(appConfig, writeInvoicePdf, {
      invoice: payload.invoice,
      snapshot: payload.snapshot,
      pdfPath: res.pdfPath,
      writeFlag: 'w',
    });
    expect(store['onboarding.exportedPdf']).toBe(true);
    expect(mainWin.webContents.send).toHaveBeenCalledWith(
      'onboarding-updated',
      { exportedPdf: true }
    );
    expect(shell.openPath).toHaveBeenCalledWith(res.pdfPath);
    expect(trustedEvent.sender.send).not.toHaveBeenCalled();
  });

  it('does not open the file when previewPDF is off', async () => {
    store['general.previewPDF'] = false;
    store['onboarding.exportedPdf'] = true;
    runPreviewPdfJob.mockResolvedValue('/x.pdf');
    const res = await savePdf(trustedEvent, payload);
    expect(res.ok).toBe(true);
    expect(shell.openPath).not.toHaveBeenCalled();
    expect(mainWin.webContents.send).not.toHaveBeenCalled();
  });

  it('returns the error message when the print fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    runPreviewPdfJob.mockRejectedValue(new Error('preview-timeout'));
    const res = await savePdf(trustedEvent, payload);
    expect(res).toEqual({ ok: false, error: 'preview-timeout' });
    spy.mockRestore();
  });

  it('reveals a file only for the main window main frame', () => {
    revealFile(trustedEvent, '/tmp/a.pdf');
    expect(shell.showItemInFolder).toHaveBeenCalledWith('/tmp/a.pdf');
    shell.showItemInFolder.mockClear();
    BrowserWindow.fromWebContents.mockReturnValueOnce({
      id: 2,
      isDestroyed: () => false,
    });
    revealFile(trustedEvent, '/tmp/a.pdf');
    revealFile(
      { sender: { mainFrame: 'frame' }, senderFrame: 'child' },
      '/tmp/a.pdf'
    );
    expect(shell.showItemInFolder).not.toHaveBeenCalled();
  });
});
