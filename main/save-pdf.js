// Libs
const { BrowserWindow, ipcMain, shell } = require('electron');
const appConfig = require('./settings');
const path = require('path');
const { pdfFileName } = require('./pdf-file-name');
const { writeInvoicePdf } = require('./print-invoice-pdf');
const {
  assertPathInExportDir,
  runPreviewPdfJob,
} = require('./preview-pdf-coordinator');

module.exports = { writeInvoicePdf };

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

let emailHelpersPromise;

function loadEmailHelpers() {
  if (!emailHelpersPromise) {
    emailHelpersPromise = import('../helpers/email.js');
  }
  return emailHelpersPromise;
}

ipcMain.on('save-pdf', async (event, payload) => {
  if (!isPreviewMainFrame(event)) {
    return;
  }
  const exportDir = appConfig.get('invoice.exportDir');
  try {
    const { validateCaptureSnapshotPayload } = await loadEmailHelpers();
    const { invoice, snapshot } = validateCaptureSnapshotPayload(payload);
    const docType =
      payload && typeof payload.docType === 'string'
        ? payload.docType
        : invoice.docType;
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
      const main = BrowserWindow.fromId(appConfig.get('mainWindowID'));
      if (main && !main.isDestroyed()) {
        main.webContents.send('onboarding-updated', { exportedPdf: true });
      }
    }
    if (appConfig.get('general.previewPDF')) {
      await shell.openPath(pdfPath);
    }
    event.sender.send('pfd-exported', {
      title: 'PDF Exported',
      body: 'Click to reveal file.',
      location: pdfPath,
    });
  } catch (error) {
    console.error('save-pdf failed:', error);
  }
});

ipcMain.on('reveal-file', (event, location) => {
  shell.showItemInFolder(location);
});
