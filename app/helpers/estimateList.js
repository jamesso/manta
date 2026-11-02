import { ESTIMATE_TABS, ESTIMATE_SORT_RANK } from '../constants/estimates';
import {
  findConvertedInvoice,
  canConvert as estimateCanConvert,
  getValidInDays,
} from './estimate';
import {
  formatInvoiceAmount,
  getDisplayStatus,
  getInvoiceNumber,
  getIssuedAt,
} from './invoice';
import { matchesSearch } from './invoiceList';

export { matchesSearch };

export function matchesEstimateTab(display, tab) {
  return tab === 'all' || display === tab;
}

export function toEstimateRow(e, now = Date.now(), index) {
  const displayStatus = getDisplayStatus(e, now);
  const recipient = e.recipient || {};
  const convertedInvoice = index ? findConvertedInvoice(e, index) : null;
  return {
    id: e._id,
    invoice: e,
    number: getInvoiceNumber(e),
    client: recipient.fullname || recipient.company || '',
    issuedAt: getIssuedAt(e),
    validUntil: e.validUntil ?? null,
    validInDays: getValidInDays(e, now),
    displayStatus,
    amount: e.grandTotal ?? 0,
    amountText: formatInvoiceAmount(e),
    convertedInvoice,
    canConvert: index ? estimateCanConvert(e, index) : false,
  };
}

export function countByEstimateTab(rows) {
  const counts = {};
  for (const tab of ESTIMATE_TABS) {
    counts[tab] =
      tab === 'all'
        ? rows.length
        : rows.filter(r => matchesEstimateTab(r.displayStatus, tab)).length;
  }
  return counts;
}

export { ESTIMATE_SORT_RANK, ESTIMATE_TABS };
