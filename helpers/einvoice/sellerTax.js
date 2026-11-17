export const LEGACY_TIN_PLACEHOLDER = '123-456-789';

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
