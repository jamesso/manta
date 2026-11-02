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

  it('accepts version 1 backups without items as empty list', () => {
    const parsed = parseBackup(
      JSON.stringify({
        app: 'Manta',
        version: 1,
        invoices: [],
        contacts: [],
      })
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.backup.items).toEqual([]);
  });

  it('parses version 2 items and rejects invalid items shape', () => {
    const ok = parseBackup(
      JSON.stringify({
        app: 'Manta',
        version: 2,
        invoices: [],
        contacts: [],
        items: [
          {
            _id: 'i1',
            name: 'Design',
            unitPrice: 1,
            unitCode: 'C62',
          },
        ],
      })
    );
    expect(ok.ok).toBe(true);
    expect(ok.backup.items).toHaveLength(1);
    expect(ok.backup.items[0]._rev).toBeUndefined();

    const bad = parseBackup(
      JSON.stringify({
        app: 'Manta',
        version: 2,
        invoices: [],
        contacts: [],
        items: {},
      })
    );
    expect(bad.ok).toBe(false);
    expect(bad.error).toBe('invalid-format');
  });

  it('rejects newer backup versions', () => {
    const parsed = parseBackup(
      JSON.stringify({
        app: 'Manta',
        version: 6,
        invoices: [],
        contacts: [],
      })
    );
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe('newer-version');
  });

  it('accepts version 5 backups with credit note numbering', () => {
    const parsed = parseBackup(
      JSON.stringify({
        app: 'Manta',
        version: 5,
        invoices: [],
        contacts: [],
      })
    );
    expect(parsed.ok).toBe(true);
  });

  it('accepts version 4 backups with estimates', () => {
    const parsed = parseBackup(
      JSON.stringify({
        app: 'Manta',
        version: 4,
        invoices: [
          {
            _id: 'e1',
            docType: 'estimate',
            validUntil: 1,
            convertedInvoiceId: 'i1',
            recipient: { fullname: 'A', email: 'a@b.c' },
          },
        ],
        contacts: [],
        items: [],
      })
    );
    expect(parsed.ok).toBe(true);
  });

  it('accepts version 2 backups', () => {
    const parsed = parseBackup(
      JSON.stringify({
        app: 'Manta',
        version: 2,
        invoices: [],
        contacts: [],
        items: [],
      })
    );
    expect(parsed.ok).toBe(true);
  });

  it('counts invalid and duplicate items', () => {
    const parsed = parseBackup(
      JSON.stringify({
        app: 'Manta',
        version: 2,
        invoices: [],
        contacts: [],
        items: [
          { _id: 'a', name: 'A', unitPrice: 1, _rev: '1-x' },
          { _id: 'a', name: 'Dup', unitPrice: 2 },
          { _id: 'b', unitPrice: 1 },
        ],
      })
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.invalid.items).toBe(1);
    expect(parsed.duplicates.items).toBe(1);
    expect(parsed.backup.items[0]._rev).toBeUndefined();
  });

  it('round-trips items through build and parse', () => {
    const payload = buildBackup({
      settings: null,
      invoices: [],
      contacts: [],
      items: [{ _id: 'i1', name: 'Svc', unitPrice: 10, unitCode: 'HUR' }],
    });
    const parsed = parseBackup(JSON.stringify(payload));
    expect(parsed.ok).toBe(true);
    expect(parsed.backup.items[0]).toMatchObject({
      _id: 'i1',
      name: 'Svc',
      unitPrice: 10,
      unitCode: 'HUR',
    });
  });
});
