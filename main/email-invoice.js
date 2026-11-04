import { BrowserWindow, clipboard, ipcMain, ShareMenu, shell } from 'electron';
import path from 'node:path';

import appConfig from './settings';
import { writeInvoicePdf } from './print-invoice-pdf.js';
import {
  assertPathInExportDir,
  allocatePdfPath,
  runPreviewPdfJob,
} from './preview-pdf-coordinator';
import { isMainWindowMainFrame } from './main-window-sender';
import {
  assertMailtoUrl,
  buildMailto,
  safePdfFileName,
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

function assertEmailable(invoice) {
  if (!canEmail(invoice)) {
    throw new Error('invalid-request');
  }
}

async function exportSnapshotPdf(req) {
  assertEmailable(req.invoice);
  const exportDir = appConfig.get('invoice.exportDir');
  const fallback = String(req.invoice._id ?? 'invoice').slice(0, 8);
  const baseName = safePdfFileName(req.fileBase, fallback);
  const pdfPath = allocatePdfPath(exportDir, baseName);
  assertPathInExportDir(exportDir, pdfPath);
  return runPreviewPdfJob(appConfig, writeInvoicePdf, {
    invoice: req.invoice,
    snapshot: req.snapshot,
    pdfPath,
  });
}

ipcMain.handle('email-invoice', async (event, payload) => {
  if (!isMainWindowMainFrame(event)) {
    return { ok: false, error: 'untrusted-sender' };
  }
  try {
    const req = validateEmailRequest(payload);
    const { url, truncated } = buildMailto(req.draft);
    assertMailtoUrl(url);
    const pdfPath = await exportSnapshotPdf(req);
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
    return { ok: false, error: err.message || 'failed' };
  }
});

ipcMain.handle('share-invoice-pdf', async (event, payload) => {
  if (process.platform !== 'darwin') {
    return { ok: false, error: 'unsupported' };
  }
  if (!isMainWindowMainFrame(event)) {
    return { ok: false, error: 'untrusted-sender' };
  }
  try {
    const req = validateShareRequest(payload);
    const pdfPath = await exportSnapshotPdf(req);
    const menu = new ShareMenu({ filePaths: [pdfPath] });
    menu.popup({
      browserWindow: BrowserWindow.fromWebContents(event.sender),
    });
    return { ok: true, pdfPath };
  } catch (err) {
    return { ok: false, error: err.message || 'failed' };
  }
});

ipcMain.handle('copy-email-message', (event, text) => {
  if (!isMainWindowMainFrame(event)) {
    return { ok: false, error: 'untrusted-sender' };
  }
  if (typeof text !== 'string' || text.length > 20_002) {
    return { ok: false, error: 'invalid-request' };
  }
  clipboard.writeText(text);
  return { ok: true };
});
