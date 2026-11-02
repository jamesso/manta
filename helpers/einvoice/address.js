export function hasPostalAddress(a) {
  if (!a || typeof a !== 'object') {
    return false;
  }
  return [a.street, a.city, a.postcode].some(
    v => String(v ?? '').trim() !== ''
  );
}

export function formatPostalAddress(a, lang = 'en') {
  if (!a || typeof a !== 'object') {
    return [];
  }
  const lines = [];
  const street = String(a.street ?? '').trim();
  const additional = String(a.additional ?? '').trim();
  const postcode = String(a.postcode ?? '').trim();
  const city = String(a.city ?? '').trim();
  const region = String(a.region ?? '').trim();
  const code = String(a.countryCode ?? '').trim();
  if (street) {
    lines.push(street);
  }
  if (additional) {
    lines.push(additional);
  }
  const cityLine = [postcode, city].filter(Boolean).join(' ');
  if (cityLine) {
    lines.push(cityLine);
  }
  if (region) {
    lines.push(region);
  }
  if (code) {
    try {
      const name = new Intl.DisplayNames([lang], { type: 'region' }).of(code);
      if (name) {
        lines.push(name);
      }
    } catch {
      lines.push(code);
    }
  }
  return lines;
}
