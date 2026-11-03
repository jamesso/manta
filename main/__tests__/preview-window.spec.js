import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  __resetForTests,
  __setElectronForTests,
  activeRequestId,
  allocatePdfPath,
  consumePreviewToken,
  createPreviewToken,
  getPreviewWindow,
  enqueueJob,
  runDirectPreviewPdfJob,
  runPreviewPdfJob,
  waitForPreviewRendered,
  writePdfWithWx,
} from '../preview-pdf-coordinator';
import { buildMailto } from '../../helpers/email';

const ipcMain = {
  on: vi.fn(),
  removeListener: vi.fn(),
};
const BrowserWindow = {
  fromId: vi.fn(),
};

function makePreviewWindow() {
  const webContents = {
    send: vi.fn(),
    mainFrame: 'main-frame',
    executeJavaScript: vi.fn().mockResolvedValue(undefined),
    isDestroyed: () => false,
  };
  return {
    isDestroyed: () => false,
    isVisible: () => false,
    hide: vi.fn(),
    webContents,
  };
}

function latestPreviewRenderedHandler() {
  const calls = ipcMain.on.mock.calls.filter(c => c[0] === 'preview-rendered');
  return calls.at(-1)?.[1];
}

async function ackPreviewRender(win, invoiceId) {
  await vi.waitFor(() =>
    win.webContents.send.mock.calls.some(
      c => c[0] === 'update-preview' && c[1]?.requestId
    )
  );
  await new Promise(resolve => {
    setTimeout(resolve, 0);
  });
  await vi.waitFor(() =>
    ipcMain.on.mock.calls.some(c => c[0] === 'preview-rendered')
  );
  const updateCall = [...win.webContents.send.mock.calls]
    .reverse()
    .find(c => c[0] === 'update-preview' && c[1]?.requestId);
  latestPreviewRenderedHandler()(
    { sender: win.webContents, senderFrame: win.webContents.mainFrame },
    {
      requestId: updateCall[1].requestId,
      invoiceId: String(invoiceId),
    }
  );
}

describe('preview pdf coordinator queue', () => {
  beforeEach(() => {
    __resetForTests();
    ipcMain.on.mockClear();
    ipcMain.removeListener.mockClear();
    BrowserWindow.fromId.mockReset();
    __setElectronForTests({ ipcMain, BrowserWindow });
  });

  it('runs jobs one after another', async () => {
    const order = [];
    await Promise.all([
      enqueueJob(async () => {
        order.push('first-start');
        await new Promise(r => setTimeout(r, 5));
        order.push('first-end');
      }),
      enqueueJob(async () => {
        order.push('second');
      }),
    ]);
    expect(order).toEqual(['first-start', 'first-end', 'second']);
  });

  it('snapshot job sends update-preview after sync freeze', async () => {
    const win = makePreviewWindow();
    BrowserWindow.fromId.mockReturnValue(win);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manta-x-'));
    const appConfig = {
      get: key =>
        key === 'previewWindowID'
          ? 1
          : key === 'invoice.exportDir'
            ? dir
            : undefined,
    };
    const writeInvoicePdf = vi.fn(async (w, pdfPath, { flag }) => {
      fs.writeFileSync(pdfPath, 'x', { flag });
    });
    const job = runPreviewPdfJob(appConfig, writeInvoicePdf, {
      invoice: { _id: 'inv-z' },
      snapshot: { profile: {}, configs: {}, language: 'en' },
      pdfPath: path.join(dir, 'z.pdf'),
    });
    await vi.waitFor(
      () =>
        win.webContents.send.mock.calls.some(c => c[0] === 'update-preview'),
      { timeout: 1000 }
    );
    expect(win.webContents.executeJavaScript).toHaveBeenCalledWith(
      'window.__mantaExportFrozen = true;',
      true
    );
    await ackPreviewRender(win, 'inv-z');
    await job;
  });

  it('prints each queued invoice with its own render ack', async () => {
    const win = makePreviewWindow();
    BrowserWindow.fromId.mockReturnValue(win);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manta-pdf-'));
    const appConfig = {
      get: key => {
        if (key === 'previewWindowID') {
          return 1;
        }
        if (key === 'invoice.exportDir') {
          return dir;
        }
        return undefined;
      },
    };
    expect(getPreviewWindow(appConfig)).toBe(win);
    const seen = [];
    const writeInvoicePdf = vi.fn(async (w, pdfPath, { flag }) => {
      const update = w.webContents.send.mock.calls
        .filter(c => c[0] === 'update-preview')
        .at(-1);
      seen.push(update[1].invoice._id);
      fs.writeFileSync(pdfPath, `pdf-${update[1].invoice._id}`, { flag });
      return pdfPath;
    });

    const jobA = runPreviewPdfJob(appConfig, writeInvoicePdf, {
      invoice: { _id: 'inv-a' },
      snapshot: { profile: {}, configs: {}, language: 'en' },
      pdfPath: path.join(dir, 'a.pdf'),
    });
    await ackPreviewRender(win, 'inv-a');
    await jobA;

    const jobB = runPreviewPdfJob(appConfig, writeInvoicePdf, {
      invoice: { _id: 'inv-b' },
      snapshot: { profile: {}, configs: {}, language: 'en' },
      pdfPath: path.join(dir, 'b.pdf'),
    });
    await ackPreviewRender(win, 'inv-b');
    await jobB;

    expect(seen).toEqual(['inv-a', 'inv-b']);
    expect(fs.readFileSync(path.join(dir, 'a.pdf'), 'utf8')).toBe('pdf-inv-a');
    expect(fs.readFileSync(path.join(dir, 'b.pdf'), 'utf8')).toBe('pdf-inv-b');
  });

  it('ignores a stale preview-rendered ack for the same invoice id', async () => {
    const win = makePreviewWindow();
    const pending = waitForPreviewRendered(win, 'job-2', 'inv-1');
    const handler = latestPreviewRenderedHandler();
    expect(handler).toBeTypeOf('function');
    handler(
      { sender: win.webContents, senderFrame: win.webContents.mainFrame },
      { requestId: 'job-1', invoiceId: 'inv-1' }
    );
    handler(
      { sender: win.webContents, senderFrame: win.webContents.mainFrame },
      { requestId: 'job-2', invoiceId: 'inv-1' }
    );
    await pending;
  });

  it('releases the queue after preview render timeout', async () => {
    vi.useFakeTimers();
    try {
      const win = makePreviewWindow();
      BrowserWindow.fromId.mockReturnValue(win);
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manta-pdf-'));
      const appConfig = {
        get: key =>
          key === 'previewWindowID'
            ? 1
            : key === 'invoice.exportDir'
              ? dir
              : undefined,
      };
      const writeInvoicePdf = vi.fn();
      const failed = runPreviewPdfJob(appConfig, writeInvoicePdf, {
        invoice: { _id: 'inv-1' },
        snapshot: { profile: {}, configs: {}, language: 'en' },
        pdfPath: path.join(dir, 'x.pdf'),
      });
      const rejection = expect(failed).rejects.toThrow('preview-timeout');
      await vi.advanceTimersByTimeAsync(10_001);
      await rejection;
      expect(activeRequestId()).toBeNull();
      expect(writeInvoicePdf).not.toHaveBeenCalled();

      vi.useRealTimers();

      const writeOk = vi.fn(async (w, pdfPath, { flag }) => {
        fs.writeFileSync(pdfPath, 'ok', { flag });
      });
      const win2 = makePreviewWindow();
      BrowserWindow.fromId.mockReturnValue(win2);
      const ok = runPreviewPdfJob(appConfig, writeOk, {
        invoice: { _id: 'inv-2' },
        snapshot: { profile: {}, configs: {}, language: 'en' },
        pdfPath: path.join(dir, 'y.pdf'),
      });
      await ackPreviewRender(win2, 'inv-2');
      await ok;
      expect(writeOk).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('releases the queue when the preview window is destroyed', async () => {
    const win = { isDestroyed: () => true };
    BrowserWindow.fromId.mockReturnValue(win);
    const appConfig = { get: () => 1 };
    await expect(
      runPreviewPdfJob(appConfig, vi.fn(), {
        invoice: { _id: 'x' },
        snapshot: { profile: {}, configs: {}, language: 'en' },
        pdfPath: '/tmp/x.pdf',
      })
    ).rejects.toThrow('preview-unavailable');
    expect(activeRequestId()).toBeNull();
  });

  it('frees the queue when wx write fails', async () => {
    const win = makePreviewWindow();
    BrowserWindow.fromId.mockReturnValue(win);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manta-pdf-'));
    const appConfig = {
      get: key =>
        key === 'previewWindowID'
          ? 1
          : key === 'invoice.exportDir'
            ? dir
            : undefined,
    };
    const writeInvoicePdf = vi.fn(async () => {
      const err = new Error('disk');
      err.code = 'EIO';
      throw err;
    });
    const job = runPreviewPdfJob(appConfig, writeInvoicePdf, {
      invoice: { _id: 'inv-1' },
      snapshot: { profile: {}, configs: {}, language: 'en' },
      pdfPath: path.join(dir, 'z.pdf'),
    });
    await ackPreviewRender(win, 'inv-1');
    await expect(job).rejects.toThrow('disk');
    expect(activeRequestId()).toBeNull();
  });

  it('blocks ordinary preview updates while export freeze is active', () => {
    const exportFrozenRef = true;
    const mantaExportFrozenCount = 1;
    const blocked = () => exportFrozenRef || mantaExportFrozenCount > 0;
    const normalUpdate = { invoice: { _id: 'x' } };
    expect(normalUpdate.requestId).toBeUndefined();
    expect(blocked()).toBe(true);
  });

  it('consumes a preview token only once', () => {
    const token = createPreviewToken({
      invoiceId: 'inv-1',
      invoice: { _id: 'inv-1' },
      snapshot: { profile: {}, configs: {}, language: 'en' },
    });
    expect(consumePreviewToken(token, 'inv-1')?.snapshot).toBeDefined();
    expect(consumePreviewToken(token, 'inv-1')).toBeNull();
  });

  it('rejects expired preview tokens', () => {
    vi.useFakeTimers();
    const token = createPreviewToken({
      invoiceId: 'inv-1',
      invoice: { _id: 'inv-1' },
      snapshot: { profile: {}, configs: {}, language: 'en' },
    });
    vi.advanceTimersByTime(5 * 60_000 + 1);
    expect(consumePreviewToken(token, 'inv-1')).toBeNull();
    vi.useRealTimers();
  });

  it('rejects token when invoice id mismatches', () => {
    const token = createPreviewToken({
      invoiceId: 'inv-1',
      invoice: { _id: 'inv-1' },
      snapshot: { profile: {}, configs: {}, language: 'en' },
    });
    expect(consumePreviewToken(token, 'other')).toBeNull();
  });

  it('keeps original bytes when allocating another path', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manta-pdf-'));
    const original = path.join(dir, 'INV-1.pdf');
    fs.writeFileSync(original, 'ORIGINAL');
    const next = allocatePdfPath(dir, 'INV-1.pdf');
    expect(next).not.toBe(original);
    expect(fs.readFileSync(original, 'utf8')).toBe('ORIGINAL');
  });

  it('uses the next suffix on EEXIST instead of overwriting', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manta-pdf-'));
    const target = path.join(dir, 'doc.pdf');
    fs.writeFileSync(target, 'ORIGINAL');
    const win = makePreviewWindow();
    let calls = 0;
    const writeInvoicePdf = vi.fn(async (_w, pdfPath, { flag }) => {
      calls += 1;
      if (calls === 1) {
        const err = new Error('exists');
        err.code = 'EEXIST';
        throw err;
      }
      fs.writeFileSync(pdfPath, 'NEW', { flag });
    });
    const written = await writePdfWithWx(win, target, writeInvoicePdf);
    expect(written).not.toBe(target);
    expect(fs.readFileSync(target, 'utf8')).toBe('ORIGINAL');
    expect(fs.readFileSync(written, 'utf8')).toBe('NEW');
  });

  it('keeps export pdf bytes for the captured invoice after another invoice rendered', async () => {
    const win = makePreviewWindow();
    BrowserWindow.fromId.mockReturnValue(win);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manta-pdf-'));
    const appConfig = {
      get: key =>
        key === 'previewWindowID'
          ? 1
          : key === 'invoice.exportDir'
            ? dir
            : undefined,
    };
    const snap = { profile: {}, configs: {}, language: 'en' };
    const writeInvoicePdf = vi.fn(async (w, pdfPath, { flag }) => {
      const update = w.webContents.send.mock.calls
        .filter(c => c[0] === 'update-preview')
        .at(-1);
      fs.writeFileSync(pdfPath, `pdf-${update[1].invoice._id}`, { flag });
    });
    const pathA = path.join(dir, 'doc-a.pdf');
    const pathB = path.join(dir, 'doc-b.pdf');

    const jobB = runPreviewPdfJob(appConfig, writeInvoicePdf, {
      invoice: { _id: 'inv-b' },
      snapshot: snap,
      pdfPath: pathB,
    });
    await ackPreviewRender(win, 'inv-b');
    await jobB;

    const jobA = runPreviewPdfJob(appConfig, writeInvoicePdf, {
      invoice: { _id: 'inv-a' },
      snapshot: snap,
      pdfPath: pathA,
      writeFlag: 'w',
    });
    await ackPreviewRender(win, 'inv-a');
    await jobA;

    expect(fs.readFileSync(pathA, 'utf8')).toBe('pdf-inv-a');
    expect(fs.readFileSync(pathB, 'utf8')).toBe('pdf-inv-b');
  });

  it('save-pdf path overwrites with flag w via direct job', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manta-pdf-'));
    const target = path.join(dir, 'doc.pdf');
    fs.writeFileSync(target, 'OLD');
    const win = makePreviewWindow();
    const writeInvoicePdf = vi.fn(async (_w, pdfPath, { flag }) => {
      fs.writeFileSync(pdfPath, 'SAVED', { flag });
    });
    await runDirectPreviewPdfJob(win, target, writeInvoicePdf, { flag: 'w' });
    expect(fs.readFileSync(target, 'utf8')).toBe('SAVED');
  });

  it('sets sync export freeze before direct print and clears after', async () => {
    const win = makePreviewWindow();
    const order = [];
    win.webContents.executeJavaScript.mockImplementation(async code => {
      order.push(code.includes('true') ? 'freeze-on' : 'freeze-off');
    });
    const writeInvoicePdf = vi.fn(async () => {
      order.push('print');
    });
    await runDirectPreviewPdfJob(win, '/tmp/out.pdf', writeInvoicePdf);
    expect(order).toEqual(['freeze-on', 'print', 'freeze-off']);
  });

  it('sets sync export freeze before update-preview on snapshot jobs', async () => {
    const win = makePreviewWindow();
    BrowserWindow.fromId.mockReturnValue(win);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manta-pdf-'));
    const appConfig = {
      get: key =>
        key === 'previewWindowID'
          ? 1
          : key === 'invoice.exportDir'
            ? dir
            : undefined,
    };
    const order = [];
    win.webContents.executeJavaScript.mockImplementation(async code => {
      order.push(code.includes('true') ? 'freeze-on' : 'freeze-off');
    });
    const sendMock = win.webContents.send;
    sendMock.mockImplementation((channel, ...args) => {
      if (channel === 'update-preview') {
        order.push('update-preview');
      }
    });
    const writeInvoicePdf = vi.fn(async (w, pdfPath, { flag }) => {
      fs.writeFileSync(pdfPath, 'pdf', { flag });
    });
    const job = runPreviewPdfJob(appConfig, writeInvoicePdf, {
      invoice: { _id: 'inv-1' },
      snapshot: { profile: {}, configs: {}, language: 'en' },
      pdfPath: path.join(dir, 'one.pdf'),
    });
    await ackPreviewRender(win, 'inv-1');
    await job;
    expect(order.indexOf('freeze-on')).toBeLessThan(
      order.indexOf('update-preview')
    );
    expect(order.at(-1)).toBe('freeze-off');
  });
});

describe('mailto truncation contract', () => {
  it('marks truncated and stays within 1800 characters', () => {
    const subject = 'S'.repeat(300);
    const body = 'B'.repeat(5000);
    const { url, truncated } = buildMailto({
      to: 'user@example.com',
      subject,
      body,
    });
    expect(truncated).toBe(true);
    expect(url.length).toBeLessThanOrEqual(1800);
    expect(() => decodeURIComponent(url.split('body=')[1] ?? '')).not.toThrow();
    const fullMessage = `${subject}\n\n${body}`;
    expect(fullMessage.length).toBeGreaterThan(url.length);
  });

  it('throws when the URL cannot fit at all', () => {
    expect(() =>
      buildMailto(
        {
          to: 'user@example.com',
          subject: 'Subject',
          body: 'Body',
        },
        { maxLength: 20 }
      )
    ).toThrow(/mailto-too-long|too-long-recipient/);
  });
});
