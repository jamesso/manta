// Libs
const { BrowserWindow, ipcMain, shell } = require('electron');
const appConfig = require('./settings');
const path = require('path');
const { pdfFileName } = require('./pdf-file-name');
const { writeInvoicePdf } = require('./print-invoice-pdf');
const { runDirectPreviewPdfJob } = require('./preview-pdf-coordinator');

module.exports = { writeInvoicePdf };

ipcMain.on('save-pdf', async (event, docId, meta) => {
  const exportDir = appConfig.get('invoice.exportDir');
  const pdfPath = path.join(
    exportDir,
    pdfFileName(docId, meta && meta.docType, exportDir)
  );
  const win = BrowserWindow.fromWebContents(event.sender);
  try {
    await runDirectPreviewPdfJob(win, pdfPath, writeInvoicePdf);
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
    win.webContents.send('pfd-exported', {
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
