import moment from 'moment';

import i18n from '../../i18n/i18n';
import { formatNumber } from '../../helpers/formatNumber';
import { fillTemplate, isValidEmail } from '../../helpers/email';
import {
  formatInvoiceAmount,
  getBalanceDue,
  getDisplayStatus,
  getDueDate,
  getInvoiceNumber,
  getStoredStatus,
} from './invoice';
import { getDocType } from './docType';

export const TEMPLATE_KEYS = {
  invoice: 'emailTemplate',
  reminder: 'reminderTemplate',
};

function formatBalanceAmount(invoice, amount, allSalesDocs) {
  const balance = getBalanceDue(invoice, allSalesDocs);
  const value = Number.isFinite(amount) ? amount : balance;
  const currency = invoice.currency;
  if (!currency) {
    return formatNumber(value, 2);
  }
  const formatted = formatNumber(value, currency.fraction, currency.separator);
  if (currency.placement === 'before') {
    return `${currency.code} ${formatted}`;
  }
  return `${formatted} ${currency.code}`;
}

export function getEmailTemplate(invoiceSettings, kind, t = i18n.t) {
  const key = TEMPLATE_KEYS[kind];
  const stored = invoiceSettings?.[key];
  const pick = field => {
    const raw = stored?.[field];
    if (typeof raw !== 'string' || raw.trim() === '') {
      return {
        value: t(`email:defaults:${kind}:${field}`),
        isDefault: true,
      };
    }
    return { value: raw, isDefault: false };
  };
  const subject = pick('subject');
  const body = pick('body');
  return {
    subject: subject.value,
    body: body.value,
    isDefault: subject.isDefault && body.isDefault,
    subjectIsDefault: subject.isDefault,
    bodyIsDefault: body.isDefault,
  };
}

export function getEmailVars(
  invoice,
  { profile, dateFormat, t, allSalesDocs = [] }
) {
  const recipient = invoice.recipient || {};
  const dueMs = getDueDate(invoice);
  return {
    number: getInvoiceNumber(invoice),
    client: recipient.fullname || recipient.company || '',
    total: formatInvoiceAmount(invoice),
    balance: formatBalanceAmount(invoice, undefined, allSalesDocs),
    dueDate:
      dueMs == null
        ? t('email:vars:noDueDate')
        : moment(dueMs).format(dateFormat),
    company: profile?.company || profile?.fullname || '',
  };
}

export function buildEmailDraft(
  invoice,
  kind,
  { to, invoiceSettings, profile, t, allSalesDocs, dateFormat }
) {
  const template = getEmailTemplate(invoiceSettings, kind, t);
  const vars = getEmailVars(invoice, {
    profile,
    dateFormat: dateFormat ?? invoice.configs?.dateFormat ?? 'MM/DD/YYYY',
    t,
    allSalesDocs,
  });
  return {
    to,
    subject: fillTemplate(template.subject, vars),
    body: fillTemplate(template.body, vars),
  };
}

export function resolveRecipient(invoice, contacts) {
  const contact = contacts.find(c => c._id === invoice.recipient?._id) ?? null;
  const candidates = [contact?.email, invoice.recipient?.email];
  for (const raw of candidates) {
    if (typeof raw !== 'string') {
      continue;
    }
    const trimmed = raw.trim();
    if (isValidEmail(trimmed)) {
      return { email: trimmed, contact };
    }
  }
  return { email: '', contact };
}

export function canEmail(invoice) {
  if (!invoice || typeof invoice !== 'object') {
    return false;
  }
  if (getDocType(invoice) !== 'invoice') {
    return false;
  }
  if (!invoice._id || !invoice.invoiceID) {
    return false;
  }
  const status = getStoredStatus(invoice);
  return status !== 'draft' && status !== 'cancelled' && status !== 'refunded';
}

export function canSendReminder(invoice, now, allSalesDocs = []) {
  return (
    canEmail(invoice) &&
    getDisplayStatus(invoice, now, allSalesDocs) === 'overdue'
  );
}

export function withSentMark(doc, kind, now) {
  if (kind === 'invoice') {
    if (!canEmail(doc)) {
      throw new Error('cannot-mark-sent');
    }
    return { ...doc, sentAt: now };
  }
  if (kind === 'reminder') {
    if (!canEmail(doc)) {
      throw new Error('cannot-mark-sent');
    }
    return { ...doc, remindedAt: now };
  }
  throw new Error('invalid-kind');
}
