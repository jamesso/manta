import moment from 'moment';

import {
  getAmountPaid,
  getBalanceDue,
  getDisplayStatus,
  getDueDate,
  getInvoiceTotals,
  getIssuedAt,
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

export function buildInvoicesCsv(invoices, now) {
  const sorted = [...invoices].sort((a, b) => {
    const at = getIssuedAt(a) ?? a.created_at ?? 0;
    const bt = getIssuedAt(b) ?? b.created_at ?? 0;
    return at - bt;
  });
  const header =
    'number,client,issued,due,status,currency,subtotal,tax,discount,total,amount_paid,balance_due';
  const lines = sorted.map(invoice => {
    const { subtotal, taxTotal, discount, grandTotal } =
      getInvoiceTotals(invoice);
    const fraction = invoice.currency?.fraction ?? 2;
    const fmt = n => Number(n ?? 0).toFixed(fraction);
    const due = getDueDate(invoice);
    const display = getDisplayStatus(invoice, now);
    const balanceDue =
      display === 'draft' || display === 'refunded' || display === 'cancelled'
        ? ''
        : fmt(getBalanceDue(invoice));
    const fields = [
      escapeCsvField(invoice.invoiceID || invoice._id, { text: true }),
      escapeCsvField(
        invoice.recipient?.fullname || invoice.recipient?.company || '',
        { text: true }
      ),
      escapeCsvField(
        formatDateLocal(getIssuedAt(invoice) ?? invoice.created_at)
      ),
      escapeCsvField(due != null ? formatDateLocal(due) : ''),
      escapeCsvField(getDisplayStatus(invoice, now)),
      escapeCsvField(invoice.currency?.code ?? '', { text: true }),
      fmt(subtotal),
      fmt(taxTotal ?? 0),
      fmt(discount ?? 0),
      fmt(grandTotal),
      fmt(getAmountPaid(invoice)),
      balanceDue,
    ];
    return fields.join(',');
  });
  return `\uFEFF${header}\r\n${lines.join('\r\n')}\r\n`;
}
