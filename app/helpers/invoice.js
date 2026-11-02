import moment from 'moment';

import { calTermDate } from '../../helpers/date';
import { formatNumber } from '../../helpers/formatNumber';
import { INVOICE_STATUSES } from '../constants/invoices';
import { normalizeFraction, roundMoney } from './money';

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
    return Number(getInvoiceValue(invoice).grandTotal) || 0;
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
 * Plan 023 subtracts issued credit notes here.
 */
function getBalanceDue(invoice) {
  const f = getCurrencyFraction(invoice);
  return roundMoney(
    roundMoney(getInvoiceTotal(invoice), f) - getAmountPaid(invoice),
    f
  );
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

function getDisplayStatus(invoice, now = Date.now()) {
  const s = getStoredStatus(invoice);
  if (s !== 'pending') {
    return s;
  }
  const due = getDueDate(invoice);
  if (due !== null && due < moment(now).startOf('day').valueOf()) {
    return 'overdue';
  }
  if (getAmountPaid(invoice) > 0 && getBalanceDue(invoice) > 0) {
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
  getCurrencyFraction,
  getDisplayStatus,
  getDueDate,
  getDueInDays,
  getInvoiceNumber,
  getInvoiceTotal,
  getInvoiceValue,
  getIssuedAt,
  getPaidDate,
  getPayments,
  getStoredStatus,
  roundMoney,
  withStatus,
};
