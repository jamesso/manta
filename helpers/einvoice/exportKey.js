import { getDocType } from '../../app/helpers/docType.js';
import { resolveProfile } from './toEn16931.js';

function stableValue(value) {
  if (value == null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = stableValue(value[key]);
      return acc;
    }, {});
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Fingerprint of invoice + resolved seller profile fields that affect the print preview.
 */
export function exportKey(invoice, profile) {
  if (!invoice?._id) {
    return '';
  }
  const resolved = resolveProfile(invoice, { profile: profile ?? {} });
  const material = stableValue({
    id: invoice._id,
    docType: getDocType(invoice),
    invoiceID: invoice.invoiceID,
    status: invoice.status,
    rows: invoice.rows,
    discount: invoice.discount,
    tax: invoice.tax,
    taxMode: invoice.taxMode,
    taxCalc: invoice.taxCalc,
    currency: invoice.currency,
    recipient: invoice.recipient,
    configs: invoice.configs,
    note: invoice.note,
    seller: invoice.seller,
    creditedInvoice: invoice.creditedInvoice,
    payments: invoice.payments,
    paidAt: invoice.paidAt,
    dueDate: invoice.dueDate,
    profile: {
      legalName: resolved.legalName,
      fullname: resolved.fullname,
      company: resolved.company,
      email: resolved.email,
      phone: resolved.phone,
      address: resolved.address,
      postalAddress: resolved.postalAddress,
      bank: resolved.bank,
      taxId: resolved.taxId,
      vatId: resolved.vatId,
    },
  });
  return hashString(JSON.stringify(material));
}

export const EINVOICE_PREVIEW_READY_SCRIPT = `(() => {
  const el = document.querySelector('.print-area');
  if (!el) return null;
  const id = el.getAttribute('data-invoice-id');
  const key = el.getAttribute('data-export-key');
  if (!id || !key) return null;
  if (document.fonts && document.fonts.status !== 'loaded') return null;
  return { id, key };
})()`;
