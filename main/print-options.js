// Old marginsType (Electron <= 8) → new margins.marginType
const MARGIN_TYPES = ['default', 'none', 'printableArea'];

export function getPrintOptions(saved) {
  saved = saved || {};
  const marginType =
    (saved.margins && saved.margins.marginType) ||
    MARGIN_TYPES[saved.marginsType] ||
    'default';
  return {
    landscape: Boolean(saved.landscape),
    printBackground: saved.printBackground !== false,
    margins: { marginType },
    preferCSSPageSize: true, // templates set @page { size: A4 }
  };
}
