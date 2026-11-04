import {
  DEFAULT_INVOICE_STYLE,
  getConfigOverrides,
  getDefaultPreviewConfigs,
  resolveInvoiceConfigs,
} from '../defaultConfigs';

const invoiceSettings = {
  template: 'business',
  dateFormat: 'DD/MM/YYYY',
  style: { accentColor: '#F47373', fontSize: '300' },
};
const generalSettings = { language: 'fr' };

describe('getDefaultPreviewConfigs', () => {
  it('uses the style from settings over the built-in style', () => {
    expect(getDefaultPreviewConfigs(invoiceSettings, generalSettings)).toEqual({
      ...DEFAULT_INVOICE_STYLE,
      accentColor: '#F47373',
      fontSize: '300',
      template: 'business',
      dateFormat: 'DD/MM/YYYY',
      language: 'fr',
      showBuyerReference: false,
    });
  });

  it('uses the built-in style when settings have no style', () => {
    const configs = getDefaultPreviewConfigs({ template: 'minimal' }, {});
    expect(configs.accentColor).toBe(DEFAULT_INVOICE_STYLE.accentColor);
    expect(configs.showLogo).toBe(true);
  });
});

describe('resolveInvoiceConfigs', () => {
  it('follows the settings when the invoice has no overrides', () => {
    expect(
      resolveInvoiceConfigs({ _id: 'a' }, invoiceSettings, generalSettings)
    ).toEqual(getDefaultPreviewConfigs(invoiceSettings, generalSettings));
  });

  it('applies partial overrides on top of the settings', () => {
    const configs = resolveInvoiceConfigs(
      { configs: { language: 'de', showLogo: false } },
      invoiceSettings,
      generalSettings
    );
    expect(configs.language).toBe('de');
    expect(configs.showLogo).toBe(false);
    expect(configs.accentColor).toBe('#F47373');
    expect(configs.template).toBe('business');
  });

  it('keeps a legacy full configs object as saved', () => {
    const legacy = {
      ...DEFAULT_INVOICE_STYLE,
      template: 'minimal',
      dateFormat: 'MM/DD/YYYY',
      language: 'en',
    };
    expect(
      resolveInvoiceConfigs(
        { configs: legacy },
        invoiceSettings,
        generalSettings
      )
    ).toEqual({ ...legacy, showBuyerReference: false });
  });

  it('follows the buyer reference setting, not the invoice', () => {
    const eInvoiceOn = { ...invoiceSettings, eInvoice: { enabled: true } };
    const resolve = (settings, configs) =>
      resolveInvoiceConfigs({ configs }, settings, generalSettings)
        .showBuyerReference;
    expect(resolve(eInvoiceOn, {})).toBe(true);
    expect(
      resolve(
        { ...eInvoiceOn, useBuyerReference: false },
        { showBuyerReference: true }
      )
    ).toBe(false);
    expect(resolve(invoiceSettings, { showBuyerReference: true })).toBe(false);
  });
});

describe('getConfigOverrides', () => {
  const defaults = getDefaultPreviewConfigs(invoiceSettings, generalSettings);

  it('returns only the keys that differ from the defaults', () => {
    expect(
      getConfigOverrides(
        { ...defaults, accentColor: '#000000', language: 'de' },
        defaults
      )
    ).toEqual({ accentColor: '#000000', language: 'de' });
  });

  it('returns undefined when nothing differs', () => {
    expect(getConfigOverrides({ ...defaults }, defaults)).toBeUndefined();
  });
});
