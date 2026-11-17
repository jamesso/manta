function normalizeFraction(fraction) {
  const n = Number(fraction);
  if (!Number.isInteger(n) || n < 0 || n > 8) {
    return 2;
  }
  return n;
}

function roundMoney(value, fraction = 2) {
  const f = normalizeFraction(fraction);
  if (!Number.isFinite(value)) {
    return 0;
  }
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const scaled = Math.round(Number((abs * 10 ** f).toPrecision(15))) / 10 ** f;
  const result = sign * scaled;
  return Object.is(result, -0) ? 0 : result;
}

export { normalizeFraction, roundMoney };
