import { UNIT_CODES } from '../constants/units';
import { getDocType } from './docType';
import { getAmountPaid, getInvoiceTotals, getIssuedAt } from './invoice';
import { cents } from '../../helpers/einvoice/money.js';

const MAX_ROWS = 500;
const MAX_TEXT = 10_000;

function textTooLong(value) {
  return typeof value === 'string' && value.length > MAX_TEXT;
}

function hasOversizedText(value, depth = 0) {
  if (depth > 8 || value == null) {
    return false;
  }
  if (typeof value === 'string') {
    return textTooLong(value);
  }
  if (Array.isArray(value)) {
    return value.some(item => hasOversizedText(item, depth + 1));
  }
  if (typeof value === 'object') {
    return Object.values(value).some(item => hasOversizedText(item, depth + 1));
  }
  return false;
}

function taxGroupKey(g) {
  return `${g.category ?? 'S'}\0${Number(g.rate) || 0}`;
}

function totalsMatch(recomputed, derivedTotals) {
  if (!derivedTotals || derivedTotals.mode !== 'line') {
    return false;
  }
  if (cents(recomputed.subtotal) !== cents(derivedTotals.subtotal)) {
    return false;
  }
  if (cents(recomputed.discount) !== cents(derivedTotals.discount)) {
    return false;
  }
  if (cents(recomputed.taxTotal) !== cents(derivedTotals.taxTotal)) {
    return false;
  }
  if (cents(recomputed.grandTotal) !== cents(derivedTotals.grandTotal)) {
    return false;
  }
  const rLines = recomputed.lines ?? [];
  const dLines = derivedTotals.lines ?? [];
  if (rLines.length !== dLines.length) {
    return false;
  }
  for (let i = 0; i < rLines.length; i += 1) {
    if (cents(rLines[i]?.net ?? 0) !== cents(dLines[i]?.net ?? 0)) {
      return false;
    }
  }
  const rGroups = new Map(
    (recomputed.taxBreakdown ?? []).map(g => [taxGroupKey(g), g])
  );
  for (const g of derivedTotals.taxBreakdown ?? []) {
    const r = rGroups.get(taxGroupKey(g));
    if (!r) {
      return false;
    }
    if (cents(r.base) !== cents(g.base) || cents(r.amount) !== cents(g.amount)) {
      return false;
    }
  }
  return true;
}

/**
 * Pure integrity check for IPC export payloads. Returns an error code or null if OK.
 */
export function validateEInvoiceExportPayload(invoice, derived) {
  if (!invoice || typeof invoice !== 'object') {
    return 'invalid-invoice';
  }
  if (!derived || typeof derived !== 'object') {
    return 'invalid-derived';
  }
  if (hasOversizedText(invoice)) {
    return 'text-too-long';
  }

  const rows = Array.isArray(invoice.rows) ? invoice.rows : [];
  if (rows.length > MAX_ROWS) {
    return 'too-many-rows';
  }

  for (const row of rows) {
    const q = Number(row.quantity);
    const p = Number(row.price);
    if (!Number.isFinite(q) || q <= 0 || !Number.isInteger(q)) {
      return 'invalid-quantity';
    }
    if (!Number.isFinite(p) || p < 0) {
      return 'invalid-price';
    }
    const unit = row.unitCode;
    if (unit != null && String(unit).trim() !== '') {
      if (!UNIT_CODES.includes(String(unit).trim())) {
        return 'invalid-unit-code';
      }
    }
  }

  const currencyCode = String(invoice.currency?.code ?? '').trim();
  if (!/^[A-Za-z]{3}$/.test(currencyCode)) {
    return 'invalid-currency';
  }

  const issuedAt = derived.issuedAt ?? getIssuedAt(invoice);
  if (!Number.isFinite(issuedAt)) {
    return 'invalid-issue-date';
  }

  const recomputed = getInvoiceTotals(invoice);
  if (!totalsMatch(recomputed, derived.totals)) {
    return 'derived-total-mismatch';
  }

  const docType = getDocType(invoice);
  const recomputedPaid = docType === 'invoice' ? getAmountPaid(invoice) : 0;
  const derivedPaid = docType === 'invoice' ? Number(derived.amountPaid) || 0 : 0;
  if (cents(recomputedPaid) !== cents(derivedPaid)) {
    return 'derived-paid-mismatch';
  }

  return null;
}
