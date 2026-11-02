import moment from 'moment';

import { isCreditNote, isInvoice } from './docType';
import {
  getAmountPaid,
  getBalanceDue,
  getDisplayStatus,
  getDueDate,
  getInvoiceTotals,
  getIssuedAt,
  getStoredStatus,
} from './invoice';

export function escapeCsvField(value, { text } = {}) {
  if (value == null) {
    return '';
  }
  let str = String(value);
  if (text) {
    const first = str.charAt(0);
    if (['=', '+', '-', '@', '\t', '\r'].includes(first)) {
      str = `'${str}`;
    }
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDateLocal(ms) {
  if (ms == null) {
    return '';
  }
  return moment(ms).format('YYYY-MM-DD');
}

function salesDocRows(allSalesDocs) {
  return allSalesDocs.filter(d => {
    if (d?.recurringTombstone) {
      return false;
    }
    return isInvoice(d) || isCreditNote(d);
  });
}

export function buildInvoicesCsv(allSalesDocs, now) {
  const linkedByInvoice = new Map();
  for (const doc of allSalesDocs) {
    if (isCreditNote(doc) && doc.creditedInvoiceId) {
      const list = linkedByInvoice.get(doc.creditedInvoiceId) ?? [];
      list.push(doc);
      linkedByInvoice.set(doc.creditedInvoiceId, list);
    }
  }
  const sorted = [...salesDocRows(allSalesDocs)].sort((a, b) => {
    const at = getIssuedAt(a) ?? a.created_at ?? 0;
    const bt = getIssuedAt(b) ?? b.created_at ?? 0;
    return at - bt;
  });
  const header =
    'number,client,issued,due,status,currency,subtotal,tax,discount,total,amount_paid,balance_due,docType,creditedInvoice';
  const lines = sorted.map(doc => {
    const { subtotal, taxTotal, discount, grandTotal } = getInvoiceTotals(doc);
    const fraction = doc.currency?.fraction ?? 2;
    const fmt = n => Number(n ?? 0).toFixed(fraction);
    if (isCreditNote(doc)) {
      const sign = -1;
      return [
        escapeCsvField(doc.invoiceID || doc._id, { text: true }),
        escapeCsvField(
          doc.recipient?.fullname || doc.recipient?.company || '',
          { text: true }
        ),
        escapeCsvField(formatDateLocal(getIssuedAt(doc) ?? doc.created_at)),
        '',
        escapeCsvField(getStoredStatus(doc)),
        escapeCsvField(doc.currency?.code ?? '', { text: true }),
        fmt(subtotal * sign),
        fmt((taxTotal ?? 0) * sign),
        fmt((discount ?? 0) * sign),
        fmt(grandTotal * sign),
        '',
        '',
        escapeCsvField('creditNote'),
        escapeCsvField(doc.creditedInvoice?.invoiceID ?? '', { text: true }),
      ].join(',');
    }
    const invoice = doc;
    const linked = linkedByInvoice.get(invoice._id) ?? [];
    const due = getDueDate(invoice);
    const display = getDisplayStatus(invoice, now, linked);
    const balanceDue =
      display === 'draft' || display === 'refunded' || display === 'cancelled'
        ? ''
        : fmt(getBalanceDue(invoice, linked));
    return [
      escapeCsvField(invoice.invoiceID || invoice._id, { text: true }),
      escapeCsvField(
        invoice.recipient?.fullname || invoice.recipient?.company || '',
        { text: true }
      ),
      escapeCsvField(
        formatDateLocal(getIssuedAt(invoice) ?? invoice.created_at)
      ),
      escapeCsvField(due != null ? formatDateLocal(due) : ''),
      escapeCsvField(display),
      escapeCsvField(invoice.currency?.code ?? '', { text: true }),
      fmt(subtotal),
      fmt(taxTotal ?? 0),
      fmt(discount ?? 0),
      fmt(grandTotal),
      fmt(getAmountPaid(invoice)),
      balanceDue,
      escapeCsvField('invoice'),
      '',
    ].join(',');
  });
  return `\uFEFF${header}\r\n${lines.join('\r\n')}\r\n`;
}
