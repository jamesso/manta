// Libs
const { BrowserWindow, ipcMain, shell } = require('electron');
const appConfig = require('./settings');
const path = require('path');
const fs = require('fs');
const { getPrintOptions } = require('./print-options');

ipcMain.on('save-pdf', async (event, docId) => {
  const exportDir = appConfig.get('invoice.exportDir');
  const pdfPath = path.join(exportDir, `${docId}.pdf`);
  const win = BrowserWindow.fromWebContents(event.sender);
  try {
    const data = await win.webContents.printToPDF(
      getPrintOptions(appConfig.get('general.printOptions'))
    );
    await fs.promises.writeFile(pdfPath, data);
    if (appConfig.get('general.previewPDF')) {
      // Open the PDF with the default reader
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
