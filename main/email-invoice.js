import { BrowserWindow, clipboard, ipcMain, ShareMenu, shell } from 'electron';
import path from 'node:path';

import appConfig from './settings';
import { writeInvoicePdf } from './print-invoice-pdf.js';
import {
  assertPathInExportDir,
  allocatePdfPath,
  consumePreviewToken,
  createPreviewToken,
  getPreviewWindow,
  purgeExpiredTokens,
  restorePreviewToken,
  runPreviewPdfJob,
} from './preview-pdf-coordinator';
import {
  assertMailtoUrl,
  buildMailto,
  safePdfFileName,
  validateCaptureSnapshotPayload,
  validateEmailRequest,
  validateShareRequest,
} from '../helpers/email.js';

function canEmail(invoice) {
  if (!invoice || typeof invoice !== 'object') {
    return false;
  }
  if (invoice.docType && invoice.docType !== 'invoice') {
    return false;
  }
  if (!invoice._id || !invoice.invoiceID) {
    return false;
  }
  const status = invoice.status;
  if (status === 'draft' || status === 'cancelled' || status === 'refunded') {
    return false;
  }
  return true;
}

function isMainFrame(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) {
    return false;
  }
  if (event.senderFrame !== event.sender.mainFrame) {
    return false;
  }
  const mainId = appConfig.get('mainWindowID');
  const previewId = appConfig.get('previewWindowID');
  return win.id === mainId || win.id === previewId;
}

function isMainWindowFrame(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) {
    return false;
  }
  if (event.senderFrame !== event.sender.mainFrame) {
    return false;
  }
  return win.id === appConfig.get('mainWindowID');
}

function isPreviewMainFrame(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) {
    return false;
  }
  if (event.senderFrame !== event.sender.mainFrame) {
    return false;
  }
  return win.id === appConfig.get('previewWindowID');
}

function consumePreviewSnapshot(req) {
  const entry = consumePreviewToken(req.previewToken, req.invoiceId);
  if (!entry) {
    throw new Error('preview-token-invalid');
  }
  return entry;
}

function assertEmailable(invoice) {
  if (!canEmail(invoice)) {
    throw new Error('invalid-request');
  }
}

async function exportSnapshotPdf(req, { hidePreviewAfter = false } = {}) {
  purgeExpiredTokens();
  assertEmailable(req.invoice);
  const snapshot = req.resolvedSnapshot;
  const exportDir = appConfig.get('invoice.exportDir');
  const fallback = String(req.invoice._id ?? 'invoice').slice(0, 8);
  const baseName = safePdfFileName(req.fileBase, fallback);
  const pdfPath = allocatePdfPath(exportDir, baseName);
  assertPathInExportDir(exportDir, pdfPath);
  return runPreviewPdfJob(appConfig, writeInvoicePdf, {
    invoice: req.invoice,
    snapshot,
    pdfPath,
    hidePreviewAfter,
  });
}

ipcMain.handle('email-invoice', async (event, payload) => {
  if (!isMainFrame(event)) {
    return { ok: false, error: 'untrusted-sender' };
  }
  let previewToken = null;
  let previewTokenEntry = null;
  try {
    const req = validateEmailRequest(payload);
    let resolvedSnapshot = req.snapshot;
    if (req.source === 'preview') {
      previewToken = req.previewToken;
      previewTokenEntry = consumePreviewSnapshot(req);
      resolvedSnapshot = previewTokenEntry.snapshot;
    }
    const { url, truncated } = buildMailto(req.draft);
    assertMailtoUrl(url);
    let hidePreviewAfter = false;
    if (req.source === 'app') {
      try {
        const previewWin = getPreviewWindow(appConfig);
        hidePreviewAfter = !previewWin.isVisible();
      } catch {
        hidePreviewAfter = false;
      }
    }
    const pdfPath = await exportSnapshotPdf(
      { ...req, resolvedSnapshot },
      { hidePreviewAfter }
    );
    const fullMessage = truncated
      ? `${req.draft.subject}\n\n${req.draft.body}`
      : undefined;
    try {
      await shell.openExternal(url);
    } catch {
      shell.showItemInFolder(pdfPath);
      return { ok: false, error: 'no-mail-app', pdfPath };
    }
    shell.showItemInFolder(pdfPath);
    return {
      ok: true,
      pdfPath,
      fileName: path.basename(pdfPath),
      truncated,
      fullMessage,
    };
  } catch (err) {
    if (previewToken && previewTokenEntry) {
      restorePreviewToken(previewToken, previewTokenEntry);
    }
    return { ok: false, error: err.message || 'failed' };
  }
});

ipcMain.handle('share-invoice-pdf', async (event, payload) => {
  if (process.platform !== 'darwin') {
    return { ok: false, error: 'unsupported' };
  }
  if (!isMainFrame(event)) {
    return { ok: false, error: 'untrusted-sender' };
  }
  let previewToken = null;
  let previewTokenEntry = null;
  try {
    const req = validateShareRequest(payload);
    let resolvedSnapshot = req.snapshot;
    if (req.source === 'preview') {
      previewToken = req.previewToken;
      previewTokenEntry = consumePreviewSnapshot(req);
      resolvedSnapshot = previewTokenEntry.snapshot;
    }
    const pdfPath = await exportSnapshotPdf({
      ...req,
      resolvedSnapshot,
      draft: undefined,
    });
    const menu = new ShareMenu({ filePaths: [pdfPath] });
    menu.popup({
      browserWindow: BrowserWindow.fromWebContents(event.sender),
    });
    return { ok: true, pdfPath };
  } catch (err) {
    if (previewToken && previewTokenEntry) {
      restorePreviewToken(previewToken, previewTokenEntry);
    }
    return { ok: false, error: err.message || 'failed' };
  }
});

ipcMain.handle('capture-preview-snapshot', (event, payload) => {
  if (!isPreviewMainFrame(event)) {
    return { ok: false, error: 'untrusted-sender' };
  }
  try {
    const { invoice, snapshot } = validateCaptureSnapshotPayload(payload);
    assertEmailable(invoice);
    const previewToken = createPreviewToken({
      invoiceId: invoice._id,
      invoice,
      snapshot,
    });
    return { ok: true, previewToken };
  } catch (err) {
    return { ok: false, error: err.message || 'invalid-request' };
  }
});

ipcMain.handle('copy-email-message', (event, text) => {
  if (!isMainWindowFrame(event)) {
    return { ok: false, error: 'untrusted-sender' };
  }
  if (typeof text !== 'string' || text.length > 20_002) {
    return { ok: false, error: 'invalid-request' };
  }
  clipboard.writeText(text);
  return { ok: true };
});

ipcMain.on('request-email-invoice', (event, payload) => {
  if (!isPreviewMainFrame(event)) {
    return;
  }
  const mainId = appConfig.get('mainWindowID');
  const main = BrowserWindow.fromId(mainId);
  if (!main || main.isDestroyed()) {
    return;
  }
  try {
    const { invoice, snapshot } = validateCaptureSnapshotPayload(payload);
    assertEmailable(invoice);
    const previewToken = createPreviewToken({
      invoiceId: invoice._id,
      invoice,
      snapshot,
    });
    main.show();
    main.focus();
    main.webContents.send('request-email-invoice', {
      invoiceId: invoice._id,
      invoice,
      snapshot,
      source: 'preview',
      previewToken,
    });
  } catch {
    // ignore malformed preview requests
  }
});
