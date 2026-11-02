import { getDocType } from '../../app/helpers/docType.js';
import { getIssuedAt } from '../../app/helpers/invoice.js';
import { resolveProfile } from './toEn16931.js';
import { sha256Hex } from './sha256.js';

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

/**
 * Fingerprint of invoice + live preview configs + resolved seller profile for print.
 */
export function exportKey(invoice, profile, previewConfigs) {
  if (!invoice?._id) {
    return '';
  }
  const resolved = resolveProfile(invoice, { profile: profile ?? {} });
  const material = stableValue({
    id: invoice._id,
    docType: getDocType(invoice),
    invoiceID: invoice.invoiceID,
    status: invoice.status,
    issuedAt: getIssuedAt(invoice),
    created_at: invoice.created_at ?? null,
    rows: invoice.rows,
    subtotal: invoice.subtotal,
    grandTotal: invoice.grandTotal,
    discount: invoice.discount,
    tax: invoice.tax,
    taxMode: invoice.taxMode,
    taxCalc: invoice.taxCalc,
    currency: invoice.currency,
    recipient: invoice.recipient,
    configs: previewConfigs ?? invoice.configs,
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
      logo: profile?.logo ?? null,
    },
  });
  return sha256Hex(JSON.stringify(material));
}

export const EINVOICE_PREVIEW_READY_SCRIPT = `(() => {
  const el = document.querySelector('.print-area');
  if (!el) return null;
  const id = el.getAttribute('data-invoice-id');
  const key = el.getAttribute('data-export-key');
  if (!id || !key) return null;
  if (document.fonts && document.fonts.status !== 'loaded') return null;
  const imgs = el.querySelectorAll('img');
  for (let i = 0; i < imgs.length; i += 1) {
    if (!imgs[i].complete) return null;
  }
  window.__mantaExportFrozenCount = (window.__mantaExportFrozenCount || 0) + 1;
  window.__mantaExportFrozen = true;
  return { id, key };
})()`;

export const EINVOICE_PREVIEW_UNFREEZE_SCRIPT = `(() => {
  window.__mantaExportFrozenCount = Math.max(0, (window.__mantaExportFrozenCount || 0) - 1);
  if (window.__mantaExportFrozenCount === 0) {
    window.__mantaExportFrozen = false;
  }
})()`;
