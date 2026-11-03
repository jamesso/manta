const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const RENDER_TIMEOUT_MS = 10_000;
const TOKEN_TTL_MS = 5 * 60_000;

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

/** @type {Map<string, { invoiceId, invoice, snapshot, expires }>} */
const previewTokens = new Map();

let jobChain = Promise.resolve();
let activeRequestId = null;
let coordinatorEmailFreeze = false;

function createPreviewToken({ invoiceId, invoice, snapshot }) {
  const token = crypto.randomBytes(16).toString('hex');
  previewTokens.set(token, {
    invoiceId,
    invoice,
    snapshot,
    expires: Date.now() + TOKEN_TTL_MS,
  });
  return token;
}

function consumePreviewToken(token, invoiceId) {
  const entry = previewTokens.get(token);
  previewTokens.delete(token);
  if (!entry || entry.expires < Date.now()) {
    return null;
  }
  if (entry.invoiceId !== invoiceId) {
    return null;
  }
  return entry;
}

function restorePreviewToken(token, entry) {
  if (token && entry) {
    previewTokens.set(token, entry);
  }
}

function releasePreviewToken(token) {
  previewTokens.delete(token);
}

function purgeExpiredTokens() {
  const now = Date.now();
  for (const [key, entry] of previewTokens.entries()) {
    if (entry.expires < now) {
      previewTokens.delete(key);
    }
  }
}

function getPreviewWindow(appConfig) {
  const id = appConfig.get('previewWindowID');
  const win = resolveBrowserWindow().fromId(id);
  if (!win || win.isDestroyed()) {
    throw new Error('preview-unavailable');
  }
  return win;
}

function setPreviewExportFrozen(win, frozen) {
  if (win && !win.isDestroyed()) {
    win.webContents.send('preview-export-freeze', frozen);
  }
}

async function applySyncExportFrozen(win, frozen) {
  if (!win || win.isDestroyed()) {
    return;
  }
  const { webContents } = win;
  if (
    !webContents ||
    (typeof webContents.isDestroyed === 'function' && webContents.isDestroyed())
  ) {
    return;
  }
  await webContents.executeJavaScript(
    `window.__mantaExportFrozen = ${frozen ? 'true' : 'false'};`,
    true
  );
}

function clearCoordinatorEmailFreeze(win) {
  if (coordinatorEmailFreeze && win && !win.isDestroyed()) {
    setPreviewExportFrozen(win, false);
    coordinatorEmailFreeze = false;
  }
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

async function runDirectPreviewPdfJob(
  win,
  pdfPath,
  writeInvoicePdf,
  { flag = 'w' } = {}
) {
  return enqueueJob(async () => {
    if (!win || win.isDestroyed()) {
      throw new Error('preview-unavailable');
    }
    let syncFreezeAcquired = false;
    try {
      await applySyncExportFrozen(win, true);
      syncFreezeAcquired = true;
      await writeInvoicePdf(win, pdfPath, { flag });
      return pdfPath;
    } finally {
      if (syncFreezeAcquired) {
        await applySyncExportFrozen(win, false);
      }
    }
  });
}

async function runPreviewPdfJob(appConfig, writeInvoicePdf, params) {
  return enqueueJob(async () => {
    const { invoice, snapshot, pdfPath } = params;
    const previewWindow = getPreviewWindow(appConfig);
    const requestId = crypto.randomBytes(12).toString('hex');
    activeRequestId = requestId;
    coordinatorEmailFreeze = true;
    const hideAfter =
      params.hidePreviewAfter === true && !previewWindow.isVisible();
    let syncFreezeAcquired = false;
    try {
      await applySyncExportFrozen(previewWindow, true);
      syncFreezeAcquired = true;
      setPreviewExportFrozen(previewWindow, true);
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
      const written = await writePdfWithWx(
        previewWindow,
        pdfPath,
        writeInvoicePdf
      );
      if (hideAfter) {
        previewWindow.hide();
      }
      return written;
    } finally {
      activeRequestId = null;
      clearCoordinatorEmailFreeze(previewWindow);
      if (syncFreezeAcquired) {
        await applySyncExportFrozen(previewWindow, false);
      }
    }
  });
}

function runFacturxPrintJob(task) {
  return enqueueJob(task);
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
  coordinatorEmailFreeze = false;
  previewTokens.clear();
}

module.exports = {
  activeRequestId: () => activeRequestId,
  assertPathInExportDir,
  consumePreviewToken,
  createPreviewToken,
  allocatePdfPath,
  getPreviewWindow,
  purgeExpiredTokens,
  registerPreviewToken: createPreviewToken,
  registerPreviewCoordinatorIpc,
  releasePreviewToken,
  restorePreviewToken,
  runPreviewPdfJob,
  waitForPreviewRendered,
  writePdfWithWx,
  runDirectPreviewPdfJob,
  runFacturxPrintJob,
  enqueueJob,
  __resetForTests,
  __setElectronForTests,
};
