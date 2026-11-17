export const TAX_CATEGORIES = ['S', 'Z', 'E', 'AE', 'K', 'G', 'O'];

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
