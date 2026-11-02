import {
  BACKUP_VERSION,
  buildBackup,
  mergeImportedSettings,
  parseBackup,
  planMerge,
  sanitizeDoc,
} from '../backup';

describe('backup helpers', () => {
  it('rejects invalid json', () => {
    expect(parseBackup('{').ok).toBe(false);
  });

  it('rejects wrong app', () => {
    expect(
      parseBackup(JSON.stringify({ app: 'Other', version: 1 })).error
    ).toBe('wrong-app');
  });

  it('rejects newer version', () => {
    expect(
      parseBackup(
        JSON.stringify({ app: 'Manta', version: 2, invoices: [], contacts: [] })
      ).error
    ).toBe('newer-version');
  });

  it('strips reserved keys on sanitize', () => {
    const doc = sanitizeDoc({
      _id: 'a',
      _rev: '1-x',
      _deleted: true,
      fullname: 'A',
    });
    expect(doc._rev).toBeUndefined();
    expect(doc._deleted).toBeUndefined();
    expect(doc.fullname).toBe('A');
  });

  it('planMerge overwrite keeps local rev', () => {
    const { toWrite } = planMerge(
      [{ _id: 'a', fullname: 'X' }],
      [{ _id: 'a', _rev: '2-y', fullname: 'Y' }],
      'overwrite'
    );
    expect(toWrite[0]._rev).toBe('2-y');
  });

  it('mergeImportedSettings keeps exportDir and max next', () => {
    const current = {
      profile: { fullname: 'Me' },
      invoice: {
        exportDir: '/local',
        tax: { amount: 0, method: 'default', tin: '' },
        currency: {
          code: 'USD',
          fraction: 2,
          separator: 'commaDot',
          placement: 'before',
        },
        numbering: { prefix: 'INV-', next: 5, padding: 4 },
      },
      general: { language: 'en' },
    };
    const incoming = {
      invoice: {
        exportDir: '/remote',
        tax: { amount: 0, method: 'default', tin: '' },
        currency: {
          code: 'USD',
          fraction: 2,
          separator: 'commaDot',
          placement: 'before',
        },
        numbering: { prefix: 'INV-', next: 3, padding: 4 },
      },
    };
    const { settings } = mergeImportedSettings(current, incoming);
    expect(settings.invoice.exportDir).toBe('/local');
    expect(settings.invoice.numbering.next).toBe(5);
  });

  it('round trip without _rev on docs', () => {
    const payload = buildBackup({
      settings: null,
      invoices: [{ _id: 'i1', rows: [], recipient: {} }],
      contacts: [{ _id: 'c1', fullname: 'C' }],
    });
    const parsed = parseBackup(JSON.stringify(payload));
    expect(parsed.ok).toBe(true);
    expect(parsed.backup.invoices[0]._rev).toBeUndefined();
  });
});
