import moment from 'moment';

import { formatNumber } from '../../helpers/formatNumber';
import {
  getAmountPaid,
  getCurrencyFraction,
  getDueDate,
  getGrandTotal,
  getInvoiceTotal,
  getInvoiceTotals,
  getInvoiceValue,
  getIssuedAt,
  getPayments,
  getStoredStatus,
  isLineTaxInvoice,
} from '../../helpers/invoiceTotals.js';
import { isCreditNote, isEstimate } from './docType';
import { getEstimateDisplayStatus } from './estimate';
import { roundMoney } from './money';

export {
  DOC_TYPES,
  getDocType,
  isInvoice,
  isEstimate,
  onlyInvoices,
  onlyEstimates,
} from './docType';

function getCreditedTotal(invoice, creditNotes = []) {
  const f = getCurrencyFraction(invoice);
  let sum = 0;
  for (const note of creditNotes) {
    if (!isCreditNote(note) || note.creditedInvoiceId !== invoice._id) {
      continue;
    }
    if (note.status !== 'issued') {
      continue;
    }
    const invCode = invoice.currency?.code;
    const noteCode = note.currency?.code;
    if (!invCode || !noteCode || invCode !== noteCode) {
      continue;
    }
    if (getCurrencyFraction(note) !== f) {
      continue;
    }
    const total = note.grandTotal;
    if (!Number.isFinite(total) || total < 0) {
      continue;
    }
    sum += total;
  }
  return roundMoney(sum, f);
}

/**
 * Plan 023 subtracts issued credit notes when creditNotes is provided.
 */
function getBalanceDue(invoice, creditNotes = []) {
  const f = getCurrencyFraction(invoice);
  const credited =
    creditNotes.length > 0 ? getCreditedTotal(invoice, creditNotes) : 0;
  return roundMoney(
    roundMoney(getInvoiceTotal(invoice), f) - getAmountPaid(invoice) - credited,
    f
  );
}

// Printed invoices keep the cash balance. Screen callers pass credit notes.
function getPdfBalanceDue(invoice) {
  return getBalanceDue(invoice);
}

function getDisplayStatus(invoice, now = Date.now(), creditNotes = []) {
  if (isEstimate(invoice)) {
    return getEstimateDisplayStatus(invoice, now);
  }
  if (isCreditNote(invoice)) {
    return getStoredStatus(invoice);
  }
  const s = getStoredStatus(invoice);
  if (s !== 'pending') {
    return s;
  }
  const due = getDueDate(invoice);
  if (due !== null && due < moment(now).startOf('day').valueOf()) {
    return 'overdue';
  }
  if (getAmountPaid(invoice) > 0 && getBalanceDue(invoice, creditNotes) > 0) {
    return 'partial';
  }
  return 'pending';
}

function getDueInDays(invoice, now = Date.now()) {
  const due = getDueDate(invoice);
  if (due === null) {
    return null;
  }
  return moment(due).startOf('day').diff(moment(now).startOf('day'), 'days');
}

function withStatus(doc, status, now = Date.now()) {
  const next = { ...doc, status };
  if (status === 'paid') {
    if (doc.status !== 'paid') {
      next.paidAt = now;
    } else if (doc.paidAt != null) {
      next.paidAt = doc.paidAt;
    }
  } else {
    delete next.paidAt;
  }
  return next;
}

/**
 * Invoices marked paid before plan 014 have no `paidAt`. They fall back to the
 * issue date, then the creation date. No backfill is done.
 */
function getPaidDate(invoice) {
  return invoice.paidAt ?? getIssuedAt(invoice) ?? invoice.created_at ?? null;
}

function getInvoiceNumber(invoice) {
  if (!invoice.invoiceID && invoice.recurringId) {
    return '';
  }
  return invoice.invoiceID || invoice._id.slice(0, 8);
}

function formatInvoiceAmount(invoice) {
  const grandTotal = invoice.grandTotal ?? 0;
  const currency = invoice.currency;
  if (!currency) {
    return formatNumber(grandTotal, 2);
  }
  const amount = formatNumber(
    grandTotal,
    currency.fraction,
    currency.separator
  );
  if (currency.placement === 'before') {
    return `${currency.code} ${amount}`;
  }
  return `${amount} ${currency.code}`;
}

export {
  formatInvoiceAmount,
  getAmountPaid,
  getBalanceDue,
  getPdfBalanceDue,
  getCreditedTotal,
  getCurrencyFraction,
  getDisplayStatus,
  getDueDate,
  getDueInDays,
  getGrandTotal,
  getInvoiceNumber,
  getInvoiceTotal,
  getInvoiceTotals,
  getInvoiceValue,
  getIssuedAt,
  getPaidDate,
  getPayments,
  getStoredStatus,
  isLineTaxInvoice,
  roundMoney,
  withStatus,
};
