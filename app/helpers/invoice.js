import moment from 'moment';

import { calTermDate } from '../../helpers/date';
import { formatNumber } from '../../helpers/formatNumber';
import { INVOICE_STATUSES, CREDIT_NOTE_STATUSES } from '../constants/invoices';
import { isEstimate, isCreditNote } from './docType';
import { getEstimateDisplayStatus, getEstimateStoredStatus } from './estimate';
export {
  DOC_TYPES,
  getDocType,
  isInvoice,
  isEstimate,
  onlyInvoices,
  onlyEstimates,
} from './docType';
import { normalizeFraction, roundMoney } from './money';
import {
  compareTaxGroups,
  roundMoney as roundMoneyFromTax,
  taxGroupKey,
} from './tax';

function getCurrencyFraction(invoice) {
  const n = Number(invoice?.currency?.fraction);
  if (Number.isInteger(n) && n >= 0 && n <= 8) {
    return n;
  }
  return 2;
}

function getInvoiceTotal(invoice) {
  if (Number.isFinite(invoice.grandTotal)) {
    return invoice.grandTotal;
  }
  if (Array.isArray(invoice.rows)) {
    return Number(getGrandTotal(invoice)) || 0;
  }
  return 0;
}

const MIN_DATE = -8640000000000000;
const MAX_DATE = 8640000000000000;

function isValidPaymentDate(date) {
  return (
    typeof date === 'number' &&
    Number.isFinite(date) &&
    date >= MIN_DATE &&
    date <= MAX_DATE
  );
}

function amountRepresentableAtFraction(amount, fraction) {
  if (!Number.isFinite(amount) || amount <= 0) {
    return false;
  }
  return roundMoney(amount, fraction) === amount;
}

function getPayments(invoice) {
  if (!Array.isArray(invoice.payments)) {
    return [];
  }
  const f = getCurrencyFraction(invoice);
  const seen = new Set();
  const valid = [];
  for (const entry of invoice.payments) {
    if (entry == null || typeof entry !== 'object') {
      continue;
    }
    const id = entry.id;
    if (typeof id !== 'string' || id === '' || seen.has(id)) {
      continue;
    }
    const amount = Number(entry.amount);
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !amountRepresentableAtFraction(amount, f)
    ) {
      continue;
    }
    if (!isValidPaymentDate(entry.date)) {
      continue;
    }
    seen.add(id);
    valid.push({
      id,
      date: entry.date,
      amount,
      method: entry.method,
      note: entry.note,
    });
  }
  valid.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date - b.date;
    }
    return a.id.localeCompare(b.id);
  });
  return valid;
}

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

function getAmountPaid(invoice) {
  const f = getCurrencyFraction(invoice);
  if (!Array.isArray(invoice.payments)) {
    return getStoredStatus(invoice) === 'paid'
      ? roundMoney(getInvoiceTotal(invoice), f)
      : 0;
  }
  const sum = getPayments(invoice).reduce((acc, p) => acc + p.amount, 0);
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

function getInvoiceValue(data) {
  function calSub(data) {
    return data.rows.reduce((value, row) => value + row.subtotal, 0);
  }

  function calDiscount(data) {
    if (data.discount) {
      if (data.discount.type === 'percentage') {
        const subtotal = calSub(data);
        return (subtotal * data.discount.amount) / 100;
      }
      return data.discount.amount;
    }
  }

  function calTax(data) {
    if (data.tax) {
      const subtotal = calSub(data);
      if (data.discount) {
        const discount = calDiscount(data);
        const afterDiscount = subtotal - discount;
        return (afterDiscount * data.tax.amount) / 100;
      }
      return (subtotal * data.tax.amount) / 100;
    }
  }

  function calTotal() {
    let grandTotal = calSub(data);
    if (data.discount) {
      const discountAmount = calDiscount(data);
      grandTotal -= discountAmount;
    }
    if (data.tax) {
      const taxAmount = calTax(data);
      if (data.tax.method === 'default') {
        grandTotal += taxAmount;
      }
    }
    return grandTotal;
  }

  return {
    subtotal: calSub(data),
    discount: calDiscount(data),
    taxAmount: calTax(data),
    grandTotal: calTotal(),
  };
}

function isLineTaxInvoice(invoice) {
  if (invoice?.taxMode === 'line') {
    return true;
  }
  if (invoice?.taxMode === 'invoice') {
    return false;
  }
  if (invoice?.taxCalc === 1) {
    return true;
  }
  if (Array.isArray(invoice?.rows)) {
    return invoice.rows.some(row => Number.isFinite(Number(row.taxRate)));
  }
  return false;
}

function lineNetForRow(row, f) {
  const price = Number(row.price);
  const qty = Number(row.quantity);
  if (Number.isFinite(price) && Number.isFinite(qty)) {
    return roundMoneyFromTax(price * qty, f);
  }
  return roundMoneyFromTax(row.subtotal, f);
}

function allocateDiscountToGroups(groups, discount, subtotal, f) {
  if (!Number.isFinite(discount) || discount === 0 || subtotal === 0) {
    return groups.map(g => ({ ...g, discountShare: 0 }));
  }
  const sorted = [...groups].sort(compareTaxGroups);
  let roundedSum = 0;
  const withShares = sorted.map(g => {
    const raw = (g.net / subtotal) * discount;
    const share = roundMoneyFromTax(raw, f);
    roundedSum += share;
    return { ...g, discountShare: share };
  });
  let remainder = roundMoneyFromTax(discount - roundedSum, f);
  if (remainder !== 0) {
    let target = withShares[0];
    for (const g of withShares) {
      if (g.net > target.net) {
        target = g;
      } else if (g.net === target.net) {
        if (compareTaxGroups(g, target) < 0) {
          target = g;
        }
      }
    }
    const idx = withShares.indexOf(target);
    withShares[idx] = {
      ...withShares[idx],
      discountShare: roundMoneyFromTax(
        withShares[idx].discountShare + remainder,
        f
      ),
    };
  }
  return withShares;
}

function getInvoiceTotals(invoice) {
  if (!isLineTaxInvoice(invoice)) {
    const v = getInvoiceValue(invoice);
    const tax = invoice.tax;
    let taxBreakdown = [];
    if (tax) {
      const base = v.subtotal - (v.discount ?? 0);
      taxBreakdown = [
        {
          key: 'legacy',
          category: tax.method === 'reverse' ? 'AE' : 'S',
          rate: tax.amount,
          base,
          amount: v.taxAmount,
          exemptionReason: '',
          addedToTotal: tax.method === 'default',
        },
      ];
    }
    return {
      mode: 'invoice',
      lines: (invoice.rows ?? []).map(r => ({ net: r.subtotal })),
      subtotal: v.subtotal,
      discount: v.discount ?? 0,
      taxTotal: v.taxAmount ?? 0,
      grandTotal: v.grandTotal,
      taxBreakdown,
    };
  }

  const f = getCurrencyFraction(invoice);
  const rows = invoice.rows ?? [];
  const lines = rows.map(row => ({ net: lineNetForRow(row, f) }));
  const subtotal = roundMoneyFromTax(
    lines.reduce((acc, line) => acc + line.net, 0),
    f
  );

  let discount = 0;
  if (invoice.discount) {
    if (invoice.discount.type === 'percentage') {
      discount = roundMoneyFromTax(
        (subtotal * Number(invoice.discount.amount)) / 100,
        f
      );
    } else {
      discount = roundMoneyFromTax(Number(invoice.discount.amount), f);
    }
  }

  const groupMap = new Map();
  rows.forEach((row, i) => {
    const net = lines[i].net;
    const category = row.taxCategory ?? 'S';
    const rate = row.taxRate ?? 0;
    const key = taxGroupKey(category, rate);
    const prev = groupMap.get(key);
    if (prev) {
      prev.net = roundMoneyFromTax(prev.net + net, f);
      const reason = String(row.taxExemptionReason ?? '').trim();
      if (reason && prev.exemptionReason && prev.exemptionReason !== reason) {
        prev.conflict = true;
      } else if (reason && !prev.exemptionReason) {
        prev.exemptionReason = reason;
      }
    } else {
      groupMap.set(key, {
        key,
        category,
        rate: Number(rate) || 0,
        net,
        exemptionReason: String(row.taxExemptionReason ?? '').trim(),
        conflict: false,
      });
    }
  });

  const groups = [...groupMap.values()];
  const allocated = allocateDiscountToGroups(groups, discount, subtotal, f);
  allocated.sort(compareTaxGroups);

  const taxBreakdown = allocated.map(g => {
    const base = roundMoneyFromTax(g.net - g.discountShare, f);
    const amount = roundMoneyFromTax((base * g.rate) / 100, f);
    return {
      key: g.key,
      category: g.category,
      rate: g.rate,
      base,
      amount,
      exemptionReason: g.exemptionReason ?? '',
      addedToTotal: true,
      conflict: g.conflict,
    };
  });

  const taxTotal = roundMoneyFromTax(
    taxBreakdown.reduce((acc, g) => acc + g.amount, 0),
    f
  );
  const grandTotal = roundMoneyFromTax(subtotal - discount + taxTotal, f);

  return {
    mode: 'line',
    lines,
    subtotal,
    discount,
    taxTotal,
    grandTotal,
    taxBreakdown,
  };
}

function getGrandTotal(invoice) {
  return getInvoiceTotals(invoice).grandTotal;
}

function getIssuedAt(invoice) {
  const raw = invoice.issuedAt ?? invoice.created_at ?? null;
  if (raw == null || raw === '') {
    return null;
  }
  if (typeof raw === 'number' && !Number.isFinite(raw)) {
    return null;
  }
  const m = moment(raw);
  if (!m.isValid()) {
    return null;
  }
  return m.valueOf();
}

function getStoredStatus(invoice) {
  if (isEstimate(invoice)) {
    return getEstimateStoredStatus(invoice);
  }
  if (isCreditNote(invoice)) {
    const status = invoice.status;
    if (CREDIT_NOTE_STATUSES.includes(status)) {
      return status;
    }
    return 'draft';
  }
  const status = invoice.status;
  if (INVOICE_STATUSES.includes(status)) {
    return status;
  }
  return 'pending';
}

function getDueDate(invoice) {
  const { dueDate } = invoice;
  if (!dueDate) {
    return null;
  }
  if (dueDate.useCustom === true) {
    if (dueDate.selectedDate == null) {
      return null;
    }
    const m = moment(dueDate.selectedDate);
    if (!m.isValid()) {
      return null;
    }
    return m.valueOf();
  }
  const base = getIssuedAt(invoice);
  if (base == null) {
    return null;
  }
  const termMs = calTermDate(base, dueDate.paymentTerm);
  if (termMs == null || !Number.isFinite(termMs)) {
    return null;
  }
  return termMs;
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
  return invoice.invoiceID || invoice._id.slice(0, 8);
}

function formatInvoiceAmount(invoice) {
  const { grandTotal } = invoice;
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
