import { getSettingsErrors, SETTINGS_SECTIONS } from '../settings';

describe('getSettingsErrors', () => {
  const baseInvoice = {
    tax: { amount: 10, method: 'default', tin: '' },
    currency: {
      code: 'USD',
      fraction: 2,
      separator: 'commaDot',
      placement: 'before',
    },
    numbering: { prefix: 'INV-', next: 1, padding: 4 },
  };

  it('allows tax amount 0', () => {
    expect(
      getSettingsErrors('invoice', {
        ...baseInvoice,
        tax: { ...baseInvoice.tax, amount: 0 },
      })
    ).toEqual({});
  });

  it('rejects negative tax', () => {
    expect(
      getSettingsErrors('invoice', {
        ...baseInvoice,
        tax: { ...baseInvoice.tax, amount: -1 },
      })['tax.amount']
    ).toBeDefined();
  });

  it('rejects NaN and empty tax', () => {
    expect(
      getSettingsErrors('invoice', {
        ...baseInvoice,
        tax: { ...baseInvoice.tax, amount: NaN },
      })['tax.amount']
    ).toBeDefined();
    expect(
      getSettingsErrors('invoice', {
        ...baseInvoice,
        tax: { ...baseInvoice.tax, amount: '' },
      })['tax.amount']
    ).toBeDefined();
  });

  it('validates fraction bounds', () => {
    expect(
      getSettingsErrors('invoice', {
        ...baseInvoice,
        currency: { ...baseInvoice.currency, fraction: 2.5 },
      })['currency.fraction']
    ).toBeDefined();
    expect(
      getSettingsErrors('invoice', {
        ...baseInvoice,
        currency: { ...baseInvoice.currency, fraction: 9 },
      })['currency.fraction']
    ).toBeDefined();
  });

  it('validates numbering when present', () => {
    expect(
      getSettingsErrors('invoice', {
        ...baseInvoice,
        numbering: { prefix: 'INV-', next: 0, padding: 4 },
      })['numbering.next']
    ).toBeDefined();
  });

  it('returns empty for profile', () => {
    expect(getSettingsErrors('profile', {})).toEqual({});
  });

  it('lists settings sections', () => {
    expect(SETTINGS_SECTIONS).toContain('invoice');
  });
});
