import {
  buildBackup,
  hasDangerousKey,
  mergeImportedSettings,
  parseBackup,
  sanitizeDoc,
} from '../backup';

describe('backup helpers', () => {
  const baseInvoiceSettings = {
    exportDir: '/local',
    template: 'minimal',
    tax: { amount: 0, method: 'default', tin: '' },
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
    numbering: { prefix: 'INV-', next: 5, padding: 4 },
  };

  it('rejects backup contacts with attachments before validation', () => {
    const parsed = parseBackup(
      JSON.stringify({
        app: 'Manta',
        version: 1,
        invoices: [],
        contacts: [{ _id: 'a', _attachments: { file: { data: 'abc' } } }],
      })
    );
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe('unsupported-data');
  });

  it('rejects dangerous keys in backup documents', () => {
    const parsed = parseBackup(
      JSON.stringify({
        app: 'Manta',
        version: 1,
        invoices: [],
        contacts: [
          {
            _id: 'a',
            fullname: 'A',
            constructor: { prototype: { polluted: true } },
          },
        ],
      })
    );
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe('invalid-format');
  });

  it('rejects empty attachments on export sanitize', () => {
    expect(() =>
      sanitizeDoc({ _id: 'a', fullname: 'A', _attachments: {} })
    ).toThrow(/unsupported-data/);
    expect(() =>
      buildBackup({
        settings: null,
        invoices: [],
        contacts: [{ _id: 'a', fullname: 'A', _attachments: {} }],
      })
    ).toThrow(/unsupported-data/);
  });

  it('mergeImportedSettings max next when prefix changes', () => {
    const current = {
      profile: { fullname: 'Me' },
      invoice: baseInvoiceSettings,
      general: { language: 'en', theme: 'system', sound: 'default' },
    };
    const incoming = {
      invoice: {
        ...baseInvoiceSettings,
        numbering: { prefix: 'BILL-', next: 100, padding: 4 },
      },
    };
    const { settings, skippedSections } = mergeImportedSettings(
      current,
      incoming
    );
    expect(skippedSections).toEqual([]);
    expect(settings.invoice.numbering).toEqual({
      prefix: 'BILL-',
      next: 100,
      padding: 4,
    });
  });

  it('skips invoice section when imported numbering is invalid', () => {
    const current = {
      profile: { fullname: 'Me' },
      invoice: baseInvoiceSettings,
      general: { language: 'en', theme: 'system', sound: 'default' },
    };
    const incoming = {
      invoice: {
        ...baseInvoiceSettings,
        numbering: { prefix: 'INV-', next: 'bad', padding: 4 },
      },
    };
    const { settings, skippedSections } = mergeImportedSettings(
      current,
      incoming
    );
    expect(skippedSections).toContain('invoice');
    expect(settings.invoice.numbering.next).toBe(5);
  });

  it('skips invalid imported general and profile sections', () => {
    const current = {
      profile: { fullname: 'Me' },
      invoice: baseInvoiceSettings,
      general: { language: 'en', theme: 'system', sound: 'default' },
    };
    const incoming = {
      profile: { fullname: {} },
      general: { theme: 'INVALID', language: 'en', sound: 'default' },
      invoice: { template: 'INVALID', ...baseInvoiceSettings, numbering: null },
    };
    const { skippedSections } = mergeImportedSettings(current, incoming);
    expect(skippedSections).toEqual(
      expect.arrayContaining(['profile', 'general', 'invoice'])
    );
  });

  it('rejects explicit null nested invoice fields on import', () => {
    const current = {
      profile: { fullname: 'Me' },
      invoice: baseInvoiceSettings,
      general: { language: 'en', theme: 'system', sound: 'default' },
    };
    for (const field of ['tax', 'currency', 'required_fields', 'numbering']) {
      const { settings, skippedSections } = mergeImportedSettings(current, {
        invoice: { [field]: null },
      });
      expect(skippedSections).toContain('invoice');
      expect(settings.invoice[field]).toEqual(current.invoice[field]);
    }
  });

  it('rejects contacts with null attachments key', () => {
    const parsed = parseBackup(
      JSON.stringify({
        app: 'Manta',
        version: 1,
        invoices: [],
        contacts: [{ _id: 'a', fullname: 'A', _attachments: null }],
      })
    );
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe('unsupported-data');
    expect(() =>
      sanitizeDoc({ _id: 'a', fullname: 'A', _attachments: null })
    ).toThrow(/unsupported-data/);
  });

  it('detects nested dangerous settings keys', () => {
    expect(
      hasDangerousKey({ profile: { fullname: { constructor: 'x' } } })
    ).toBe(true);
  });
});
