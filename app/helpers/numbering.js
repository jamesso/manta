// 'sequential' gives prefix + padded counter (INV-0001). 'random' gives an
// 8-character hex ID, as the original app showed (3f2a9b1c).
export const NUMBER_FORMATS = ['sequential', 'random'];

export const DEFAULT_NUMBERING = {
  prefix: 'INV-',
  next: 1,
  padding: 4,
  format: 'sequential',
};
export const DEFAULT_ESTIMATE_NUMBERING = {
  prefix: 'EST-',
  next: 1,
  padding: 4,
  format: 'sequential',
};
export const DEFAULT_CREDIT_NOTE_NUMBERING = {
  prefix: 'CN-',
  next: 1,
  padding: 4,
  format: 'sequential',
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
    format: NUMBER_FORMATS.includes(value.format)
      ? value.format
      : (defaults.format ?? 'sequential'),
  };
}

const RANDOM_NUMBER_RE = /^[0-9a-f]{8}$/;

export function isRandomNumber(id) {
  return typeof id === 'string' && RANDOM_NUMBER_RE.test(id);
}

// Always has a letter, so a sequential counter with an empty prefix never
// reads a random ID as a used number.
export function randomInvoiceNumber() {
  let id;
  do {
    id = crypto.randomUUID().slice(0, 8);
  } while (!/[a-f]/.test(id));
  return id;
}

export function formatInvoiceNumber(n) {
  const numbering = normalizeNumbering(n);
  if (numbering.format === 'random') {
    return randomInvoiceNumber();
  }
  const digits = String(numbering.next).padStart(numbering.padding, '0');
  return `${numbering.prefix}${digits}`;
}

export function advanceNumbering(n, savedID) {
  const numbering = normalizeNumbering(n);
  if (
    numbering.format === 'random' ||
    !savedID ||
    typeof savedID !== 'string'
  ) {
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
  // Settings own the format; the counter overlay only carries `next`.
  return reconciled.next > fromConfig.next
    ? { ...reconciled, format: fromConfig.format }
    : fromConfig;
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

// `currentId` is the number the form shows now. In random mode it is kept
// while it is still free, so the form does not get a new ID on each refresh.
export function suggestedInvoiceNumberFromReconciled(
  reconciledNumbering,
  configNumbering,
  invoices,
  currentId
) {
  const base = resolveStoredNumbering(reconciledNumbering, configNumbering);
  if (base.format === 'random') {
    const taken = (invoices ?? []).some(doc => doc?.invoiceID === currentId);
    return isRandomNumber(currentId) && !taken
      ? currentId
      : formatInvoiceNumber(base);
  }
  const reconciled = invoices
    ? reconcileNumberingWithPersistedInvoices(base, invoices)
    : base;
  return formatInvoiceNumber(reconciled);
}

export function isInvoiceNumberUsedByOtherDoc(invoiceID, ownDocId, invoices) {
  if (!invoiceID || typeof invoiceID !== 'string') {
    return false;
  }
  for (const doc of invoices ?? []) {
    if (!doc || doc._id === ownDocId || doc.recurringTombstone) {
      continue;
    }
    if (doc.docType === 'estimate' || doc.docType === 'creditNote') {
      continue;
    }
    if (doc.docType && doc.docType !== 'invoice') {
      continue;
    }
    if (doc.invoiceID === invoiceID) {
      return true;
    }
  }
  return false;
}

export function resolveFormInvoiceIdForWrite({
  formInvoiceId,
  ownDocId,
  persistedInvoiceId,
  numbering,
  invoices,
}) {
  if (persistedInvoiceId) {
    return typeof formInvoiceId === 'string'
      ? formInvoiceId.trim()
      : formInvoiceId;
  }
  const base = normalizeNumbering(numbering);
  const suggested = formatInvoiceNumber(base);
  const trimmed = typeof formInvoiceId === 'string' ? formInvoiceId.trim() : '';
  const keepTyped =
    trimmed &&
    trimmed !== suggested &&
    !isInvoiceNumberUsedByOtherDoc(trimmed, ownDocId, invoices);
  if (keepTyped) {
    return trimmed;
  }
  let working = base;
  let candidate = formatInvoiceNumber(working);
  while (isInvoiceNumberUsedByOtherDoc(candidate, ownDocId, invoices)) {
    working = advanceNumbering(working, candidate);
    candidate = formatInvoiceNumber(working);
  }
  return candidate;
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
  const format =
    editedNorm.format !== savedNorm.format ? editedNorm.format : base.format;
  return { prefix, next, padding, format };
}
