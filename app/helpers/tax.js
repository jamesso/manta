import { roundMoney as roundMoneyImpl } from './money';

export const TAX_CATEGORIES = ['S', 'Z', 'E', 'AE', 'K', 'G', 'O'];
export const EXEMPTION_REQUIRED = ['E', 'AE', 'K', 'G', 'O'];
export const LEGACY_TIN_PLACEHOLDER = '123-456-789';

export const DEFAULT_EXEMPTION_REASONS = {
  E: 'Exempt from VAT',
  AE: 'Reverse charge',
  K: 'Intra-community supply',
  G: 'Export outside the EU',
  O: 'Not subject to VAT',
};

export { roundMoneyImpl as roundMoney };

export function buildDefaultTaxRates(legacyTax) {
  const amount = Number(legacyTax?.amount);
  if (Number.isFinite(amount) && amount > 0) {
    return [
      {
        id: 'standard',
        name: 'Standard',
        rate: amount,
        category: 'S',
        isDefault: true,
        exemptionReason: '',
        active: true,
      },
    ];
  }
  return [
    {
      id: 'zero',
      name: 'Zero rate',
      rate: 0,
      category: 'Z',
      isDefault: true,
      exemptionReason: '',
      active: true,
    },
  ];
}

export function getTaxRates(invoiceSettings) {
  const list = invoiceSettings?.taxRates;
  if (Array.isArray(list) && list.length > 0) {
    return list;
  }
  return buildDefaultTaxRates(invoiceSettings?.tax);
}

export function getActiveTaxRates(rates) {
  if (!Array.isArray(rates)) {
    return [];
  }
  return rates.filter(r => r && r.active !== false);
}

export function getDefaultTaxRate(rates) {
  const active = getActiveTaxRates(rates);
  const marked = active.find(r => r.isDefault);
  if (marked) {
    return marked;
  }
  return active[0] ?? null;
}

export function resolveRowTaxRate(taxRateId, rates) {
  const active = getActiveTaxRates(rates);
  if (taxRateId != null && taxRateId !== '') {
    const found = active.find(r => r.id === taxRateId);
    if (found) {
      return found;
    }
  }
  return getDefaultTaxRate(rates);
}

export function clearRowTax(row) {
  const next = { ...row };
  delete next.taxRateId;
  delete next.taxRate;
  delete next.taxCategory;
  delete next.taxExemptionReason;
  return next;
}

export function applyTaxRate(row, rate) {
  if (rate == null) {
    return clearRowTax(row);
  }
  return {
    ...row,
    taxRateId: rate.id,
    taxRate: rate.rate,
    taxCategory: rate.category,
    taxExemptionReason: rate.exemptionReason ?? '',
  };
}

export function matchLegacyTaxRate(tax, rates) {
  const active = getActiveTaxRates(rates);
  if (tax?.method === 'reverse') {
    return active.find(r => r.category === 'AE') ?? getDefaultTaxRate(rates);
  }
  const amount = Number(tax?.amount);
  if (Number.isFinite(amount)) {
    const match = active.find(r => r.category === 'S' && r.rate === amount);
    if (match) {
      return match;
    }
  }
  return getDefaultTaxRate(rates);
}

export function getTaxRateErrors(rate) {
  const errors = {};
  if (!rate || typeof rate !== 'object') {
    return { name: 'settings:taxRates:errors:name' };
  }
  const name = String(rate.name ?? '').trim();
  if (name.length < 1 || name.length > 40) {
    errors.name = 'settings:taxRates:errors:name';
  }
  if (!TAX_CATEGORIES.includes(rate.category)) {
    errors.category = 'settings:taxRates:errors:rateZero';
  }
  const cat = rate.category;
  const r = Number(rate.rate);
  if (cat === 'S') {
    if (!Number.isFinite(r) || r <= 0 || r > 100) {
      errors.rate = 'settings:taxRates:errors:rateStandard';
    }
  } else if (!Number.isFinite(r) || r !== 0) {
    errors.rate = 'settings:taxRates:errors:rateZero';
  }
  const reason = String(rate.exemptionReason ?? '').trim();
  if (EXEMPTION_REQUIRED.includes(cat)) {
    if (!reason) {
      errors.exemptionReason = 'settings:taxRates:errors:reasonRequired';
    } else if (reason.length > 200) {
      errors.exemptionReason = 'settings:taxRates:errors:reasonRequired';
    }
  } else if (reason.length > 200) {
    errors.exemptionReason = 'settings:taxRates:errors:reasonRequired';
  }
  return errors;
}

export function getTaxRatesErrors(list) {
  const errors = {};
  if (!Array.isArray(list) || list.length === 0) {
    errors.taxRates = 'settings:taxRates:errors:empty';
    return errors;
  }
  const ids = new Set();
  for (const rate of list) {
    if (!rate || typeof rate !== 'object') {
      continue;
    }
    const id = rate.id;
    if (typeof id !== 'string' || id === '') {
      continue;
    }
    if (ids.has(id)) {
      errors.taxRates = 'settings:taxRates:errors:duplicateId';
    }
    ids.add(id);
    const fieldErrors = getTaxRateErrors(rate);
    for (const [field, key] of Object.entries(fieldErrors)) {
      errors[`taxRates.${id}.${field}`] = key;
    }
  }
  const active = getActiveTaxRates(list);
  const defaults = active.filter(r => r.isDefault);
  if (defaults.length !== 1 && !errors.taxRates) {
    errors.taxRates = 'settings:taxRates:errors:noDefault';
  }
  return errors;
}

export function getSellerTaxIds(profile, invoiceSettings) {
  const taxIdFromProfile = String(profile?.taxId ?? '').trim();
  const vatId = String(profile?.vatId ?? '').trim();
  if (taxIdFromProfile) {
    return { taxId: taxIdFromProfile, vatId };
  }
  const legacyTin = String(invoiceSettings?.tax?.tin ?? '').trim();
  if (legacyTin && legacyTin !== LEGACY_TIN_PLACEHOLDER) {
    return { taxId: legacyTin, vatId };
  }
  return { taxId: '', vatId };
}

export function buildSellerSnapshot(profile, invoiceSettings) {
  const ids = getSellerTaxIds(profile, invoiceSettings);
  const postal = profile?.postalAddress ?? {};
  const bank = profile?.bank ?? {};
  return {
    version: 1,
    ...ids,
    legalName: String(profile?.legalName ?? '').trim(),
    fullname: String(profile?.fullname ?? '').trim(),
    company: String(profile?.company ?? '').trim(),
    email: String(profile?.email ?? '').trim(),
    phone: String(profile?.phone ?? '').trim(),
    postalAddress: {
      street: String(postal.street ?? '').trim(),
      additional: String(postal.additional ?? '').trim(),
      postcode: String(postal.postcode ?? '').trim(),
      city: String(postal.city ?? '').trim(),
      region: String(postal.region ?? '').trim(),
      countryCode: String(postal.countryCode ?? '').trim(),
    },
    bank: {
      accountName: String(bank.accountName ?? '').trim(),
      iban: String(bank.iban ?? '').trim(),
      bic: String(bank.bic ?? '').trim(),
    },
  };
}

export function compareTaxGroups(a, b) {
  const catA = a.category ?? 'S';
  const catB = b.category ?? 'S';
  const idxA = TAX_CATEGORIES.indexOf(catA);
  const idxB = TAX_CATEGORIES.indexOf(catB);
  const orderA = idxA === -1 ? TAX_CATEGORIES.length : idxA;
  const orderB = idxB === -1 ? TAX_CATEGORIES.length : idxB;
  if (orderA !== orderB) {
    return orderA - orderB;
  }
  const rateA = Number(a.rate) || 0;
  const rateB = Number(b.rate) || 0;
  return rateB - rateA;
}

export function taxGroupKey(category, rate) {
  return `${category ?? 'S'}\0${rate ?? 0}`;
}
