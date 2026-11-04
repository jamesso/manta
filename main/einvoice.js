import { dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

import { InvoiceService } from '@e-invoice-eu/core';

import appConfig from './settings';
import { getPrintOptions } from './print-options';
import { validateEInvoiceExportPayload } from '../app/helpers/einvoiceExportIntegrity.js';
import { toEn16931 } from '../helpers/einvoice/toEn16931.js';
import { getEInvoiceIssues } from '../helpers/einvoice/getEInvoiceIssues.js';
import { toUblJson } from '../helpers/einvoice/toUblJson.js';
import { validatePdfSnapshotPayload } from '../helpers/email.js';
import { renderPreviewPdfBuffer } from './preview-pdf-coordinator';
import { getMainWindow, isMainWindowMainFrame } from './main-window-sender';

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

// einvoice-export: main window → { kind: 'xrechnung' | 'facturx', invoice,
// derived, snapshot: { profile, configs, language } } →
// { ok: true, path, warnings } | { ok: false, error | issues | canceled }
ipcMain.handle('einvoice-export', async (event, payload) => {
  if (!isMainWindowMainFrame(event)) {
    return { ok: false, error: 'untrusted-sender' };
  }

  const { kind, invoice, derived, snapshot } = payload ?? {};
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

  const integrityError = validateEInvoiceExportPayload(invoice, derived, {
    profile: settings.profile,
    invoiceSettings: settings.invoice,
  });
  if (integrityError) {
    return { ok: false, error: integrityError };
  }

  let renderSnapshot = null;
  if (kind === 'facturx') {
    try {
      renderSnapshot = validatePdfSnapshotPayload({
        invoice,
        snapshot,
      }).snapshot;
    } catch {
      return { ok: false, error: 'invalid-request' };
    }
  }

  const format = kind === 'facturx' ? 'facturx-en16931' : 'xrechnung-ubl';
  const model = toEn16931(invoice, settings, derived);
  const issues = getEInvoiceIssues(model, { format, invoice, derived });
  if (issues.some(i => i.severity === 'error')) {
    return { ok: false, issues };
  }

  const { logger, warnings } = collectWarnings();
  const service = new InvoiceService(logger);
  const exportDir = settings.invoice.exportDir;
  const win = getMainWindow();
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

    // The XML seller comes from the stored profile. Render the PDF with the
    // same profile, so that the visible page and the embedded XML agree.
    const pdf = await renderPreviewPdfBuffer(
      appConfig,
      { invoice, snapshot: { ...renderSnapshot, profile: settings.profile } },
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
    return { ok: true, path: filePath, warnings };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
