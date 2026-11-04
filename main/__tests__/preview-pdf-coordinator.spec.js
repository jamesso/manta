import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  __resetForTests,
  __setElectronForTests,
  activeRequestId,
  allocatePdfPath,
  enqueueJob,
  getPreviewWindow,
  registerPreviewCoordinatorIpc,
  renderPreviewPdfBuffer,
  runPreviewPdfJob,
  waitForPreviewRendered,
  writePdfWithWx,
} from '../preview-pdf-coordinator';

const ipcMain = {
  on: vi.fn(),
  removeListener: vi.fn(),
};
const BrowserWindow = {
  fromId: vi.fn(),
};

const SNAPSHOT = { profile: {}, configs: {}, language: 'en' };

function makePreviewWindow() {
  const webContents = {
    send: vi.fn(),
    mainFrame: 'main-frame',
    printToPDF: vi.fn(async () => Buffer.from('%PDF-1.4')),
    isDestroyed: () => false,
  };
  return {
    isDestroyed: () => false,
    isVisible: () => false,
    show: vi.fn(),
    hide: vi.fn(),
    webContents,
  };
}

function makeAppConfig(dir) {
  return {
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

describe('preview pdf coordinator', () => {
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

  it('sends the snapshot with a requestId and exposes it as active', async () => {
    const win = makePreviewWindow();
    BrowserWindow.fromId.mockReturnValue(win);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manta-pdf-'));
    let activeDuringWrite = null;
    const writeInvoicePdf = vi.fn(async (w, pdfPath, { flag }) => {
      activeDuringWrite = activeRequestId();
      fs.writeFileSync(pdfPath, 'x', { flag });
    });
    const snapshot = {
      profile: { company: 'Co' },
      configs: { template: 'business' },
      language: 'fr',
    };
    const job = runPreviewPdfJob(makeAppConfig(dir), writeInvoicePdf, {
      invoice: { _id: 'inv-z' },
      snapshot,
      pdfPath: path.join(dir, 'z.pdf'),
    });
    await ackPreviewRender(win, 'inv-z');
    await job;
    const update = win.webContents.send.mock.calls.find(
      c => c[0] === 'update-preview'
    )[1];
    expect(update).toEqual({
      requestId: expect.any(String),
      invoice: { _id: 'inv-z' },
      profile: snapshot.profile,
      configs: snapshot.configs,
      language: 'fr',
    });
    expect(activeDuringWrite).toBe(update.requestId);
    expect(activeRequestId()).toBeNull();
    expect(win.show).not.toHaveBeenCalled();
  });

  it('answers preview-active-request-id synchronously', () => {
    registerPreviewCoordinatorIpc();
    const handler = ipcMain.on.mock.calls.find(
      c => c[0] === 'preview-active-request-id'
    )[1];
    const event = {};
    handler(event);
    expect(event.returnValue).toBeNull();
  });

  it('prints each queued invoice with its own render ack', async () => {
    const win = makePreviewWindow();
    BrowserWindow.fromId.mockReturnValue(win);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manta-pdf-'));
    const appConfig = makeAppConfig(dir);
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
      snapshot: SNAPSHOT,
      pdfPath: path.join(dir, 'a.pdf'),
    });
    await ackPreviewRender(win, 'inv-a');
    await jobA;

    const jobB = runPreviewPdfJob(appConfig, writeInvoicePdf, {
      invoice: { _id: 'inv-b' },
      snapshot: SNAPSHOT,
      pdfPath: path.join(dir, 'b.pdf'),
    });
    await ackPreviewRender(win, 'inv-b');
    await jobB;

    expect(seen).toEqual(['inv-a', 'inv-b']);
    expect(fs.readFileSync(path.join(dir, 'a.pdf'), 'utf8')).toBe('pdf-inv-a');
    expect(fs.readFileSync(path.join(dir, 'b.pdf'), 'utf8')).toBe('pdf-inv-b');
  });

  it('overwrites the target with writeFlag w', async () => {
    const win = makePreviewWindow();
    BrowserWindow.fromId.mockReturnValue(win);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manta-pdf-'));
    const target = path.join(dir, 'doc.pdf');
    fs.writeFileSync(target, 'OLD');
    const writeInvoicePdf = vi.fn(async (_w, pdfPath, { flag }) => {
      fs.writeFileSync(pdfPath, 'SAVED', { flag });
    });
    const job = runPreviewPdfJob(makeAppConfig(dir), writeInvoicePdf, {
      invoice: { _id: 'inv-1' },
      snapshot: SNAPSHOT,
      pdfPath: target,
      writeFlag: 'w',
    });
    await ackPreviewRender(win, 'inv-1');
    await expect(job).resolves.toBe(target);
    expect(fs.readFileSync(target, 'utf8')).toBe('SAVED');
  });

  it('renders a PDF buffer without writing a file', async () => {
    const win = makePreviewWindow();
    BrowserWindow.fromId.mockReturnValue(win);
    const options = { preferCSSPageSize: true };
    const job = renderPreviewPdfBuffer(
      makeAppConfig('/nowhere'),
      { invoice: { _id: 'inv-fx' }, snapshot: SNAPSHOT },
      options
    );
    expect(win.webContents.printToPDF).not.toHaveBeenCalled();
    await ackPreviewRender(win, 'inv-fx');
    const buf = await job;
    expect(buf.subarray(0, 4).toString('utf8')).toBe('%PDF');
    expect(win.webContents.printToPDF).toHaveBeenCalledWith(options);
    expect(activeRequestId()).toBeNull();
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

  it('ignores a preview-rendered ack from another sender or frame', async () => {
    vi.useFakeTimers();
    try {
      const win = makePreviewWindow();
      const pending = waitForPreviewRendered(win, 'job-1', 'inv-1');
      const rejection = expect(pending).rejects.toThrow('preview-timeout');
      const handler = latestPreviewRenderedHandler();
      handler(
        { sender: {}, senderFrame: win.webContents.mainFrame },
        { requestId: 'job-1', invoiceId: 'inv-1' }
      );
      handler(
        { sender: win.webContents, senderFrame: 'sub-frame' },
        { requestId: 'job-1', invoiceId: 'inv-1' }
      );
      await vi.advanceTimersByTimeAsync(10_001);
      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });

  it('releases the queue after preview render timeout', async () => {
    vi.useFakeTimers();
    try {
      const win = makePreviewWindow();
      BrowserWindow.fromId.mockReturnValue(win);
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manta-pdf-'));
      const appConfig = makeAppConfig(dir);
      const writeInvoicePdf = vi.fn();
      const failed = runPreviewPdfJob(appConfig, writeInvoicePdf, {
        invoice: { _id: 'inv-1' },
        snapshot: SNAPSHOT,
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
        snapshot: SNAPSHOT,
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
        snapshot: SNAPSHOT,
        pdfPath: '/tmp/x.pdf',
      })
    ).rejects.toThrow('preview-unavailable');
    expect(activeRequestId()).toBeNull();
  });

  it('frees the queue when the write fails', async () => {
    const win = makePreviewWindow();
    BrowserWindow.fromId.mockReturnValue(win);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manta-pdf-'));
    const writeInvoicePdf = vi.fn(async () => {
      const err = new Error('disk');
      err.code = 'EIO';
      throw err;
    });
    const job = runPreviewPdfJob(makeAppConfig(dir), writeInvoicePdf, {
      invoice: { _id: 'inv-1' },
      snapshot: SNAPSHOT,
      pdfPath: path.join(dir, 'z.pdf'),
    });
    await ackPreviewRender(win, 'inv-1');
    await expect(job).rejects.toThrow('disk');
    expect(activeRequestId()).toBeNull();
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
});
