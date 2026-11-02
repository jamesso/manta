import moment from 'moment';

import { PAYMENT_METHODS } from '../constants/invoices';
import {
  getAmountPaid,
  getBalanceDue,
  getCurrencyFraction,
  getInvoiceTotal,
  getPaidDate,
  getPayments,
  getStoredStatus,
  roundMoney,
  withStatus,
} from './invoice';
import { isInvoice } from './docType';

function startOfDay(ms) {
  return moment(ms).startOf('day').valueOf();
}

function formatAmountInput(amount, currency) {
  const f = getCurrencyFraction({ currency });
  const fixed = roundMoney(amount, f).toFixed(f);
  if (currency?.separator === 'dotComma') {
    return fixed.replace('.', ',');
  }
  return fixed;
}

function validateGrouping(raw, separator) {
  const dec = separator === 'dotComma' ? ',' : '.';
  const parts = raw.split(dec);
  if (parts.length > 2) {
    return false;
  }
  const intPart = parts[0].replace(/[\s\u00a0\u202f]/g, '');
  if (intPart === '') {
    return false;
  }
  const groups = intPart.split(separator === 'dotComma' ? '.' : ',');
  if (groups.length === 1) {
    return /^\d+$/.test(groups[0]);
  }
  if (!/^\d{1,3}$/.test(groups[0])) {
    return false;
  }
  for (let i = 1; i < groups.length; i += 1) {
    if (!/^\d{3}$/.test(groups[i])) {
      return false;
    }
  }
  return true;
}

function parseMoneyInput(raw, separator) {
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.replace(/[\s\u00a0\u202f]/g, '');
  if (trimmed === '') {
    return null;
  }
  if (!validateGrouping(trimmed, separator)) {
    return null;
  }
  let normalized;
  if (separator === 'dotComma') {
    normalized = trimmed.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = trimmed.replace(/,/g, '');
  }
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    return null;
  }
  const dot = normalized.indexOf('.');
  const decimals = dot === -1 ? 0 : normalized.length - dot - 1;
  return { value, decimals };
}

function canRecordPayment(invoice) {
  return (
    isInvoice(invoice) &&
    ['pending', 'paid'].includes(getStoredStatus(invoice)) &&
    getBalanceDue(invoice) > 0
  );
}

function getPaymentErrors({ amountRaw, date }, invoice, now) {
  const f = getCurrencyFraction(invoice);
  const separator = invoice.currency?.separator ?? 'commaDot';
  const errors = {};
  const parsed =
    amountRaw === undefined || amountRaw === null
      ? null
      : parseMoneyInput(String(amountRaw), separator);
  if (parsed === null) {
    errors.amount = 'invoices:payments:errors:amountInvalid';
  } else {
    if (parsed.decimals > f) {
      errors.amount = 'invoices:payments:errors:tooManyDecimals';
    } else if (parsed.value <= 0) {
      errors.amount = 'invoices:payments:errors:amountPositive';
    } else if (roundMoney(parsed.value, f) > getBalanceDue(invoice)) {
      errors.amount = 'invoices:payments:errors:overpayment';
    }
  }
  if (typeof date !== 'number' || !Number.isFinite(date)) {
    errors.date = 'invoices:payments:errors:dateRequired';
  } else if (date > moment(now).endOf('day').valueOf()) {
    errors.date = 'invoices:payments:errors:dateFuture';
  }
  return errors;
}

function getClearingPaymentDate(invoice, now) {
  const f = getCurrencyFraction(invoice);
  const target = roundMoney(getInvoiceTotal(invoice), f);
  let running = 0;
  for (const p of getPayments(invoice)) {
    running = roundMoney(running + p.amount, f);
    if (running >= target) {
      return p.date;
    }
  }
  return now;
}

function reconcilePaymentStatus(doc, now) {
  if (!Array.isArray(doc.payments)) {
    return doc;
  }
  const stored = getStoredStatus(doc);
  if (stored !== 'pending' && stored !== 'paid') {
    return doc;
  }
  const balance = getBalanceDue(doc);
  if (stored === 'paid' && balance <= 0) {
    return doc;
  }
  if (balance <= 0) {
    const clearingDate = getClearingPaymentDate(doc, now);
    return withStatus(doc, 'paid', clearingDate);
  }
  if (stored === 'paid' && balance > 0) {
    return withStatus(doc, 'pending', now);
  }
  return doc;
}

function normalizeNote(note) {
  const trimmed = typeof note === 'string' ? note.trim() : '';
  if (trimmed.length > 500) {
    return null;
  }
  return trimmed;
}

function addPaymentToDoc(doc, input, { fullBalance = false, now }) {
  if (!isInvoice(doc)) {
    return { ok: false, error: 'notInvoice' };
  }
  const draft = { ...doc };
  const stored = getStoredStatus(draft);
  if (stored === 'draft') {
    return { ok: false, error: 'draft' };
  }
  if (stored === 'refunded' || stored === 'cancelled') {
    return { ok: false, error: 'closed' };
  }
  const balance = getBalanceDue(draft);
  if (balance <= 0) {
    return { ok: false, error: 'nothingDue' };
  }
  const f = getCurrencyFraction(draft);
  const payments = Array.isArray(draft.payments) ? [...draft.payments] : [];
  let id;
  if (input.id == null) {
    id = crypto.randomUUID();
  } else if (typeof input.id !== 'string' || input.id === '') {
    return { ok: false, error: 'amountInvalid' };
  } else {
    id = input.id;
  }
  if (payments.some(p => p && p.id === id)) {
    return { ok: false, error: 'duplicate' };
  }
  if (typeof input.date !== 'number' || !Number.isFinite(input.date)) {
    return { ok: false, error: 'dateRequired' };
  }
  if (input.date > moment(now).endOf('day').valueOf()) {
    return { ok: false, error: 'dateFuture' };
  }
  const MIN_DATE = -8640000000000000;
  const MAX_DATE = 8640000000000000;
  if (input.date < MIN_DATE || input.date > MAX_DATE) {
    return { ok: false, error: 'dateRequired' };
  }
  let amount;
  if (fullBalance) {
    amount = balance;
  } else {
    if (!Number.isFinite(input.amount)) {
      return { ok: false, error: 'amountInvalid' };
    }
    const rounded = roundMoney(input.amount, f);
    const str = String(input.amount);
    const dot = str.indexOf('.');
    const decimals = dot === -1 ? 0 : str.length - dot - 1;
    if (decimals > f) {
      return { ok: false, error: 'tooManyDecimals' };
    }
    amount = rounded;
  }
  if (amount <= 0) {
    return { ok: false, error: 'amountPositive' };
  }
  if (amount > balance) {
    return { ok: false, error: 'overpayment' };
  }
  const note = normalizeNote(input.note);
  if (note === null) {
    return { ok: false, error: 'amountInvalid' };
  }
  let method = input.method;
  if (!PAYMENT_METHODS.includes(method)) {
    method = 'other';
  }
  const payment = {
    id,
    date: input.date,
    amount,
    method,
    note: note ?? '',
  };
  payments.push(payment);
  const newDoc = { ...draft, payments };
  return {
    ok: true,
    doc: reconcilePaymentStatus(newDoc, now),
    payment,
  };
}

function removePaymentFromDoc(doc, paymentId, now) {
  if (!isInvoice(doc)) {
    return { ok: false, error: 'notInvoice' };
  }
  if (!Array.isArray(doc.payments)) {
    return { ok: false, error: 'notFound' };
  }
  const payment = doc.payments.find(p => p && p.id === paymentId);
  if (!payment) {
    return { ok: false, error: 'notFound' };
  }
  const payments = doc.payments.filter(p => !p || p.id !== paymentId);
  const newDoc = { ...doc, payments };
  return {
    ok: true,
    doc: reconcilePaymentStatus(newDoc, now),
    payment,
  };
}

function markDocPaidInFull(doc, now) {
  const stored = getStoredStatus(doc);
  if (stored === 'draft') {
    return { ok: false, error: 'draft' };
  }
  if (stored === 'refunded' || stored === 'cancelled') {
    return { ok: false, error: 'closed' };
  }
  const balance = getBalanceDue(doc);
  if (balance > 0) {
    return addPaymentToDoc(
      doc,
      {
        date: startOfDay(now),
        method: 'other',
        note: '',
      },
      { fullBalance: true, now }
    );
  }
  if (stored === 'paid') {
    return { ok: false, error: 'nothingDue' };
  }
  return { ok: true, doc: withStatus(doc, 'paid', now) };
}

function setDocStatus(doc, status, now) {
  if (!isInvoice(doc)) {
    return { ok: false, error: 'notInvoice' };
  }
  if (status === 'paid') {
    return markDocPaidInFull(doc, now);
  }
  if (status === 'draft' && getPayments(doc).length > 0) {
    return { ok: false, error: 'draftWithPayments' };
  }
  if (status === 'pending' && getStoredStatus(doc) === 'paid') {
    const f = getCurrencyFraction(doc);
    const total = roundMoney(getInvoiceTotal(doc), f);
    const paid = getAmountPaid(doc);
    if (Array.isArray(doc.payments) && paid >= total && total >= 0) {
      return { ok: true, doc, stillPaid: true };
    }
  }
  const next = reconcilePaymentStatus(withStatus(doc, status, now), now);
  const stillPaid = status === 'pending' && getStoredStatus(next) === 'paid';
  return { ok: true, doc: next, stillPaid };
}

function getPaymentEditErrors(newDoc, editData) {
  const hasPaymentArray = Array.isArray(editData.payments);
  const legacyPaid = !hasPaymentArray && getStoredStatus(editData) === 'paid';
  if (!hasPaymentArray && !legacyPaid) {
    return [];
  }
  const f = getCurrencyFraction(editData);
  const origCode = editData.currency?.code;
  const origFraction = getCurrencyFraction(editData);
  const newCode = newDoc.currency?.code;
  const newFraction = getCurrencyFraction(newDoc);
  const errors = [];
  if (origCode !== newCode || origFraction !== newFraction) {
    errors.push({ key: 'form:errors:currencyLocked' });
  }
  if (legacyPaid && !hasPaymentArray) {
    const settled = roundMoney(getInvoiceTotal(editData), f);
    const newTotal = roundMoney(getInvoiceTotal(newDoc), f);
    if (newTotal !== settled) {
      errors.push({
        key: 'form:errors:totalBelowPaid',
        values: { total: newTotal, paid: settled },
      });
    }
    return errors;
  }
  const paidFromEdit = getAmountPaid({
    ...newDoc,
    payments: editData.payments,
  });
  if (roundMoney(getInvoiceTotal(newDoc), f) < paidFromEdit) {
    errors.push({
      key: 'form:errors:totalBelowPaid',
      values: {
        total: roundMoney(getInvoiceTotal(newDoc), f),
        paid: paidFromEdit,
      },
    });
  }
  return errors;
}

function getPaymentEvents(invoice) {
  const stored = getStoredStatus(invoice);
  if (stored !== 'pending' && stored !== 'paid') {
    return [];
  }
  if (Array.isArray(invoice.payments)) {
    return getPayments(invoice).map(p => ({
      date: p.date,
      amount: p.amount,
    }));
  }
  if (stored === 'paid') {
    return [
      {
        date: getPaidDate(invoice),
        amount: getInvoiceTotal(invoice),
      },
    ];
  }
  return [];
}

export {
  addPaymentToDoc,
  canRecordPayment,
  formatAmountInput,
  getClearingPaymentDate,
  getPaymentEditErrors,
  getPaymentErrors,
  getPaymentEvents,
  markDocPaidInFull,
  parseMoneyInput,
  reconcilePaymentStatus,
  removePaymentFromDoc,
  setDocStatus,
  startOfDay,
};
