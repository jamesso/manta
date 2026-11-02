import {
  CREDIT_NOTE_STATUSES,
  CREDITABLE_STATUSES,
} from '../constants/invoices';
import { getDocType, isCreditNote, isInvoice } from './docType';
import {
  getAmountPaid,
  getCreditedTotal,
  getCurrencyFraction,
  getInvoiceNumber,
  getInvoiceTotal,
  getIssuedAt,
  getPayments,
  getStoredStatus as getInvoiceStoredStatus,
  roundMoney,
  withStatus,
} from './invoice';

export function groupCreditNotesByInvoice(docs = []) {
  const map = new Map();
  for (const doc of docs) {
    if (!isCreditNote(doc)) {
      continue;
    }
    const invoiceId = doc.creditedInvoiceId;
    if (typeof invoiceId !== 'string' || invoiceId === '') {
      continue;
    }
    const list = map.get(invoiceId) ?? [];
    list.push(doc);
    map.set(invoiceId, list);
  }
  return map;
}

function creditNoteCurrencyMatches(invoice, note) {
  const invCode = invoice.currency?.code;
  const noteCode = note.currency?.code;
  if (
    invCode == null ||
    noteCode == null ||
    invCode === '' ||
    noteCode === ''
  ) {
    return false;
  }
  if (invCode !== noteCode) {
    return false;
  }
  return getCurrencyFraction(invoice) === getCurrencyFraction(note);
}

function isValidIssuedCreditAmount(note, invoice) {
  if (getInvoiceStoredStatus(note) !== 'issued') {
    return false;
  }
  if (!creditNoteCurrencyMatches(invoice, note)) {
    return false;
  }
  const total = note.grandTotal;
  if (!Number.isFinite(total) || total < 0) {
    return false;
  }
  return true;
}

export { isCreditNote } from './docType';
export { getCreditedTotal } from './invoice';

export function collectCreditDataWarnings(invoice, creditNotes = []) {
  const warnings = [];
  for (const note of creditNotes) {
    if (!isCreditNote(note) || note.creditedInvoiceId !== invoice._id) {
      continue;
    }
    if (getInvoiceStoredStatus(note) !== 'issued') {
      continue;
    }
    if (!creditNoteCurrencyMatches(invoice, note)) {
      warnings.push({ code: 'creditCurrency', creditNoteId: note._id });
      continue;
    }
    const total = note.grandTotal;
    if (!Number.isFinite(total) || total < 0) {
      warnings.push({ code: 'creditInvalidAmount', creditNoteId: note._id });
    }
  }
  return warnings;
}

export function getEffectivePaid(invoice) {
  return getAmountPaid(invoice);
}

export function getCreditableAmount(
  invoice,
  creditNotes = [],
  { excludeId } = {}
) {
  const f = getCurrencyFraction(invoice);
  const total = roundMoney(getInvoiceTotal(invoice), f);
  let credited = 0;
  for (const note of creditNotes) {
    if (!isCreditNote(note) || note.creditedInvoiceId !== invoice._id) {
      continue;
    }
    if (excludeId && note._id === excludeId) {
      continue;
    }
    if (getInvoiceStoredStatus(note) !== 'issued') {
      continue;
    }
    if (!isValidIssuedCreditAmount(note, invoice)) {
      continue;
    }
    credited = roundMoney(credited + note.grandTotal, f);
  }
  return Math.max(0, roundMoney(total - credited, f));
}

function storedInvoiceStatus(invoice) {
  return getInvoiceStoredStatus(invoice);
}

export function canCreateCreditNote(invoice, creditNotes = []) {
  if (!isInvoice(invoice)) {
    return false;
  }
  const stored = storedInvoiceStatus(invoice);
  if (!CREDITABLE_STATUSES.includes(stored)) {
    return false;
  }
  if (getCreditableAmount(invoice, creditNotes) <= 0) {
    return false;
  }
  return true;
}

function deepCopyRows(rows, idFn) {
  return (rows ?? []).map(row => ({
    ...row,
    id: idFn(),
    subtotal: row.subtotal,
  }));
}

export function buildCreditNoteDraft(invoice, { idFn }) {
  const snapshot = {
    invoiceID: getInvoiceNumber(invoice),
    issuedAt: getIssuedAt(invoice) ?? invoice.created_at ?? null,
  };
  return {
    docType: 'creditNote',
    creditedInvoiceId: invoice._id,
    creditedInvoice: snapshot,
    recipient: structuredClone(invoice.recipient ?? {}),
    seller: invoice.seller ? structuredClone(invoice.seller) : undefined,
    taxMode: invoice.taxMode,
    taxCalc: invoice.taxCalc,
    rows: deepCopyRows(invoice.rows, idFn),
    currency: structuredClone(invoice.currency ?? {}),
    tax: invoice.tax ? structuredClone(invoice.tax) : undefined,
    discount: invoice.discount ? structuredClone(invoice.discount) : undefined,
    configs: invoice.configs ? structuredClone(invoice.configs) : undefined,
  };
}

export function validateCreditableOriginal(invoice) {
  if (!invoice) {
    return 'creditedMissing';
  }
  if (!isInvoice(invoice)) {
    return 'creditedMissing';
  }
  const stored = storedInvoiceStatus(invoice);
  if (!CREDITABLE_STATUSES.includes(stored)) {
    return 'creditOriginalNotCreditable';
  }
  return null;
}

export function collectCreditNoteImportWarnings(invoices = []) {
  const byId = new Map(invoices.map(doc => [doc._id, doc]));
  const warnings = [];
  for (const note of invoices) {
    if (!isCreditNote(note) || getInvoiceStoredStatus(note) !== 'issued') {
      continue;
    }
    const original = byId.get(note.creditedInvoiceId);
    if (!original) {
      warnings.push({ code: 'creditedMissing', creditNoteId: note._id });
      continue;
    }
    if (!isInvoice(original)) {
      warnings.push({
        code: 'creditOriginalNotInvoice',
        creditNoteId: note._id,
      });
      continue;
    }
    warnings.push(...collectCreditDataWarnings(original, [note]));
  }
  return warnings;
}

export function validateCreditTotal(creditNote, invoice, creditNotes) {
  if (!invoice) {
    return 'creditedMissing';
  }
  const originalCode = validateCreditableOriginal(invoice);
  if (originalCode) {
    return originalCode;
  }
  const f = getCurrencyFraction(invoice);
  const noteTotal = roundMoney(getInvoiceTotal(creditNote), f);
  if (noteTotal <= 0) {
    return 'creditZero';
  }
  const invCode = invoice.currency?.code;
  const noteCode = creditNote.currency?.code;
  if (invCode && noteCode && invCode !== noteCode) {
    return 'creditCurrency';
  }
  if (getCurrencyFraction(invoice) !== getCurrencyFraction(creditNote)) {
    return 'creditCurrency';
  }
  const creditable = getCreditableAmount(invoice, creditNotes, {
    excludeId: creditNote._id,
  });
  if (noteTotal > creditable) {
    return 'creditExceeds';
  }
  return null;
}

function clearingEventDate(invoice, creditNotes, now) {
  const issued = creditNotes
    .filter(
      n =>
        isCreditNote(n) &&
        n.creditedInvoiceId === invoice._id &&
        getInvoiceStoredStatus(n) === 'issued'
    )
    .map(n => getIssuedAt(n) ?? n.created_at ?? now)
    .filter(v => v != null);
  if (issued.length) {
    return Math.max(...issued);
  }
  return now;
}

export function resolveStatusAfterCredit(
  invoice,
  creditNotes = [],
  now = Date.now()
) {
  if (!isInvoice(invoice)) {
    return invoice;
  }
  const stored = storedInvoiceStatus(invoice);
  if (stored === 'draft' || stored === 'refunded') {
    return invoice;
  }
  if (stored === 'cancelled' && !invoice.cancelledByCredit) {
    return invoice;
  }
  if (stored === 'paid' && !Array.isArray(invoice.payments)) {
    return invoice;
  }

  const f = getCurrencyFraction(invoice);
  const total = roundMoney(getInvoiceTotal(invoice), f);
  const paid = getEffectivePaid(invoice);
  const credited = getCreditedTotal(invoice, creditNotes);
  const balance = roundMoney(total - paid - credited, f);

  if (credited >= total && paid === 0) {
    if (stored === 'cancelled' && invoice.cancelledByCredit) {
      return invoice;
    }
    const next = withStatus(
      {
        ...invoice,
        cancelledByCredit: true,
        ...(!Array.isArray(invoice.payments) ? { payments: [] } : {}),
      },
      'cancelled',
      now
    );
    delete next.paidAt;
    return next;
  }

  if (balance <= 0) {
    if (stored === 'paid') {
      const next = { ...invoice };
      delete next.cancelledByCredit;
      return next;
    }
    let next = { ...invoice };
    delete next.cancelledByCredit;
    if (!Array.isArray(next.payments) && stored === 'pending') {
      next.payments = [];
    }
    const paidAt =
      paid > 0
        ? (() => {
            const payments = getPayments(next);
            return payments.length ? payments[payments.length - 1].date : now;
          })()
        : clearingEventDate(invoice, creditNotes, now);
    next = withStatus(next, 'paid', paidAt);
    return next;
  }

  if (
    stored === 'paid' ||
    (stored === 'cancelled' && invoice.cancelledByCredit)
  ) {
    const next = withStatus({ ...invoice }, 'pending', now);
    delete next.cancelledByCredit;
    return next;
  }

  return invoice;
}

export function partitionDeletable(ids, docs) {
  const idSet = new Set([].concat(ids));
  const byId = new Map(docs.map(d => [d._id, d]));
  const creditByInvoice = groupCreditNotesByInvoice(docs);
  const deletable = [];
  const blocked = [];

  for (const id of idSet) {
    const doc = byId.get(id);
    if (!doc) {
      deletable.push(id);
      continue;
    }
    if (isInvoice(doc)) {
      const linked = creditByInvoice.get(id) ?? [];
      if (linked.length > 0) {
        blocked.push({ id, reason: 'hasCreditNotes' });
        continue;
      }
      deletable.push(id);
      continue;
    }
    if (isCreditNote(doc)) {
      const cnStatus = getInvoiceStoredStatus(doc);
      if (cnStatus !== 'draft') {
        blocked.push({ id, reason: 'issuedCreditNote' });
        continue;
      }
      deletable.push(id);
      continue;
    }
    deletable.push(id);
  }

  return { deletable, blocked };
}

export function onlyCreditNotes(docs = []) {
  return docs.filter(isCreditNote);
}

export function getCreditNoteStoredStatus(doc) {
  if (!isCreditNote(doc)) {
    return 'draft';
  }
  const status = doc.status;
  if (CREDIT_NOTE_STATUSES.includes(status)) {
    return status;
  }
  return 'draft';
}

export function getCreditNoteDisplayStatus(doc) {
  return getCreditNoteStoredStatus(doc);
}
