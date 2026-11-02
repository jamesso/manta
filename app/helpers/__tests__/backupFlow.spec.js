import { runImport } from '../backupFlow';
import { withImportWriteLock } from '../importWriteLock';

vi.mock('../pouchDB', () => ({
  getAllDocs: vi.fn(async db =>
    db === 'contacts' ? [{ _id: 'c1' }] : [{ _id: 'i1' }]
  ),
  bulkSaveDocs: vi.fn(),
}));

describe('backupFlow', () => {
  it('does not write when snapshot fails', async () => {
    const { bulkSaveDocs } = await import('../pouchDB');
    bulkSaveDocs.mockClear();
    const ipc = {
      invoke: vi.fn(async channel => {
        if (channel === 'backup-snapshot') {
          throw new Error('disk full');
        }
      }),
    };
    await expect(
      runImport(
        { contacts: [{ _id: 'c2', fullname: 'N' }], invoices: [] },
        { mode: 'skip', includeSettings: false },
        { ipc }
      )
    ).rejects.toThrow('disk full');
    expect(bulkSaveDocs).not.toHaveBeenCalled();
  });

  it('returns partial results when a later batch throws', async () => {
    const { bulkSaveDocs, getAllDocs } = await import('../pouchDB');
    bulkSaveDocs
      .mockResolvedValueOnce({
        succeeded: ['c2'],
        failed: [],
        allDocs: [{ _id: 'c1' }, { _id: 'c2' }],
      })
      .mockRejectedValueOnce(new Error('invoice batch failed'));
    let contactReads = 0;
    getAllDocs.mockImplementation(async db => {
      if (db === 'contacts') {
        contactReads += 1;
        if (contactReads === 2) {
          return [{ _id: 'c1' }];
        }
        if (contactReads >= 3) {
          return [
            { _id: 'c1' },
            { _id: 'c2', fullname: 'Two', email: 'two@x.com' },
          ];
        }
        return [{ _id: 'c1' }];
      }
      return [{ _id: 'i1' }];
    });
    const ipc = {
      invoke: vi.fn(async channel => {
        if (channel === 'backup-snapshot') {
          return { filePath: '/tmp/safety.json' };
        }
      }),
    };
    const result = await runImport(
      {
        contacts: [{ _id: 'c2', fullname: 'Two', email: 'two@x.com' }],
        invoices: [{ _id: 'i2', rows: [], recipient: {} }],
      },
      { mode: 'skip', includeSettings: false },
      { ipc }
    );
    expect(result.snapshotPath).toBe('/tmp/safety.json');
    expect(result.counts.added).toBe(1);
    expect(result.batchError).toEqual({
      batch: 'invoices',
      message: 'invoice batch failed',
    });
    expect(result.contacts.some(doc => doc._id === 'c2')).toBe(true);
  });
});

describe('importWriteLock', () => {
  it('releases the lock after runImport finishes', async () => {
    const { isImportWriteLocked } = await import('../importWriteLock');
    expect(isImportWriteLocked()).toBe(false);
    await withImportWriteLock(async () => {
      expect(isImportWriteLocked()).toBe(true);
    });
    expect(isImportWriteLocked()).toBe(false);
  });
});
