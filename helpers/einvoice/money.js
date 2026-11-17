export function round2(n) {
  return (
    (Math.sign(n) * Math.round((Math.abs(n) + Number.EPSILON) * 100)) / 100
  );
}

export function fmt2(n) {
  return round2(n).toFixed(2);
}

export function fmtQty(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) {
    return '0';
  }
  let s = v.toFixed(4);
  s = s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return s;
}

export function cents(n) {
  return Math.round(round2(n) * 100);
}
