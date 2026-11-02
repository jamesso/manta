const {
  autoBackupFileName,
  autoBackupsToPrune,
  serializeBackup,
} = require('../backup-files');

describe('backup-files', () => {
  it('prunes old auto backups', () => {
    const names = [
      'manta-backup-2026-11-01.json',
      'notes.txt',
      ...Array.from({ length: 12 }, (_, i) =>
        autoBackupFileName(new Date(Date.UTC(2026, 0, 1, 0, 0, i)))
      ),
    ];
    const prune = autoBackupsToPrune(names);
    expect(prune).not.toContain('manta-backup-2026-11-01.json');
    expect(prune.length).toBe(2);
  });

  it('serializeBackup throws for bad payload', () => {
    expect(() => serializeBackup({ app: 'Other' }, '1', new Date())).toThrow();
    expect(() =>
      serializeBackup(
        {
          app: 'Manta',
          version: 2,
          invoices: [],
          contacts: [],
          items: {},
        },
        '1',
        new Date()
      )
    ).toThrow();
  });

  it('serializeBackup writes items array', () => {
    const text = serializeBackup(
      {
        app: 'Manta',
        version: 2,
        settings: null,
        invoices: [],
        contacts: [],
        items: [{ _id: 'i1', name: 'A' }],
      },
      '1.1.4',
      new Date('2026-01-01T00:00:00.000Z')
    );
    const parsed = JSON.parse(text);
    expect(parsed.items).toHaveLength(1);
  });

  it('autoBackupFileName sorts in time order', () => {
    const a = autoBackupFileName(new Date('2026-01-01T10:00:00.000Z'));
    const b = autoBackupFileName(new Date('2026-01-01T11:00:00.000Z'));
    expect(a < b).toBe(true);
  });

  it('writeFileAtomic uses unique temp files and leaves a complete destination', async () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const { writeFileAtomic } = require('../backup-files');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manta-backup-'));
    const target = path.join(dir, 'out.json');
    await writeFileAtomic(target, '{"ok":true}');
    expect(fs.readFileSync(target, 'utf8')).toBe('{"ok":true}');
    expect(fs.readdirSync(dir).filter(name => name.endsWith('.tmp'))).toEqual(
      []
    );
  });
});
