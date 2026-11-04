import {
  getRawNumberingErrors,
  getSettingsErrors,
  SETTINGS_SECTIONS,
} from '../settings';

describe('getSettingsErrors', () => {
  const baseInvoice = {
    template: 'minimal',
    tax: { amount: 10, method: 'default', tin: '' },
    currency: {
      code: 'USD',
      fraction: 2,
      separator: 'commaDot',
      placement: 'before',
    },
    required_fields: {
      invoiceID: false,
      dueDate: false,
      currency: false,
      discount: false,
      tax: false,
      note: false,
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
      })
    ).toEqual({});
    expect(
      getSettingsErrors('invoice', {
        ...baseInvoice,
        currency: { ...baseInvoice.currency, fraction: 20 },
      })
    ).toEqual({});
    expect(
      getSettingsErrors('invoice', {
        ...baseInvoice,
        currency: { ...baseInvoice.currency, fraction: 21 },
      })['currency.fraction']
    ).toBeDefined();
  });

  it('validates raw numbering without coercion', () => {
    expect(
      getRawNumberingErrors({ prefix: 'INV-', next: 'bad', padding: 4 })[
        'numbering.next'
      ]
    ).toBeDefined();
    expect(getRawNumberingErrors(null).numbering).toBeDefined();
    expect(getRawNumberingErrors(undefined)).toEqual({});
    expect(
      getSettingsErrors('invoice', {
        ...baseInvoice,
        numbering: { prefix: 'INV-', next: -10, padding: 4 },
      })['numbering.next']
    ).toBeDefined();
    expect(
      getSettingsErrors('invoice', {
        ...baseInvoice,
        numbering: null,
      }).numbering
    ).toBeDefined();
  });

  it('rejects invalid general theme and profile strings', () => {
    expect(
      getSettingsErrors('general', {
        language: 'en',
        theme: 'INVALID',
        sound: 'default',
      }).theme
    ).toBeDefined();
    expect(
      getSettingsErrors('profile', { fullname: {} }).fullname
    ).toBeDefined();
  });

  it('rejects invalid invoice template', () => {
    expect(
      getSettingsErrors('invoice', { ...baseInvoice, template: 'INVALID' })
        .template
    ).toBeDefined();
  });

  it('returns empty for valid profile', () => {
    expect(getSettingsErrors('profile', { fullname: 'Me' })).toEqual({});
  });

  it('lists settings sections', () => {
    expect(SETTINGS_SECTIONS).toContain('invoice');
  });

  it('validates email template fields', () => {
    expect(
      getSettingsErrors('invoice', {
        ...baseInvoice,
        emailTemplate: { subject: 'One\nTwo', body: 'ok' },
      })['emailTemplate.subject']
    ).toBeDefined();
    expect(
      getSettingsErrors('invoice', {
        ...baseInvoice,
        emailTemplate: { subject: 'ok', body: 'x'.repeat(1501) },
      })['emailTemplate.body']
    ).toBeDefined();
    expect(
      getSettingsErrors('invoice', {
        ...baseInvoice,
        emailTemplate: { subject: '', body: '' },
        reminderTemplate: { subject: '', body: '' },
      })
    ).toEqual({});
  });
});

describe('getSettingsErrors invoice template', () => {
  it('accepts the legacy default template of older installs', () => {
    expect(getSettingsErrors('invoice', { template: 'default' })).toEqual({});
  });
});

describe('getSettingsErrors invoice style', () => {
  it('accepts a valid style', () => {
    expect(
      getSettingsErrors('invoice', {
        style: {
          accentColor: '#2CCCE4',
          fontSize: '300',
          logoSize: '7.5',
          alignItems: 'top',
          showLogo: false,
        },
      })
    ).toEqual({});
  });

  it('rejects bad style values', () => {
    expect(
      getSettingsErrors('invoice', {
        style: {
          accentColor: 'red',
          fontSize: 300,
          logoSize: '80',
          alignItems: 'left',
          useSymbol: 'yes',
        },
      })
    ).toEqual({
      'style.accentColor': 'settings:errors:invoiceInvalid',
      'style.fontSize': 'settings:errors:invoiceInvalid',
      'style.logoSize': 'settings:errors:invoiceInvalid',
      'style.alignItems': 'settings:errors:invoiceInvalid',
      'style.useSymbol': 'settings:errors:invoiceInvalid',
    });
  });

  it('rejects a buyer reference setting that is not a boolean', () => {
    expect(getSettingsErrors('invoice', { useBuyerReference: false })).toEqual(
      {}
    );
    expect(getSettingsErrors('invoice', { useBuyerReference: 'no' })).toEqual({
      useBuyerReference: 'settings:errors:invoiceInvalid',
    });
  });

  it('rejects a style that is not an object', () => {
    expect(getSettingsErrors('invoice', { style: [] })).toEqual({
      style: 'settings:errors:invoiceInvalid',
    });
  });
});
