import {
  formatInvoiceAmount,
  getAmountPaid,
  getBalanceDue,
  getDisplayStatus,
  getDueDate,
  getDueInDays,
  getInvoiceNumber,
  getIssuedAt,
} from './invoice';

export const INVOICE_TABS = [
  'all',
  'draft',
  'outstanding',
  'overdue',
  'paid',
  'closed',
];

export const STATUS_SORT_RANK = {
  overdue: 0,
  partial: 1,
  pending: 2,
  draft: 3,
  paid: 4,
  refunded: 5,
  cancelled: 6,
};

function matchesTab(displayStatus, tab) {
  switch (tab) {
    case 'all':
      return true;
    case 'draft':
      return displayStatus === 'draft';
    case 'outstanding':
      return displayStatus === 'pending' || displayStatus === 'partial';
    case 'overdue':
      return displayStatus === 'overdue';
    case 'paid':
      return displayStatus === 'paid';
    case 'closed':
      return displayStatus === 'refunded' || displayStatus === 'cancelled';
    default:
      return false;
  }
}

function toInvoiceRow(invoice, now = Date.now()) {
  const displayStatus = getDisplayStatus(invoice, now);
  const dueAt = getDueDate(invoice);
  const recipient = invoice.recipient || {};
  return {
    id: invoice._id,
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
    balance: getBalanceDue(invoice),
  };
}

function countByTab(rows) {
  const counts = {
    all: rows.length,
    draft: 0,
    outstanding: 0,
    overdue: 0,
    paid: 0,
    closed: 0,
  };
  for (const row of rows) {
    if (matchesTab(row.displayStatus, 'draft')) counts.draft += 1;
    if (matchesTab(row.displayStatus, 'outstanding')) counts.outstanding += 1;
    if (matchesTab(row.displayStatus, 'overdue')) counts.overdue += 1;
    if (matchesTab(row.displayStatus, 'paid')) counts.paid += 1;
    if (matchesTab(row.displayStatus, 'closed')) counts.closed += 1;
  }
  return counts;
}

function matchesSearch(row, query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  const { invoice, number, amountText } = row;
  const recipient = invoice.recipient || {};
  const haystack = [
    number,
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

export { countByTab, matchesSearch, matchesTab, toInvoiceRow };
