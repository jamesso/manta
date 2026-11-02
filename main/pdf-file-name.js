import path from 'node:path';

const WINDOWS_RESERVED = new Set([
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

const MAX_BASE_LEN = 120;

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

function sanitizeBaseId(docId) {
  if (typeof docId !== 'string') {
    return null;
  }
  let base = stripControlChars(docId);
  base = path.basename(base.replace(/\\/g, '/'));
  base = base.trim().replace(/[. ]+$/g, '');
  if (base === '' || base === '.' || base === '..') {
    return null;
  }
  const upper = base.toUpperCase();
  if (WINDOWS_RESERVED.has(upper)) {
    return null;
  }
  if (base.length > MAX_BASE_LEN) {
    base = base.slice(0, MAX_BASE_LEN);
  }
  return base;
}

export function pdfFileName(docId, docType, exportDir) {
  const base = sanitizeBaseId(docId);
  if (!base) {
    throw new Error('invalid-doc-id');
  }
  const fileName =
    docType === 'estimate'
      ? `estimate-${base}.pdf`
      : docType === 'creditNote'
        ? `credit-note-${base}.pdf`
        : `${base}.pdf`;
  if (exportDir) {
    const resolved = path.resolve(exportDir, fileName);
    const root = path.resolve(exportDir);
    if (!(resolved === root || resolved.startsWith(root + path.sep))) {
      throw new Error('path-escape');
    }
  }
  return fileName;
}
