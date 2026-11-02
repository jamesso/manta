const { getPrintOptions } = require('./print-options');
const appConfig = require('./settings');
const fs = require('fs');

async function writeInvoicePdf(win, pdfPath, options = {}) {
  if (!win || win.isDestroyed()) {
    throw new Error('preview-unavailable');
  }
  const data = await win.webContents.printToPDF(
    getPrintOptions(appConfig.get('general.printOptions'))
  );
  const flag = options.flag ?? 'w';
  await fs.promises.writeFile(pdfPath, data, { flag });
  return pdfPath;
}

module.exports = { writeInvoicePdf };
