import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

import { InvoiceService } from '@e-invoice-eu/core';

import appConfig from './settings';
import { getPrintOptions } from './print-options';
import { validateEInvoiceExportPayload } from '../app/helpers/einvoiceExportIntegrity.js';
import { toEn16931 } from '../helpers/einvoice/toEn16931.js';
import { getEInvoiceIssues } from '../helpers/einvoice/getEInvoiceIssues.js';
import { toUblJson } from '../helpers/einvoice/toUblJson.js';

const RESERVED = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
]);

function stripControlChars(value) {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code > 31) {
      out += value[i];
    }
  }
  return out;
}

function safeInvoiceFileName(number) {
  let base = stripControlChars(String(number ?? ''))
    .replace(/[/\\?%*:|"<>]/g, '-')
    .trim()
    .replace(/[. ]+$/g, '');
  if (!base || base === '.' || base === '..') {
    base = 'invoice';
  }
  if (RESERVED.has(base.toUpperCase())) {
    base = 'invoice';
  }
  if (base.length > 120) {
    base = base.slice(0, 120);
  }
  return base;
}

function isPreviewMainFrame(event) {
  const previewId = appConfig.get('previewWindowID');
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed() || win.id !== previewId) {
    return false;
  }
  if (event.senderFrame !== event.sender.mainFrame) {
    return false;
  }
  return true;
}

function collectWarnings(logger) {
  const warnings = [];
  return {
    logger: {
      warn: msg => {
        warnings.push(String(msg));
        console.warn(msg);
      },
      error: msg => {
        warnings.push(String(msg));
        console.error(msg);
      },
      info: () => {},
      debug: () => {},
    },
    warnings,
  };
}

async function waitForPreviewInvoice(win, invoiceId) {
  const deadline = Date.now() + 30_000;
  const idLiteral = JSON.stringify(String(invoiceId ?? ''));
  while (Date.now() < deadline) {
    const ready = await win.webContents.executeJavaScript(
      `(function () {
        const id = ${idLiteral};
        const el = document.querySelector('.print-area');
        if (!el || el.getAttribute('data-invoice-id') !== id) return false;
        if (document.fonts && document.fonts.status !== 'loaded') return false;
        return true;
      })()`,
      true
    );
    if (ready) {
      return;
    }
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error('preview-not-ready');
}

ipcMain.handle('einvoice-export', async (event, payload) => {
  if (!isPreviewMainFrame(event)) {
    return { ok: false, error: 'untrusted-sender' };
  }

  const { kind, invoice, derived } = payload ?? {};
  if (kind !== 'xrechnung' && kind !== 'facturx') {
    return { ok: false, error: 'unknown-kind' };
  }

  const settings = {
    profile: appConfig.get('profile'),
    invoice: appConfig.get('invoice'),
  };
  if (!settings.invoice?.eInvoice?.enabled) {
    return { ok: false, error: 'disabled' };
  }

  const integrityError = validateEInvoiceExportPayload(invoice, derived);
  if (integrityError) {
    return { ok: false, error: integrityError };
  }

  const format =
    kind === 'facturx' ? 'facturx-en16931' : 'xrechnung-ubl';
  const model = toEn16931(invoice, settings, derived);
  const issues = getEInvoiceIssues(model, { format, invoice, derived });
  if (issues.some(i => i.severity === 'error')) {
    return { ok: false, issues };
  }

  const { logger, warnings } = collectWarnings();
  const service = new InvoiceService(logger);
  const exportDir = settings.invoice.exportDir;
  const win = BrowserWindow.fromWebContents(event.sender);
  const base = safeInvoiceFileName(model.number);

  try {
    if (kind === 'xrechnung') {
      const xml = await service.generate(toUblJson(model), {
        format: 'XRECHNUNG-UBL',
        lang: derived.lang ?? 'en',
      });
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        defaultPath: path.join(exportDir, `${base}.xml`),
        filters: [{ name: 'XRechnung', extensions: ['xml'] }],
      });
      if (canceled || !filePath) {
        return { ok: false, canceled: true };
      }
      await fs.writeFile(filePath, xml, 'utf8');
      return { ok: true, path: filePath, warnings };
    }

    await waitForPreviewInvoice(win, invoice._id);
    const pdf = await win.webContents.printToPDF(
      getPrintOptions(appConfig.get('general.printOptions'))
    );
    const out = await service.generate(toUblJson(model), {
      format: 'Factur-X-EN16931',
      lang: derived.lang ?? 'en',
      pdf: {
        buffer: pdf,
        filename: `${base}.pdf`,
        mimetype: 'application/pdf',
      },
    });
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: path.join(exportDir, `${base}.pdf`),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (canceled || !filePath) {
      return { ok: false, canceled: true };
    }
    await fs.writeFile(filePath, Buffer.from(out));
    if (appConfig.get('general.previewPDF')) {
      await shell.openPath(filePath);
    }
    win.webContents.send('pfd-exported', {
      title: 'PDF Exported',
      body: 'Click to reveal file.',
      location: filePath,
    });
    return { ok: true, path: filePath, warnings };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
