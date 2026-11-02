import {
  formatInvoiceAmount,
  getAmountPaid,
  getBalanceDue,
  getDisplayStatus,
  getDueDate,
  getDueInDays,
  getInvoiceNumber,
  getIssuedAt,
  getStoredStatus,
} from './invoice';

export const INVOICE_TABS = [
  'all',
  'draft',
  'outstanding',
  'overdue',
  'paid',
  'closed',
  'creditNotes',
];

export const STATUS_SORT_RANK = {
  overdue: 0,
  partial: 1,
  pending: 2,
  draft: 3,
  paid: 4,
  refunded: 5,
  cancelled: 6,
  issued: 4,
  void: 6,
};

function matchesTab(row, tab) {
  if (row.docType === 'creditNote') {
    return tab === 'creditNotes';
  }
  if (tab === 'creditNotes') {
    return false;
  }
  switch (tab) {
    case 'all':
      return true;
    case 'draft':
      return row.displayStatus === 'draft';
    case 'outstanding':
      return row.displayStatus === 'pending' || row.displayStatus === 'partial';
    case 'overdue':
      return row.displayStatus === 'overdue';
    case 'paid':
      return row.displayStatus === 'paid';
    case 'closed':
      return (
        row.displayStatus === 'refunded' || row.displayStatus === 'cancelled'
      );
    default:
      return false;
  }
}

function toInvoiceRow(invoice, now = Date.now(), creditNotes = []) {
  const linked = creditNotes.filter(cn => cn.creditedInvoiceId === invoice._id);
  const displayStatus = getDisplayStatus(invoice, now, linked);
  const dueAt = getDueDate(invoice);
  const recipient = invoice.recipient || {};
  return {
    id: invoice._id,
    docType: 'invoice',
    invoice,
    number: getInvoiceNumber(invoice),
    client: recipient.fullname || recipient.company || '',
    issuedAt: getIssuedAt(invoice),
    dueAt,
    dueInDays: getDueInDays(invoice, now),
    displayStatus,
    amount: invoice.grandTotal ?? 0,
    amountText: formatInvoiceAmount(invoice),
    amountPaid: getAmountPaid(invoice),
    balance: getBalanceDue(invoice, linked),
  };
}

function toCreditNoteRow(cn, invoicesById) {
  const recipient = cn.recipient || {};
  return {
    id: cn._id,
    docType: 'creditNote',
    doc: cn,
    invoice: cn,
    number: getInvoiceNumber(cn),
    client: recipient.fullname || recipient.company || '',
    issuedAt: getIssuedAt(cn),
    creditedNumber: cn.creditedInvoice?.invoiceID ?? '',
    creditedId: cn.creditedInvoiceId ?? '',
    displayStatus: getStoredStatus(cn),
    amount: cn.grandTotal ?? 0,
    amountText: formatInvoiceAmount(cn),
  };
}

function countByTab(rows) {
  const counts = {
    all: rows.filter(r => r.docType !== 'creditNote').length,
    draft: 0,
    outstanding: 0,
    overdue: 0,
    paid: 0,
    closed: 0,
    creditNotes: 0,
  };
  for (const row of rows) {
    if (row.docType === 'creditNote') {
      if (matchesTab(row, 'creditNotes')) {
        counts.creditNotes += 1;
      }
      continue;
    }
    if (matchesTab(row, 'draft')) counts.draft += 1;
    if (matchesTab(row, 'outstanding')) counts.outstanding += 1;
    if (matchesTab(row, 'overdue')) counts.overdue += 1;
    if (matchesTab(row, 'paid')) counts.paid += 1;
    if (matchesTab(row, 'closed')) counts.closed += 1;
  }
  return counts;
}

function matchesSearch(row, query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  const doc = row.invoice ?? row.doc;
  const { number, amountText } = row;
  const recipient = doc?.recipient || {};
  const haystack = [
    number,
    row.creditedNumber,
    recipient.fullname,
    recipient.company,
    recipient.email,
    amountText,
    amountText.replace(/\D/g, ''),
  ]
    .filter(Boolean)
    .map(s => String(s).toLowerCase());
  return haystack.some(s => s.includes(q));
}

export { countByTab, matchesSearch, matchesTab, toCreditNoteRow, toInvoiceRow };
