export const SETTINGS_SECTIONS = ['profile', 'invoice', 'general'];

const THEMES = new Set(['system', 'light', 'dark']);
const SOUNDS = new Set(['default', 'cs']);
const TEMPLATES = new Set(['minimal', 'business']);
const SEPARATORS = new Set(['commaDot', 'dotComma', 'spaceDot']);
const PLACEMENTS = new Set(['before', 'after']);
const TAX_METHODS = new Set(['default', 'reverse']);
const LANGUAGES = new Set([
  'de',
  'en',
  'fr',
  'id',
  'it',
  'sk',
  'ur-PK',
  'vi',
  'zh-CN',
]);
const PROFILE_STRING_FIELDS = [
  'fullname',
  'company',
  'address',
  'email',
  'phone',
  'website',
];
const REQUIRED_FIELD_KEYS = [
  'invoiceID',
  'dueDate',
  'currency',
  'discount',
  'tax',
  'note',
];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function getRawNumberingErrors(numbering) {
  const errors = {};
  if (numbering === undefined) {
    return errors;
  }
  if (numbering == null) {
    errors.numbering = 'settings:errors:numberingNext';
    return errors;
  }
  if (!isPlainObject(numbering)) {
    errors.numbering = 'settings:errors:numberingNext';
    return errors;
  }
  const { next, padding, prefix } = numbering;
  if (!Number.isInteger(next) || next < 1) {
    errors['numbering.next'] = 'settings:errors:numberingNext';
  }
  if (!Number.isInteger(padding) || padding < 0 || padding > 12) {
    errors['numbering.padding'] = 'settings:errors:numberingPadding';
  }
  if (typeof prefix !== 'string' || prefix.length > 20) {
    errors['numbering.prefix'] = 'settings:errors:numberingPrefix';
  }
  return errors;
}

function validateNumbering(numbering, errors) {
  if (numbering == null) {
    return;
  }
  Object.assign(errors, getRawNumberingErrors(numbering));
}

export function getSettingsErrors(section, data) {
  const errors = {};
  if (section === 'profile') {
    if (!isPlainObject(data)) {
      errors.profile = 'settings:errors:profileInvalid';
      return errors;
    }
    for (const field of PROFILE_STRING_FIELDS) {
      if (data[field] != null && typeof data[field] !== 'string') {
        errors[field] = 'settings:errors:profileInvalid';
      }
    }
    if (data.logo != null && typeof data.logo !== 'string') {
      errors.logo = 'settings:errors:profileInvalid';
    }
    return errors;
  }
  if (section === 'general') {
    if (!isPlainObject(data)) {
      errors.general = 'settings:errors:generalInvalid';
      return errors;
    }
    if (data.language != null && !LANGUAGES.has(data.language)) {
      errors.language = 'settings:errors:languageInvalid';
    }
    if (data.theme != null && !THEMES.has(data.theme)) {
      errors.theme = 'settings:errors:themeInvalid';
    }
    if (data.sound != null && !SOUNDS.has(data.sound)) {
      errors.sound = 'settings:errors:soundInvalid';
    }
    if (data.muted != null && typeof data.muted !== 'boolean') {
      errors.muted = 'settings:errors:generalInvalid';
    }
    if (data.previewPDF != null && typeof data.previewPDF !== 'boolean') {
      errors.previewPDF = 'settings:errors:generalInvalid';
    }
    return errors;
  }
  if (section !== 'invoice') {
    return errors;
  }
  if (!isPlainObject(data)) {
    errors.invoice = 'settings:errors:invoiceInvalid';
    return errors;
  }
  if (data.template != null && !TEMPLATES.has(data.template)) {
    errors.template = 'settings:errors:templateInvalid';
  }
  const currency = data.currency;
  if ('currency' in data) {
    if (currency == null || !isPlainObject(currency)) {
      errors.currency = 'settings:errors:invoiceInvalid';
    } else {
      if (currency.code != null && typeof currency.code !== 'string') {
        errors['currency.code'] = 'settings:errors:invoiceInvalid';
      }
      if (currency.separator != null && !SEPARATORS.has(currency.separator)) {
        errors['currency.separator'] = 'settings:errors:invoiceInvalid';
      }
      if (currency.placement != null && !PLACEMENTS.has(currency.placement)) {
        errors['currency.placement'] = 'settings:errors:invoiceInvalid';
      }
      const fraction = currency.fraction;
      if (
        fraction === '' ||
        fraction == null ||
        !Number.isInteger(fraction) ||
        fraction < 0 ||
        fraction > 8
      ) {
        errors['currency.fraction'] = 'settings:errors:fraction';
      }
    }
  }
  const tax = data.tax;
  if ('tax' in data) {
    if (tax == null || !isPlainObject(tax)) {
      errors.tax = 'settings:errors:invoiceInvalid';
    } else {
      if (tax.tin != null && typeof tax.tin !== 'string') {
        errors['tax.tin'] = 'settings:errors:invoiceInvalid';
      }
      if (tax.method != null && !TAX_METHODS.has(tax.method)) {
        errors['tax.method'] = 'settings:errors:invoiceInvalid';
      }
      const amount = tax.amount;
      const amountNum = Number(amount);
      if (
        amount === '' ||
        amount == null ||
        !Number.isFinite(amountNum) ||
        amountNum < 0
      ) {
        errors['tax.amount'] = 'settings:errors:taxAmount';
      }
    }
  }
  const required = data.required_fields;
  if ('required_fields' in data) {
    if (required == null || !isPlainObject(required)) {
      errors.required_fields = 'settings:errors:invoiceInvalid';
    } else {
      for (const key of REQUIRED_FIELD_KEYS) {
        if (required[key] != null && typeof required[key] !== 'boolean') {
          errors[`required_fields.${key}`] = 'settings:errors:invoiceInvalid';
        }
      }
    }
  }
  if (
    'numbering' in data &&
    (data.numbering == null || !isPlainObject(data.numbering))
  ) {
    errors.numbering = 'settings:errors:numberingNext';
  } else if (data.numbering != null) {
    validateNumbering(data.numbering, errors);
  }
  return errors;
}

export function validateImportedSettingsSection(section, data) {
  return getSettingsErrors(section, data);
}
