// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

vi.mock('electron', () => ({
  ipcMain: { on: vi.fn(), handle: vi.fn() },
  dialog: { showSaveDialog: vi.fn() },
  shell: { openPath: vi.fn() },
  BrowserWindow: { fromId: vi.fn(), fromWebContents: vi.fn() },
}));

vi.mock('../settings', () => ({
  default: { get: vi.fn() },
}));

vi.mock('../preview-pdf-coordinator', () => ({
  renderPreviewPdfBuffer: vi.fn(),
}));

const generate = vi.fn();
vi.mock('@e-invoice-eu/core', () => ({
  InvoiceService: vi.fn(function InvoiceService() {
    this.generate = generate;
  }),
}));

import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import appConfig from '../settings';
import { renderPreviewPdfBuffer } from '../preview-pdf-coordinator';

const readFixture = name =>
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../../e2e/fixtures/einvoice', name),
      'utf8'
    )
  );
const fixture = readFixture('standard-de.json');
const b2g = readFixture('xrechnung-b2g.json');

describe('einvoice-export ipc handler', () => {
  let exportHandler;
  let store;
  let outDir;
  const mainWin = { id: 1, isDestroyed: () => false };
  const trustedEvent = {
    sender: { mainFrame: 'frame' },
    senderFrame: 'frame',
  };
  const snapshot = {
    profile: { company: 'Stale renderer profile' },
    configs: { ...fixture.invoice.configs, template: 'business' },
    language: 'en',
  };
  const payload = kind => ({
    kind,
    invoice: fixture.invoice,
    derived: fixture.derived,
    snapshot,
  });

  beforeAll(async () => {
    ipcMain.handle.mockImplementation((channel, fn) => {
      if (channel === 'einvoice-export') exportHandler = fn;
    });
    await import('../einvoice.js');
  });

  beforeEach(() => {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manta-einvoice-'));
    store = {
      mainWindowID: 1,
      previewWindowID: 2,
      profile: fixture.settings.profile,
      invoice: {
        ...fixture.settings.invoice,
        exportDir: outDir,
        eInvoice: { enabled: true, format: 'facturx-en16931' },
      },
      'general.previewPDF': false,
      'general.printOptions': undefined,
    };
    appConfig.get.mockImplementation(key => store[key]);
    BrowserWindow.fromWebContents.mockReturnValue(mainWin);
    BrowserWindow.fromId.mockReturnValue(mainWin);
    renderPreviewPdfBuffer.mockReset();
    generate.mockReset();
    dialog.showSaveDialog.mockReset();
    shell.openPath.mockClear();
  });

  it('rejects the hidden preview window', async () => {
    BrowserWindow.fromWebContents.mockReturnValueOnce({
      id: 2,
      isDestroyed: () => false,
    });
    const res = await exportHandler(trustedEvent, payload('facturx'));
    expect(res).toEqual({ ok: false, error: 'untrusted-sender' });
    expect(renderPreviewPdfBuffer).not.toHaveBeenCalled();
  });

  it('rejects a sub-frame of the main window', async () => {
    const res = await exportHandler(
      { sender: { mainFrame: 'frame' }, senderFrame: 'child' },
      payload('facturx')
    );
    expect(res).toEqual({ ok: false, error: 'untrusted-sender' });
  });

  it('rejects a Factur-X request without a valid snapshot', async () => {
    const res = await exportHandler(trustedEvent, {
      ...payload('facturx'),
      snapshot: { profile: {}, configs: {}, language: 'xx' },
    });
    expect(res).toEqual({ ok: false, error: 'invalid-request' });
    expect(renderPreviewPdfBuffer).not.toHaveBeenCalled();
  });

  it('renders the Factur-X PDF in the hidden window and saves it', async () => {
    const target = path.join(outDir, 'out.pdf');
    renderPreviewPdfBuffer.mockResolvedValue(Buffer.from('%PDF-1.7 base'));
    generate.mockResolvedValue(new TextEncoder().encode('%PDF-1.7 facturx'));
    dialog.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: target,
    });
    const res = await exportHandler(trustedEvent, payload('facturx'));
    expect(res.ok, res.error ?? JSON.stringify(res.issues)).toBe(true);
    expect(res.path).toBe(target);
    expect(fs.readFileSync(target, 'utf8')).toBe('%PDF-1.7 facturx');

    const [, job, options] = renderPreviewPdfBuffer.mock.calls[0];
    expect(job.invoice).toBe(fixture.invoice);
    expect(job.snapshot).toEqual({
      ...snapshot,
      profile: fixture.settings.profile,
    });
    expect(options).toMatchObject({ preferCSSPageSize: true });
    expect(generate.mock.calls[0][1].pdf.buffer.toString()).toBe(
      '%PDF-1.7 base'
    );
    expect(dialog.showSaveDialog.mock.calls[0][0]).toBe(mainWin);
  });

  it('returns canceled when the save dialog is canceled', async () => {
    renderPreviewPdfBuffer.mockResolvedValue(Buffer.from('%PDF'));
    generate.mockResolvedValue(new Uint8Array([1]));
    dialog.showSaveDialog.mockResolvedValue({ canceled: true });
    const res = await exportHandler(trustedEvent, payload('facturx'));
    expect(res).toEqual({ ok: false, canceled: true });
  });

  it('returns the render error', async () => {
    renderPreviewPdfBuffer.mockRejectedValue(new Error('preview-timeout'));
    const res = await exportHandler(trustedEvent, payload('facturx'));
    expect(res).toEqual({ ok: false, error: 'preview-timeout' });
    expect(dialog.showSaveDialog).not.toHaveBeenCalled();
  });

  it('writes XRechnung XML without the preview window', async () => {
    const target = path.join(outDir, 'out.xml');
    store.profile = b2g.settings.profile;
    store.invoice = {
      ...b2g.settings.invoice,
      exportDir: outDir,
      eInvoice: { enabled: true, format: 'xrechnung-ubl' },
    };
    generate.mockResolvedValue('<Invoice/>');
    dialog.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: target,
    });
    const res = await exportHandler(trustedEvent, {
      kind: 'xrechnung',
      invoice: b2g.invoice,
      derived: b2g.derived,
    });
    expect(res.ok, res.error ?? JSON.stringify(res.issues)).toBe(true);
    expect(fs.readFileSync(target, 'utf8')).toBe('<Invoice/>');
    expect(renderPreviewPdfBuffer).not.toHaveBeenCalled();
    expect(dialog.showSaveDialog.mock.calls[0][0]).toBe(mainWin);
  });
});
