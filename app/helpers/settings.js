export const SETTINGS_SECTIONS = ['profile', 'invoice', 'general'];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateNumbering(numbering, errors) {
  if (numbering == null) {
    return;
  }
  if (!isPlainObject(numbering)) {
    errors['numbering'] = 'settings:errors:numberingNext';
    return;
  }
  const { next, padding, prefix } = numbering;
  const nextNum = Number(next);
  if (!Number.isFinite(nextNum) || !Number.isInteger(nextNum) || nextNum < 1) {
    errors['numbering.next'] = 'settings:errors:numberingNext';
  }
  const padNum = Number(padding);
  if (
    !Number.isFinite(padNum) ||
    !Number.isInteger(padNum) ||
    padNum < 0 ||
    padNum > 12
  ) {
    errors['numbering.padding'] = 'settings:errors:numberingPadding';
  }
  if (typeof prefix !== 'string' || prefix.length > 20) {
    errors['numbering.prefix'] = 'settings:errors:numberingPrefix';
  }
}

export function getSettingsErrors(section, data) {
  if (section !== 'invoice') {
    return {};
  }
  const errors = {};
  const amount = data?.tax?.amount;
  const amountNum = Number(amount);
  if (
    amount === '' ||
    amount == null ||
    !Number.isFinite(amountNum) ||
    amountNum < 0
  ) {
    errors['tax.amount'] = 'settings:errors:taxAmount';
  }
  const fraction = data?.currency?.fraction;
  const fractionNum = Number(fraction);
  if (
    fraction === '' ||
    fraction == null ||
    !Number.isFinite(fractionNum) ||
    !Number.isInteger(fractionNum) ||
    fractionNum < 0 ||
    fractionNum > 8
  ) {
    errors['currency.fraction'] = 'settings:errors:fraction';
  }
  if (data?.numbering != null) {
    validateNumbering(data.numbering, errors);
  }
  return errors;
}
