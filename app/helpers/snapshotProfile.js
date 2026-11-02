export function snapshotProfileForInvoice(invoice, settingsProfile) {
  const base =
    settingsProfile && typeof settingsProfile === 'object'
      ? { ...settingsProfile }
      : {};
  const seller = invoice?.seller;
  if (!seller || typeof seller !== 'object') {
    return base;
  }
  return {
    ...base,
    fullname: seller.fullname ?? base.fullname,
    company: seller.company ?? base.company,
    address: seller.address ?? base.address,
    email: seller.email ?? base.email,
    phone: seller.phone ?? base.phone,
    website: seller.website ?? base.website,
    legalName: seller.legalName ?? base.legalName,
    taxId: seller.taxId ?? base.taxId,
    vatId: seller.vatId ?? base.vatId,
    postalAddress: seller.postalAddress ?? base.postalAddress,
    bank: seller.bank ?? base.bank,
    logo: base.logo,
  };
}
