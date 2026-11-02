import { COUNTRY_CODES } from '../../helpers/einvoice/codes.js';
import { getBalanceDue, getDisplayStatus, onlyInvoices } from './invoice';
import { groupCreditNotesByInvoice } from './creditNotes';

export const EMAIL_REGEX =
  /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;

export function getContactErrors(data) {
  const errors = {};
  const fullname = data?.fullname;
  if (fullname === undefined || String(fullname).trim() === '') {
    errors.fullname = 'contacts:errors:fullnameRequired';
  }
  const email = data?.email;
  if (email === undefined || String(email).trim() === '') {
    errors.email = 'contacts:errors:emailRequired';
  } else if (!EMAIL_REGEX.test(String(email).trim())) {
    errors.email = 'contacts:errors:emailInvalid';
  }
  const countryCode = String(data?.postalAddress?.countryCode ?? '').trim();
  if (countryCode && !COUNTRY_CODES.includes(countryCode)) {
    errors['postalAddress.countryCode'] = 'contacts:errors:countryInvalid';
  }
  return errors;
}

function normalizePostalAddress(value) {
  const src = value && typeof value === 'object' ? value : {};
  return {
    street: String(src.street ?? '').trim(),
    additional: String(src.additional ?? '').trim(),
    postcode: String(src.postcode ?? '').trim(),
    city: String(src.city ?? '').trim(),
    region: String(src.region ?? '').trim(),
    countryCode: String(src.countryCode ?? '').trim(),
  };
}

export function buildContact(data, existing, now) {
  const fullname = String(data.fullname ?? '').trim();
  const company = String(data.company ?? '').trim();
  const email = String(data.email ?? '').trim();
  const phone = String(data.phone ?? '').trim();
  const taxId = String(data.taxId ?? '').trim();
  const buyerReference = String(data.buyerReference ?? '').trim();
  const postalAddress = normalizePostalAddress(data.postalAddress);
  if (existing) {
    return {
      ...existing,
      fullname,
      company,
      email,
      phone,
      taxId,
      buyerReference,
      postalAddress,
    };
  }
  return {
    _id: crypto.randomUUID(),
    created_at: now,
    fullname,
    company,
    email,
    phone,
    taxId,
    buyerReference,
    postalAddress,
  };
}

export function summarizeClients(contacts, allSalesDocs, now) {
  const creditByInvoice = groupCreditNotesByInvoice(allSalesDocs);
  const invoices = onlyInvoices(allSalesDocs);
  const contactIds = new Set(contacts.map(c => c._id));
  const map = new Map();
  for (const contact of contacts) {
    map.set(contact._id, { invoiceCount: 0, outstanding: {}, invoices: [] });
  }
  for (const invoice of invoices) {
    const recipientId = invoice.recipient?._id;
    if (!recipientId || !contactIds.has(recipientId)) {
      continue;
    }
    const entry = map.get(recipientId);
    entry.invoiceCount += 1;
    entry.invoices.push(invoice);
    const linked = creditByInvoice.get(invoice._id) ?? [];
    const status = getDisplayStatus(invoice, now, linked);
    if (status === 'pending' || status === 'partial' || status === 'overdue') {
      const due = getBalanceDue(invoice, linked);
      const code = invoice.currency?.code ?? 'USD';
      entry.outstanding[code] = (entry.outstanding[code] ?? 0) + due;
    }
  }
  for (const entry of map.values()) {
    entry.invoices.sort((a, b) => {
      const aTime = a.issuedAt ?? a.created_at ?? 0;
      const bTime = b.issuedAt ?? b.created_at ?? 0;
      return bTime - aTime;
    });
  }
  return map;
}

export function matchesClientQuery(contact, query) {
  const q = String(query ?? '')
    .trim()
    .toLowerCase();
  if (!q) {
    return true;
  }
  const haystacks = [
    contact.fullname,
    contact.company,
    contact.email,
    contact.phone,
  ].map(v => String(v ?? '').toLowerCase());
  if (haystacks.some(h => h.includes(q))) {
    return true;
  }
  const queryDigits = q.replace(/\D/g, '');
  if (queryDigits) {
    const phoneDigits = String(contact.phone ?? '').replace(/\D/g, '');
    if (phoneDigits.includes(queryDigits)) {
      return true;
    }
  }
  return false;
}
