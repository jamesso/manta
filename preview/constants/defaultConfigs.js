import { isBuyerReferenceOn } from '../../helpers/einvoice/identifiers.js';

// Style defaults for a fresh install. Settings > Invoice Defaults stores the
// user's own values in `invoice.style`.
export const DEFAULT_INVOICE_STYLE = {
  accentColor: '#2CCCE4',
  customAccentColor: true,
  logoSize: '20',
  fontSize: '200',
  alignItems: 'middle',
  showLogo: true,
  useSymbol: true,
  showRecipient: true,
};

export function getDefaultPreviewConfigs(invoiceSettings, generalSettings) {
  return {
    ...DEFAULT_INVOICE_STYLE,
    ...invoiceSettings?.style,
    dateFormat: invoiceSettings?.dateFormat,
    language: generalSettings?.language,
    template: invoiceSettings?.template,
    showBuyerReference: isBuyerReferenceOn(invoiceSettings),
  };
}

// The style an invoice prints with: the global defaults, then the invoice's
// own overrides. Older invoices store a full configs object, so they keep
// their saved look.
export function resolveInvoiceConfigs(
  invoice,
  invoiceSettings,
  generalSettings
) {
  const defaults = getDefaultPreviewConfigs(invoiceSettings, generalSettings);
  return {
    ...defaults,
    ...invoice?.configs,
    // An app setting, not a style: one invoice cannot turn it back on.
    showBuyerReference: defaults.showBuyerReference,
  };
}

// Only the keys that differ from the defaults. Returns undefined when the
// invoice has no overrides left.
export function getConfigOverrides(configs, defaults) {
  const overrides = {};
  for (const [key, value] of Object.entries(configs ?? {})) {
    if (value !== undefined && value !== defaults?.[key]) {
      overrides[key] = value;
    }
  }
  return Object.keys(overrides).length ? overrides : undefined;
}
