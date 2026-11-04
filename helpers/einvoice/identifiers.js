const IBAN_RE = /^[A-Z0-9]+$/;
const BIC_RE = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
const VAT_RE = /^[A-Z]{2}[0-9A-Z+*.]{2,12}$/;
const LEITWEG_RE = /^\d{2,12}(-[0-9A-Z]{1,30})?-\d{2}$/;

function ibanMod97(iban) {
  const expanded = iban
    .slice(4)
    .concat(iban.slice(0, 4))
    .replace(/[A-Z]/g, ch => String(ch.charCodeAt(0) - 55));
  let remainder = 0;
  for (let i = 0; i < expanded.length; i += 7) {
    remainder = Number(String(remainder) + expanded.slice(i, i + 7)) % 97;
  }
  return remainder;
}

export function isValidIban(s) {
  const iban = String(s ?? '')
    .replace(/\s+/g, '')
    .toUpperCase();
  if (iban.length < 15 || iban.length > 34 || !IBAN_RE.test(iban)) {
    return false;
  }
  return ibanMod97(iban) === 1;
}

export function isValidBic(s) {
  const bic = String(s ?? '')
    .replace(/\s+/g, '')
    .toUpperCase();
  return BIC_RE.test(bic);
}

export function looksLikeVatId(s) {
  const id = String(s ?? '')
    .replace(/\s+/g, '')
    .toUpperCase();
  return VAT_RE.test(id);
}

function leitwegExpandChar(ch) {
  if (ch >= '0' && ch <= '9') {
    return ch;
  }
  if (ch >= 'A' && ch <= 'Z') {
    return String(ch.charCodeAt(0) - 55);
  }
  return '';
}

function leitwegMod97(body) {
  const expanded = body
    .replace(/-/g, '')
    .split('')
    .map(leitwegExpandChar)
    .join('');
  let remainder = 0;
  for (let i = 0; i < expanded.length; i += 7) {
    remainder = Number(String(remainder) + expanded.slice(i, i + 7)) % 97;
  }
  return remainder;
}

export function leitwegCheck(s) {
  const id = String(s ?? '').trim();
  if (!LEITWEG_RE.test(id)) {
    return 'not-leitweg';
  }
  const parts = id.split('-');
  const checkPart = parts.pop();
  const body = parts.join('-') + '00';
  const computed = 98 - leitwegMod97(body);
  const expected = Number(checkPart);
  if (!Number.isInteger(expected) || computed !== expected) {
    return 'bad-check-digits';
  }
  return 'ok';
}

// The buyer reference (Leitweg-ID) is an e-invoice field: it is on only when
// e-invoicing is on and its own switch is not off (missing means on).
export function isBuyerReferenceOn(invoiceSettings) {
  return (
    invoiceSettings?.eInvoice?.enabled === true &&
    invoiceSettings?.useBuyerReference !== false
  );
}
