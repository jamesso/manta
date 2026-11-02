import {
  getAmountPaid,
  getDueDate,
  getIssuedAt,
  getInvoiceTotals,
} from './invoice';
import { getDocType } from './docType';
import { getSellerTaxIds } from './tax';
import { resolveProfile } from '../../helpers/einvoice/toEn16931.js';

export function resolveProfileForDocument(invoice, profile) {
  return resolveProfile(invoice, { profile });
}

export function getEInvoiceDerived(invoice, { profile, invoiceSettings, lang }) {
  const docType = getDocType(invoice);
  return {
    docType,
    status: invoice.status,
    issuedAt: getIssuedAt(invoice),
    dueAt: getDueDate(invoice),
    amountPaid: docType === 'invoice' ? getAmountPaid(invoice) : 0,
    totals: getInvoiceTotals(invoice),
    seller: invoice.seller ?? getSellerTaxIds(profile, invoiceSettings),
    preceding: invoice.creditedInvoice
      ? {
          number: invoice.creditedInvoice.invoiceID,
          issuedAt: invoice.creditedInvoice.issuedAt,
        }
      : null,
    lang: lang ?? 'en',
  };
}

export function mergeRecipientFromContact(recipient, contact) {
  const base = { ...recipient };
  if (!contact) {
    return base;
  }
  const copyIf = (key, val) => {
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      base[key] = val;
    }
  };
  if (contact.postalAddress && typeof contact.postalAddress === 'object') {
    base.postalAddress = { ...contact.postalAddress };
  }
  copyIf('buyerReference', contact.buyerReference);
  copyIf('taxId', contact.taxId);
  return base;
}
