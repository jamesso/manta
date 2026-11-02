import { UNIT_CODES } from '../constants/units';
import { getDocType } from './docType';
import {
  getAmountPaid,
  getDueDate,
  getInvoiceTotals,
  getIssuedAt,
} from './invoice';
import { getSellerTaxIds } from './tax';
import { cents } from '../../helpers/einvoice/money.js';

const MAX_ROWS = 500;
const MAX_TEXT = 10_000;
const PRICE_SCALE = 10_000;

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

function taxGroupMultisetSignature(groups) {
  return (groups ?? [])
    .map(
      g =>
        `${taxGroupKey(g)}\0${cents(g.base ?? 0)}\0${cents(g.amount ?? 0)}`
    )
    .sort()
    .join('\n');
}

function priceWithinFourDecimals(price) {
  const n = Number(price);
  if (!Number.isFinite(n)) {
    return false;
  }
  return Math.abs(n * PRICE_SCALE - Math.round(n * PRICE_SCALE)) < 1e-8;
}

function linePriceQuantityCentsMatch(price, quantity) {
  const p = Number(price);
  const q = Number(quantity);
  if (!Number.isFinite(p) || !Number.isFinite(q)) {
    return false;
  }
  const roundedPrice = Math.round(p * PRICE_SCALE) / PRICE_SCALE;
  return cents(p * q) === cents(roundedPrice * q);
}

function totalsMatch(recomputed, derivedTotals) {
  if (!derivedTotals || derivedTotals.mode !== 'line') {
    return false;
  }
  if (recomputed.mode !== 'line') {
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
  return (
    taxGroupMultisetSignature(recomputed.taxBreakdown) ===
    taxGroupMultisetSignature(derivedTotals.taxBreakdown)
  );
}

function sameOptionalMs(a, b) {
  const left = a == null ? null : Number(a);
  const right = b == null ? null : Number(b);
  if (left === null && right === null) {
    return true;
  }
  if (left === null || right === null) {
    return false;
  }
  return Number.isFinite(left) && Number.isFinite(right) && left === right;
}

function expectedSellerTax(invoice, profile, invoiceSettings) {
  if (invoice.seller && typeof invoice.seller === 'object') {
    return {
      taxId: String(invoice.seller.taxId ?? '').trim(),
      vatId: String(invoice.seller.vatId ?? '').trim(),
    };
  }
  return getSellerTaxIds(profile, invoiceSettings);
}

function precedingMatches(invoice, derived) {
  if (getDocType(invoice) !== 'creditNote') {
    return true;
  }
  const ref = invoice.creditedInvoice;
  if (!ref) {
    return derived.preceding == null;
  }
  const expectedNumber = String(ref.invoiceID ?? '').trim();
  const expectedIssued = ref.issuedAt ?? null;
  const d = derived.preceding ?? {};
  if (String(d.number ?? '').trim() !== expectedNumber) {
    return false;
  }
  return sameOptionalMs(d.issuedAt, expectedIssued);
}

/**
 * Pure integrity check for IPC export payloads. Returns an error code or null if OK.
 */
export function validateEInvoiceExportPayload(
  invoice,
  derived,
  { profile = {}, invoiceSettings = {} } = {}
) {
  if (!invoice || typeof invoice !== 'object') {
    return 'invalid-invoice';
  }
  if (!derived || typeof derived !== 'object') {
    return 'invalid-derived';
  }
  if (hasOversizedText(invoice)) {
    return 'text-too-long';
  }

  if (derived.docType !== getDocType(invoice)) {
    return 'derived-doc-type-mismatch';
  }
  if (derived.status !== invoice.status) {
    return 'derived-status-mismatch';
  }

  const expectedTax = expectedSellerTax(invoice, profile, invoiceSettings);
  const derivedTax = derived.seller ?? {};
  if (
    String(derivedTax.taxId ?? '').trim() !== expectedTax.taxId ||
    String(derivedTax.vatId ?? '').trim() !== expectedTax.vatId
  ) {
    return 'derived-seller-mismatch';
  }

  if (!precedingMatches(invoice, derived)) {
    return 'derived-preceding-mismatch';
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
    if (!priceWithinFourDecimals(p)) {
      return 'invalid-price-precision';
    }
    if (!linePriceQuantityCentsMatch(p, q)) {
      return 'invalid-price-precision';
    }
    const unit = row.unitCode;
    if (unit != null && String(unit).trim() !== '') {
      if (!UNIT_CODES.includes(String(unit).trim())) {
        return 'invalid-unit-code';
      }
    }
  }

  const currencyCode = String(invoice.currency?.code ?? '').trim();
  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    return 'invalid-currency';
  }

  const expectedIssued = getIssuedAt(invoice);
  if (!Number.isFinite(expectedIssued)) {
    return 'invalid-issue-date';
  }
  if (
    !Number.isFinite(derived.issuedAt) ||
    derived.issuedAt !== expectedIssued
  ) {
    return 'derived-issue-date-mismatch';
  }

  if (getDocType(invoice) === 'invoice') {
    if (!sameOptionalMs(derived.dueAt, getDueDate(invoice))) {
      return 'derived-due-date-mismatch';
    }
  }

  const recomputed = getInvoiceTotals(invoice);

  for (const line of recomputed.lines ?? []) {
    if (cents(line?.net ?? 0) < 0) {
      return 'negative-line-net';
    }
  }
  if (cents(recomputed.grandTotal) < 0) {
    return 'negative-grand-total';
  }

  const storedSubtotal = Number(invoice.subtotal);
  if (
    Number.isFinite(storedSubtotal) &&
    cents(storedSubtotal) !== cents(recomputed.subtotal)
  ) {
    return 'stored-total-mismatch';
  }
  const storedGrand = Number(invoice.grandTotal);
  if (
    Number.isFinite(storedGrand) &&
    cents(storedGrand) !== cents(recomputed.grandTotal)
  ) {
    return 'stored-total-mismatch';
  }

  if (recomputed.mode !== 'line' && derived.totals?.mode === 'line') {
    return 'derived-total-mismatch';
  }
  if (recomputed.mode === 'line') {
    if (!totalsMatch(recomputed, derived.totals)) {
      return 'derived-total-mismatch';
    }
  }

  const docType = getDocType(invoice);
  const recomputedPaid = docType === 'invoice' ? getAmountPaid(invoice) : 0;
  const derivedPaid = docType === 'invoice' ? Number(derived.amountPaid) || 0 : 0;
  if (cents(recomputedPaid) !== cents(derivedPaid)) {
    return 'derived-paid-mismatch';
  }

  return null;
}

export { taxGroupMultisetSignature, priceWithinFourDecimals, linePriceQuantityCentsMatch };
