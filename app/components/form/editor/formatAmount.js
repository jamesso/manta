import { formatNumber } from '../../../../helpers/formatNumber';

export function safeCurrencyFraction(value) {
  const fraction = Number(value);
  return Number.isInteger(fraction) && fraction >= 0 && fraction <= 20
    ? fraction
    : 2;
}

export function formatAmount(value, currency = {}) {
  const amount = Number(value);
  return formatNumber(
    Number.isFinite(amount) ? amount : 0,
    safeCurrencyFraction(currency.fraction),
    currency.separator
  );
}
