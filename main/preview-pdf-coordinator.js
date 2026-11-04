// Renders invoices in the hidden preview window and prints them to PDF.
//
// The preview window never shows. It is only the PDF render engine. Each
// job gets a requestId. The preview renderer only accepts an
// `update-preview` with the active requestId, and it acknowledges with
// `preview-rendered` when fonts and images are ready. Jobs run one at a
// time, so the printed page always shows the invoice of the job.
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const RENDER_TIMEOUT_MS = 10_000;

let testElectron = null;

function resolveElectron() {
  if (testElectron) {
    return testElectron;
  }
  return require('electron');
}

function resolveIpcMain() {
  return resolveElectron().ipcMain;
}

function resolveBrowserWindow() {
  return resolveElectron().BrowserWindow;
}

let jobChain = Promise.resolve();
let activeRequestId = null;

function getPreviewWindow(appConfig) {
  const id = appConfig.get('previewWindowID');
  const win = resolveBrowserWindow().fromId(id);
  if (!win || win.isDestroyed()) {
    throw new Error('preview-unavailable');
  }
  return win;
}

function waitForPreviewRendered(previewWindow, requestId, invoiceId) {
  const ipcMain = resolveIpcMain();
  if (!ipcMain || typeof ipcMain.on !== 'function') {
    return Promise.reject(new Error('preview-unavailable'));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ipcMain.removeListener('preview-rendered', onRendered);
      reject(new Error('preview-timeout'));
    }, RENDER_TIMEOUT_MS);

    function onRendered(event, payload) {
      if (event.sender !== previewWindow.webContents) {
        return;
      }
      if (event.senderFrame !== previewWindow.webContents.mainFrame) {
        return;
      }
      if (!payload || payload.requestId !== requestId) {
        return;
      }
      if (payload.invoiceId !== invoiceId) {
        return;
      }
      clearTimeout(timer);
      ipcMain.removeListener('preview-rendered', onRendered);
      resolve(payload);
    }

    ipcMain.on('preview-rendered', onRendered);
  });
}

function allocatePdfPath(exportDir, fileName) {
  const base = path.basename(fileName);
  let candidate = path.join(exportDir, base);
  let counter = 1;
  while (fs.existsSync(candidate)) {
    const ext = path.extname(base);
    const stem = path.basename(base, ext);
    candidate = path.join(exportDir, `${stem}-${counter}${ext}`);
    counter += 1;
  }
  return candidate;
}

function assertPathInExportDir(exportDir, targetPath) {
  const resolvedDir = path.resolve(exportDir);
  const resolved = path.resolve(targetPath);
  if (
    resolved !== resolvedDir &&
    !resolved.startsWith(`${resolvedDir}${path.sep}`)
  ) {
    throw new Error('invalid-path');
  }
}

async function writePdfWithWx(win, pdfPath, writeInvoicePdf) {
  const dir = path.dirname(pdfPath);
  const ext = path.extname(pdfPath);
  const stem = path.basename(pdfPath, ext);
  let candidate = pdfPath;
  let counter = 1;
  while (true) {
    try {
      await writeInvoicePdf(win, candidate, { flag: 'wx' });
      return candidate;
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
      candidate = path.join(dir, `${stem}-${counter}${ext}`);
      counter += 1;
    }
  }
}

function enqueueJob(fn) {
  const run = jobChain.then(fn);
  jobChain = run.catch(() => {});
  return run;
}

/**
 * Renders `invoice` with `snapshot` in the hidden preview window, waits for
 * the render ack, then runs `task(previewWindow)` while the job is active.
 * Resolves with the result of `task`.
 */
function runPreviewRenderJob(appConfig, { invoice, snapshot }, task) {
  return enqueueJob(async () => {
    const previewWindow = getPreviewWindow(appConfig);
    const requestId = crypto.randomBytes(12).toString('hex');
    activeRequestId = requestId;
    try {
      previewWindow.webContents.send('update-preview', {
        requestId,
        invoice,
        profile: snapshot.profile,
        configs: snapshot.configs,
        language: snapshot.language,
      });
      await waitForPreviewRendered(
        previewWindow,
        requestId,
        String(invoice._id ?? '')
      );
      return await task(previewWindow);
    } finally {
      activeRequestId = null;
    }
  });
}

/**
 * Renders the invoice and writes the PDF to `pdfPath`. With writeFlag 'w'
 * the file is overwritten. Otherwise the file is never overwritten and a
 * free `-N` suffix is used. Resolves with the written path.
 */
function runPreviewPdfJob(appConfig, writeInvoicePdf, params) {
  const { invoice, snapshot, pdfPath, writeFlag } = params;
  return runPreviewRenderJob(
    appConfig,
    { invoice, snapshot },
    async previewWindow => {
      if (writeFlag === 'w') {
        await writeInvoicePdf(previewWindow, pdfPath, { flag: 'w' });
        return pdfPath;
      }
      return writePdfWithWx(previewWindow, pdfPath, writeInvoicePdf);
    }
  );
}

/**
 * Renders the invoice and resolves with the PDF bytes. Nothing is written
 * to disk.
 */
function renderPreviewPdfBuffer(
  appConfig,
  { invoice, snapshot },
  printOptions
) {
  return runPreviewRenderJob(
    appConfig,
    { invoice, snapshot },
    previewWindow => {
      if (previewWindow.isDestroyed()) {
        throw new Error('preview-unavailable');
      }
      return previewWindow.webContents.printToPDF(printOptions);
    }
  );
}

function registerPreviewCoordinatorIpc() {
  const ipcMain = resolveIpcMain();
  if (!ipcMain || typeof ipcMain.on !== 'function') {
    return;
  }
  ipcMain.on('preview-active-request-id', event => {
    event.returnValue = activeRequestId;
  });
}

function __setElectronForTests(electron) {
  testElectron = electron;
}

function __resetForTests() {
  jobChain = Promise.resolve();
  activeRequestId = null;
}

module.exports = {
  activeRequestId: () => activeRequestId,
  allocatePdfPath,
  assertPathInExportDir,
  enqueueJob,
  getPreviewWindow,
  registerPreviewCoordinatorIpc,
  renderPreviewPdfBuffer,
  runPreviewPdfJob,
  runPreviewRenderJob,
  waitForPreviewRendered,
  writePdfWithWx,
  __resetForTests,
  __setElectronForTests,
};
