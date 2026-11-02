import { COUNTRY_CODES, SUPPORTED_CATEGORIES } from './codes.js';
import {
  isValidBic,
  isValidIban,
  leitwegCheck,
  looksLikeVatId,
} from './identifiers.js';
import { cents, round2 } from './money.js';

function push(issues, entry) {
  issues.push(entry);
}

function hasCategory(rows, cat) {
  return (rows ?? []).some(r => (r.taxCategory ?? 'S') === cat);
}

function decimalPlaces(n) {
  const s = String(n);
  const i = s.indexOf('.');
  return i === -1 ? 0 : s.length - i - 1;
}

export function getEInvoiceIssues(model, { format, invoice, derived } = {}) {
  const issues = [];
  const fmt = format ?? 'xrechnung-ubl';
  const isXrechnung = fmt === 'xrechnung-ubl';
  const docType = derived?.docType;
  const status = derived?.status ?? invoice?.status;
  const rows = invoice?.rows ?? [];
  const totals = derived?.totals ?? model?.totals;
  const fraction = invoice?.currency?.fraction ?? 2;

  if (docType === 'estimate') {
    push(issues, {
      code: 'DOC_TYPE_UNSUPPORTED',
      severity: 'error',
      rule: '',
      field: 'docType',
      fix: 'invoice',
    });
  }

  if (status === 'draft') {
    push(issues, {
      code: 'NOT_FINAL',
      severity: 'error',
      rule: '',
      field: 'status',
      fix: 'invoice',
    });
  }
  if (docType === 'creditNote' && status !== 'issued') {
    push(issues, {
      code: 'NOT_FINAL',
      severity: 'error',
      rule: '',
      field: 'status',
      fix: 'invoice',
    });
  }

  if (!model.number) {
    push(issues, {
      code: 'NUMBER_MISSING',
      severity: 'error',
      rule: 'BR-02',
      field: 'number',
      fix: 'invoice',
    });
  }

  if (fraction > 2) {
    push(issues, {
      code: 'CURRENCY_FRACTION_UNSUPPORTED',
      severity: 'error',
      rule: 'BR-DEC',
      field: 'currency',
      fix: 'invoice',
    });
  }

  if (totals?.mode !== 'line' || rows.some(r => !r.taxCategory)) {
    push(issues, {
      code: 'TAX_PER_LINE_REQUIRED',
      severity: 'error',
      rule: 'BR-CO-04',
      field: 'tax',
      fix: 'taxRates',
    });
  }

  for (const row of rows) {
    const cat = row.taxCategory ?? 'S';
    if (cat === 'K' || !SUPPORTED_CATEGORIES.includes(cat)) {
      push(issues, {
        code: 'CATEGORY_NOT_SUPPORTED',
        severity: 'error',
        rule: 'BR-IC',
        field: 'taxCategory',
        fix: 'taxRates',
      });
    }
    const rate = Number(row.taxRate) || 0;
    if (cat === 'S' && rate <= 0) {
      push(issues, {
        code: 'RATE_CATEGORY_MISMATCH',
        severity: 'error',
        rule: 'BR-S-05',
        field: 'taxRate',
        fix: 'taxRates',
      });
    }
    if (cat !== 'S' && rate !== 0) {
      push(issues, {
        code: 'RATE_CATEGORY_MISMATCH',
        severity: 'error',
        rule: 'BR-Z-05',
        field: 'taxRate',
        fix: 'taxRates',
      });
    }
  }

  if (hasCategory(rows, 'O') && rows.some(r => (r.taxCategory ?? 'S') !== 'O')) {
    push(issues, {
      code: 'OUT_OF_SCOPE_MIXED',
      severity: 'error',
      rule: 'BR-O-11',
      field: 'taxCategory',
      fix: 'taxRates',
    });
  }

  for (const g of totals?.taxBreakdown ?? []) {
    const cat = g.category ?? 'S';
    if (['E', 'AE', 'G', 'O'].includes(cat) && !String(g.exemptionReason ?? '').trim()) {
      push(issues, {
        code: 'EXEMPTION_REASON_MISSING',
        severity: 'error',
        rule: 'BR-E-10',
        field: 'exemptionReason',
        fix: 'taxRates',
      });
    }
  }

  if (!model.seller?.name) {
    push(issues, {
      code: 'SELLER_NAME_MISSING',
      severity: 'error',
      rule: 'BR-06',
      field: 'seller.name',
      fix: 'profile',
    });
  }

  const sAddr = model.seller?.address ?? {};
  if (
    !trim(sAddr.street) ||
    !trim(sAddr.postcode) ||
    !trim(sAddr.city)
  ) {
    push(issues, {
      code: 'SELLER_ADDRESS_INCOMPLETE',
      severity: 'error',
      rule: 'BR-08',
      field: 'seller.address',
      fix: 'profile',
    });
  }

  const sCountry = trim(sAddr.countryCode);
  if (!sCountry || !COUNTRY_CODES.includes(sCountry)) {
    push(issues, {
      code: 'SELLER_COUNTRY_MISSING',
      severity: 'error',
      rule: 'BR-09',
      field: 'seller.address.countryCode',
      fix: 'profile',
    });
  }

  const needsSellerTax =
    hasCategory(rows, 'S') || hasCategory(rows, 'Z') || hasCategory(rows, 'E');
  if (
    needsSellerTax &&
    !trim(model.seller?.vatId) &&
    !trim(model.seller?.taxNumber)
  ) {
    push(issues, {
      code: 'SELLER_TAX_ID_MISSING',
      severity: 'error',
      rule: 'BR-S-02',
      field: 'seller.tax',
      fix: 'profile',
    });
  }

  if (
    (hasCategory(rows, 'AE') || hasCategory(rows, 'G')) &&
    !trim(model.seller?.vatId)
  ) {
    push(issues, {
      code: 'SELLER_VAT_ID_REQUIRED',
      severity: 'error',
      rule: 'BR-AE-02',
      field: 'seller.vatId',
      fix: 'profile',
    });
  }

  if (!model.buyer?.name) {
    push(issues, {
      code: 'BUYER_NAME_MISSING',
      severity: 'error',
      rule: 'BR-07',
      field: 'buyer.name',
      fix: 'client',
    });
  }

  const bAddr = model.buyer?.address ?? {};
  const bCountry = trim(bAddr.countryCode);
  if (!bCountry || !COUNTRY_CODES.includes(bCountry)) {
    push(issues, {
      code: 'BUYER_COUNTRY_MISSING',
      severity: 'error',
      rule: 'BR-11',
      field: 'buyer.address.countryCode',
      fix: 'client',
    });
  }

  if (!trim(bAddr.postcode) || !trim(bAddr.city)) {
    push(issues, {
      code: 'BUYER_ADDRESS_INCOMPLETE',
      severity: isXrechnung ? 'error' : 'warning',
      rule: 'BR-DE-8',
      field: 'buyer.address',
      fix: 'client',
    });
  }

  if (hasCategory(rows, 'AE') && !trim(model.buyer?.vatId)) {
    push(issues, {
      code: 'BUYER_VAT_ID_REQUIRED',
      severity: 'error',
      rule: 'BR-AE-03',
      field: 'buyer.vatId',
      fix: 'client',
    });
  }

  const recipientTax = trim(invoice?.recipient?.taxId);
  if (recipientTax && !looksLikeVatId(recipientTax)) {
    push(issues, {
      code: 'BUYER_VAT_ID_FORMAT',
      severity: 'warning',
      rule: '',
      field: 'buyer.vatId',
      fix: 'client',
    });
  }

  const payable = model.totals?.payable ?? 0;
  if (
    model.typeCode === '380' &&
    payable > 0 &&
    !model.dueDate
  ) {
    push(issues, {
      code: 'DUE_DATE_MISSING',
      severity: 'error',
      rule: 'BR-CO-25',
      field: 'dueDate',
      fix: 'invoice',
    });
  }

  if (payable > 0 && !model.payment?.iban) {
    push(issues, {
      code: 'PAYMENT_ACCOUNT_MISSING',
      severity: isXrechnung ? 'error' : 'warning',
      rule: 'BR-DE-1',
      field: 'payment',
      fix: 'bank',
    });
  }

  if (model.payment?.iban && !isValidIban(model.payment.iban)) {
    push(issues, {
      code: 'IBAN_INVALID',
      severity: 'error',
      rule: 'BR-61',
      field: 'payment.iban',
      fix: 'bank',
    });
  }

  const bic = trim(model.payment?.bic);
  if (bic && !isValidBic(bic)) {
    push(issues, {
      code: 'BIC_INVALID',
      severity: 'warning',
      rule: 'BR-61',
      field: 'payment.bic',
      fix: 'bank',
    });
  }

  if (isXrechnung && !trim(model.buyerReference)) {
    push(issues, {
      code: 'BUYER_REFERENCE_MISSING',
      severity: 'error',
      rule: 'BR-DE-15',
      field: 'buyerReference',
      fix: 'client',
    });
  }

  const leitweg = leitwegCheck(model.buyerReference);
  if (leitweg === 'bad-check-digits') {
    push(issues, {
      code: 'LEITWEG_CHECK_DIGITS',
      severity: 'warning',
      rule: '',
      field: 'buyerReference',
      fix: 'client',
    });
  }

  if (isXrechnung) {
    const c = model.seller?.contact ?? {};
    if (!trim(c.name) || !trim(c.phone) || !trim(c.email)) {
      push(issues, {
        code: 'SELLER_CONTACT_INCOMPLETE',
        severity: 'error',
        rule: 'BR-DE-2',
        field: 'seller.contact',
        fix: 'profile',
      });
    }
    if (!trim(model.seller?.electronicAddress) || !trim(model.buyer?.electronicAddress)) {
      push(issues, {
        code: 'ELECTRONIC_ADDRESS_MISSING',
        severity: 'error',
        rule: 'BT-34',
        field: 'electronicAddress',
        fix: 'profile',
      });
    }
  }

  if (model.typeCode === '381' && !model.preceding) {
    push(issues, {
      code: 'CREDIT_NOTE_REFERENCE_MISSING',
      severity: 'warning',
      rule: 'BT-25',
      field: 'preceding',
      fix: 'invoice',
    });
  }

  if (totals && model.totals) {
    const lineSum = round2(
      (model.lines ?? []).reduce((acc, l) => acc + l.net, 0)
    );
    if (cents(lineSum) !== cents(model.totals.subtotal)) {
      push(issues, {
        code: 'ARITHMETIC_MISMATCH',
        severity: 'error',
        rule: 'BR-CO-10',
        field: 'totals.subtotal',
        fix: 'invoice',
      });
    }
    const taxEx = round2(model.totals.subtotal - model.totals.discount);
    if (cents(taxEx) !== cents(model.totals.taxExclusive)) {
      push(issues, {
        code: 'ARITHMETIC_MISMATCH',
        severity: 'error',
        rule: 'BR-CO-13',
        field: 'totals.taxExclusive',
        fix: 'invoice',
      });
    }
    const vatSum = round2(
      (model.vatBreakdown ?? []).reduce((acc, g) => acc + g.amount, 0)
    );
    if (cents(vatSum) !== cents(model.totals.taxTotal)) {
      push(issues, {
        code: 'ARITHMETIC_MISMATCH',
        severity: 'error',
        rule: 'BR-CO-14',
        field: 'totals.taxTotal',
        fix: 'invoice',
      });
    }
    const grand = round2(model.totals.taxExclusive + model.totals.taxTotal);
    if (cents(grand) !== cents(model.totals.grandTotal)) {
      push(issues, {
        code: 'ARITHMETIC_MISMATCH',
        severity: 'error',
        rule: 'BR-CO-15',
        field: 'totals.grandTotal',
        fix: 'invoice',
      });
    }
    for (const g of model.vatBreakdown ?? []) {
      const expected = round2((g.base * g.rate) / 100);
      if (cents(expected) !== cents(g.amount)) {
        push(issues, {
          code: 'ARITHMETIC_MISMATCH',
          severity: 'error',
          rule: 'BR-CO-17',
          field: 'vatBreakdown',
          fix: 'invoice',
        });
        break;
      }
    }
    const moneyFields = [
      model.totals.subtotal,
      model.totals.discount,
      model.totals.taxExclusive,
      model.totals.taxTotal,
      model.totals.grandTotal,
      model.totals.prepaid,
      model.totals.payable,
      ...(model.lines ?? []).map(l => l.net),
      ...(model.vatBreakdown ?? []).flatMap(g => [g.base, g.amount]),
    ];
    if (moneyFields.some(v => decimalPlaces(v) > fraction)) {
      push(issues, {
        code: 'ARITHMETIC_MISMATCH',
        severity: 'error',
        rule: 'BR-DEC',
        field: 'decimals',
        fix: 'invoice',
      });
    }
  }

  return issues;
}

function trim(s) {
  return String(s ?? '').trim();
}
