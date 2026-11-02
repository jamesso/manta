export const DEFAULT_NUMBERING = { prefix: 'INV-', next: 1, padding: 4 };
export const DEFAULT_ESTIMATE_NUMBERING = {
  prefix: 'EST-',
  next: 1,
  padding: 4,
};
export const DEFAULT_CREDIT_NOTE_NUMBERING = {
  prefix: 'CN-',
  next: 1,
  padding: 4,
};

export function numberingKeyFor(docType) {
  if (docType === 'estimate') {
    return 'estimateNumbering';
  }
  if (docType === 'creditNote') {
    return 'creditNoteNumbering';
  }
  return 'numbering';
}

export function defaultNumberingFor(docType) {
  if (docType === 'estimate') {
    return DEFAULT_ESTIMATE_NUMBERING;
  }
  if (docType === 'creditNote') {
    return DEFAULT_CREDIT_NOTE_NUMBERING;
  }
  return DEFAULT_NUMBERING;
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return fallback;
  }
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export function normalizeNumbering(value, defaults = DEFAULT_NUMBERING) {
  if (value == null || typeof value !== 'object') {
    return { ...defaults };
  }
  return {
    prefix: typeof value.prefix === 'string' ? value.prefix : defaults.prefix,
    next: clampInt(value.next, 1, Number.MAX_SAFE_INTEGER, defaults.next),
    padding: clampInt(value.padding, 0, 12, defaults.padding),
  };
}

export function formatInvoiceNumber(n) {
  const numbering = normalizeNumbering(n);
  const digits = String(numbering.next).padStart(numbering.padding, '0');
  return `${numbering.prefix}${digits}`;
}

export function advanceNumbering(n, savedID) {
  const numbering = normalizeNumbering(n);
  if (!savedID || typeof savedID !== 'string') {
    return numbering;
  }
  const escaped = numbering.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}(\\d+)$`);
  const match = savedID.match(re);
  if (!match) {
    return numbering;
  }
  const used = Number.parseInt(match[1], 10);
  if (!Number.isFinite(used) || used < numbering.next) {
    return numbering;
  }
  return { ...numbering, next: used + 1 };
}

export function assignNumberIfMissing(doc, nextStatus, numbering) {
  const n = normalizeNumbering(numbering);
  if (doc.status === 'draft' && !doc.invoiceID && nextStatus !== 'draft') {
    const invoiceID = formatInvoiceNumber(n);
    return {
      doc: { ...doc, invoiceID },
      numbering: advanceNumbering(n, invoiceID),
    };
  }
  return { doc, numbering: n };
}

export function resolveStoredNumbering(reconciledNumbering, configNumbering) {
  const fromConfig = normalizeNumbering(configNumbering);
  if (!reconciledNumbering) {
    return fromConfig;
  }
  const reconciled = normalizeNumbering(reconciledNumbering);
  return reconciled.next > fromConfig.next ? reconciled : fromConfig;
}

export function reconcileNumberingWithPersistedInvoices(numbering, invoices) {
  const base = normalizeNumbering(numbering);
  const escaped = base.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}(\\d+)$`);
  let next = base.next;
  for (const doc of invoices ?? []) {
    if (!doc || doc.recurringTombstone) {
      continue;
    }
    if (doc.docType === 'estimate' || doc.docType === 'creditNote') {
      continue;
    }
    if (doc.docType && doc.docType !== 'invoice') {
      continue;
    }
    const id = doc.invoiceID;
    if (typeof id !== 'string') {
      continue;
    }
    const match = id.match(re);
    if (!match) {
      continue;
    }
    const used = Number.parseInt(match[1], 10);
    if (Number.isFinite(used) && used >= next) {
      next = used + 1;
    }
  }
  return { ...base, next };
}

export function suggestedInvoiceNumberFromReconciled(
  reconciledNumbering,
  configNumbering,
  invoices
) {
  const base = resolveStoredNumbering(reconciledNumbering, configNumbering);
  const reconciled = invoices
    ? reconcileNumberingWithPersistedInvoices(base, invoices)
    : base;
  return formatInvoiceNumber(reconciled);
}

export function mergeNumbering(stored, saved, edited) {
  const base = normalizeNumbering(stored);
  const savedNorm = normalizeNumbering(saved);
  const editedNorm = normalizeNumbering(edited);
  const prefix =
    editedNorm.prefix !== savedNorm.prefix ? editedNorm.prefix : base.prefix;
  let next = base.next;
  if (
    editedNorm.prefix === savedNorm.prefix &&
    editedNorm.next !== savedNorm.next
  ) {
    next = editedNorm.next;
  }
  let padding = base.padding;
  if (
    editedNorm.prefix === savedNorm.prefix &&
    editedNorm.padding !== savedNorm.padding
  ) {
    padding = editedNorm.padding;
  }
  return { prefix, next, padding };
}
