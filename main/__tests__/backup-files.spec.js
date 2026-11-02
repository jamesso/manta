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
  });

  it('autoBackupFileName sorts in time order', () => {
    const a = autoBackupFileName(new Date('2026-01-01T10:00:00.000Z'));
    const b = autoBackupFileName(new Date('2026-01-01T11:00:00.000Z'));
    expect(a < b).toBe(true);
  });
});
