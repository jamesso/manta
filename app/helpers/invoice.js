import moment from 'moment';

import { calTermDate } from '../../helpers/date';
import { formatNumber } from '../../helpers/formatNumber';
import { INVOICE_STATUSES } from '../constants/invoices';

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
  getDisplayStatus,
  getDueDate,
  getDueInDays,
  getInvoiceNumber,
  getInvoiceValue,
  getIssuedAt,
  getStoredStatus,
  withStatus,
};
