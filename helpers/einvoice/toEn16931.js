import moment from 'moment';

import {
  DEFAULT_UNIT,
  PAYMENT_MEANS_SEPA,
  TYPE_CODE,
  VATEX_DEFAULTS,
} from './codes.js';
import { isBuyerReferenceOn, looksLikeVatId } from './identifiers.js';
import { round2 } from './money.js';
import { getSellerTaxIds } from './sellerTax.js';

function trim(s) {
  return String(s ?? '').trim();
}

function resolveProfile(invoice, settings) {
  const base = settings?.profile ?? {};
  const snap = invoice?.seller;
  if (!snap || typeof snap !== 'object') {
    return base;
  }
  const merged = {
    ...base,
    legalName: snap.legalName ?? base.legalName,
    fullname: snap.fullname ?? base.fullname,
    company: snap.company ?? base.company,
    email: snap.email ?? base.email,
    phone: snap.phone ?? base.phone,
    postalAddress: snap.postalAddress ?? base.postalAddress,
    bank: snap.bank ?? base.bank,
    taxId: snap.taxId ?? base.taxId,
    vatId: snap.vatId ?? base.vatId,
  };
  if (Object.hasOwn(snap, 'address')) {
    merged.address = snap.address;
  }
  return merged;
}

function groupLineNetSum(invoice, category, rate, lines) {
  const rows = invoice.rows ?? [];
  let sum = 0;
  rows.forEach((row, i) => {
    const cat = row.taxCategory ?? 'S';
    const r = Number(row.taxRate) || 0;
    if (cat === category && r === rate) {
      sum += lines[i]?.net ?? 0;
    }
  });
  return round2(sum);
}

function sellerTaxIdentity(invoice, settings) {
  if (invoice.seller && typeof invoice.seller === 'object') {
    return {
      taxId: trim(invoice.seller.taxId),
      vatId: trim(invoice.seller.vatId),
    };
  }
  const ids = getSellerTaxIds(settings?.profile, settings?.invoice);
  return { taxId: trim(ids.taxId), vatId: trim(ids.vatId) };
}

export function toEn16931(invoice, settings, derived) {
  const profile = resolveProfile(invoice, settings);
  const recipient = invoice.recipient ?? {};
  const totals = derived.totals;
  const currency = trim(invoice.currency?.code) || 'EUR';
  const docType = derived.docType;
  const typeCode = TYPE_CODE[docType] ?? TYPE_CODE.invoice;
  const hasCategoryO = (invoice.rows ?? []).some(
    r => (r.taxCategory ?? 'S') === 'O'
  );
  const sellerTax = sellerTaxIdentity(invoice, settings);
  const buyerReferenceOn = isBuyerReferenceOn(settings?.invoice);

  const sellerName =
    trim(profile.legalName) || trim(profile.company) || trim(profile.fullname);
  const tradingName =
    trim(profile.company) && trim(profile.company) !== sellerName
      ? trim(profile.company)
      : '';

  const lines = (invoice.rows ?? []).map((row, i) => ({
    id: String(i + 1),
    quantity: Number(row.quantity) || 0,
    unitCode: trim(row.unitCode) || DEFAULT_UNIT,
    net: totals.lines[i]?.net ?? 0,
    price: Number(row.price) || 0,
    taxCategory: row.taxCategory ?? 'S',
    taxRate: Number(row.taxRate) || 0,
    description: trim(row.description) || trim(row.item) || `Line ${i + 1}`,
  }));

  const vatBreakdown = (totals.taxBreakdown ?? []).map(g => ({
    base: g.base,
    amount: g.amount,
    category: g.category ?? 'S',
    rate: g.rate ?? 0,
    exemptionReason: g.exemptionReason ?? '',
    vatexCode: VATEX_DEFAULTS[g.category] ?? '',
  }));

  const allowances = vatBreakdown
    .map(g => {
      const lineSum = groupLineNetSum(
        invoice,
        g.category,
        g.rate,
        totals.lines
      );
      const amount = round2(lineSum - g.base);
      if (amount <= 0) {
        return null;
      }
      return {
        amount,
        category: g.category,
        rate: g.rate,
        reason: 'Discount',
      };
    })
    .filter(Boolean);

  const taxExclusive = round2(totals.subtotal - totals.discount);
  const amountPaid =
    derived.docType === 'invoice' && derived.amountPaid > 0
      ? round2(derived.amountPaid)
      : 0;
  const payable = round2(totals.grandTotal - amountPaid);

  const iban = trim(profile.bank?.iban);
  const payment = iban
    ? {
        meansCode: PAYMENT_MEANS_SEPA,
        iban,
        accountName: trim(profile.bank?.accountName),
        bic: trim(profile.bank?.bic),
      }
    : null;

  const model = {
    number: trim(invoice.invoiceID),
    issueDate: derived.issuedAt
      ? moment(derived.issuedAt).format('YYYY-MM-DD')
      : '',
    typeCode,
    currency,
    note: trim(invoice.note),
    buyerReference: buyerReferenceOn ? trim(recipient.buyerReference) : '',
    buyerReferenceOff: !buyerReferenceOn,
    preceding: derived.preceding,
    seller: {
      name: sellerName,
      tradingName,
      vatId: hasCategoryO ? '' : sellerTax.vatId,
      taxNumber: sellerTax.taxId,
      electronicAddress: trim(profile.email),
      address: profile.postalAddress ?? {},
      contact: {
        name: trim(profile.fullname),
        phone: trim(profile.phone),
        email: trim(profile.email),
      },
    },
    buyer: {
      name: trim(recipient.company) || trim(recipient.fullname),
      vatId:
        hasCategoryO || !looksLikeVatId(recipient.taxId)
          ? ''
          : trim(recipient.taxId),
      electronicAddress: trim(recipient.email),
      address: recipient.postalAddress ?? {},
      contactName:
        trim(recipient.company) && trim(recipient.fullname)
          ? trim(recipient.fullname)
          : '',
    },
    payment,
    lines,
    vatBreakdown,
    allowances,
    totals: {
      subtotal: totals.subtotal,
      discount: totals.discount,
      taxExclusive,
      taxTotal: totals.taxTotal,
      grandTotal: totals.grandTotal,
      prepaid: amountPaid,
      payable,
    },
  };

  if (typeCode !== TYPE_CODE.creditNote && derived.dueAt) {
    model.dueDate = moment(derived.dueAt).format('YYYY-MM-DD');
  }

  return model;
}

export { resolveProfile };
