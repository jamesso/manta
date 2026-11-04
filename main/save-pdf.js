import { ipcMain, shell } from 'electron';
import path from 'node:path';

import appConfig from './settings';
import { pdfFileName } from './pdf-file-name';
import { writeInvoicePdf } from './print-invoice-pdf';
import {
  assertPathInExportDir,
  runPreviewPdfJob,
} from './preview-pdf-coordinator';
import { getMainWindow, isMainWindowMainFrame } from './main-window-sender';
import { validatePdfSnapshotPayload } from '../helpers/email.js';

// save-pdf: main window → { invoice, snapshot: { profile, configs, language },
// docType } → { ok: true, pdfPath } | { ok: false, error }
ipcMain.handle('save-pdf', async (event, payload) => {
  if (!isMainWindowMainFrame(event)) {
    return { ok: false, error: 'untrusted-sender' };
  }
  try {
    const { invoice, snapshot } = validatePdfSnapshotPayload(payload);
    const docType =
      typeof payload.docType === 'string' ? payload.docType : invoice.docType;
    const exportDir = appConfig.get('invoice.exportDir');
    const pdfPath = path.join(
      exportDir,
      pdfFileName(invoice._id, docType, exportDir)
    );
    assertPathInExportDir(exportDir, pdfPath);
    await runPreviewPdfJob(appConfig, writeInvoicePdf, {
      invoice,
      snapshot,
      pdfPath,
      writeFlag: 'w',
    });
    if (!appConfig.get('onboarding.exportedPdf')) {
      appConfig.set('onboarding.exportedPdf', true);
      const main = getMainWindow();
      if (main) {
        main.webContents.send('onboarding-updated', { exportedPdf: true });
      }
    }
    if (appConfig.get('general.previewPDF')) {
      await shell.openPath(pdfPath);
    }
    return { ok: true, pdfPath };
  } catch (err) {
    console.error('save-pdf failed:', err);
    return { ok: false, error: err?.message || 'failed' };
  }
});

ipcMain.on('reveal-file', (event, location) => {
  if (!isMainWindowMainFrame(event)) {
    return;
  }
  if (typeof location !== 'string' || !location) {
    return;
  }
  shell.showItemInFolder(location);
});
