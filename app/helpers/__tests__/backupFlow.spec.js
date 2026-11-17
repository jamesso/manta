import { runImport } from '../backupFlow';
import { withImportWriteLock } from '../importWriteLock';

vi.mock('../pouchDB', () => ({
  getAllDocs: vi.fn(async db => {
    if (db === 'contacts') return [{ _id: 'c1' }];
    if (db === 'items') return [{ _id: 'it1' }];
    return [{ _id: 'i1' }];
  }),
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

  it('writes new items in skip mode after contacts and invoices', async () => {
    const { bulkSaveDocs, getAllDocs } = await import('../pouchDB');
    bulkSaveDocs.mockResolvedValue({
      succeeded: ['it2'],
      failed: [],
    });
    const ipc = {
      invoke: vi.fn(async channel => {
        if (channel === 'backup-snapshot') {
          return { filePath: '/tmp/safety.json' };
        }
      }),
    };
    await runImport(
      {
        contacts: [],
        invoices: [],
        items: [{ _id: 'it2', name: 'New', unitPrice: 1, unitCode: 'C62' }],
      },
      { mode: 'skip', includeSettings: false },
      { ipc }
    );
    expect(bulkSaveDocs).toHaveBeenCalledWith('items', [
      expect.objectContaining({ _id: 'it2' }),
    ]);
    expect(getAllDocs).toHaveBeenCalledWith('items');
  });

  it('returns partial results when a later batch throws', async () => {
    const { bulkSaveDocs, getAllDocs } = await import('../pouchDB');
    bulkSaveDocs
      .mockResolvedValueOnce({
        succeeded: ['c2'],
        failed: [],
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

  it('fast-forwards imported recurring nextDate and includes recurring in snapshot', async () => {
    const { bulkSaveDocs, getAllDocs } = await import('../pouchDB');
    let snapshotPayload;
    bulkSaveDocs.mockImplementation(async (db, docs) => {
      if (db === 'recurring') {
        return {
          succeeded: docs.map(d => d._id),
          failed: [],
        };
      }
      return { succeeded: [], failed: [] };
    });
    getAllDocs.mockImplementation(async db => {
      if (db === 'recurring') return [];
      if (db === 'contacts') return [];
      if (db === 'items') return [];
      return [];
    });
    const ipc = {
      invoke: vi.fn(async (channel, payload) => {
        if (channel === 'backup-snapshot') {
          snapshotPayload = payload;
          return { filePath: '/tmp/safety.json' };
        }
      }),
    };
    const incoming = {
      _id: 'rp-old',
      name: 'Old',
      active: true,
      interval: 'monthly',
      every: 1,
      anchorDay: 1,
      startDate: '2020-01-01',
      nextDate: '2020-02-01',
      endDate: null,
      template: {
        docType: 'invoice',
        recipient: { fullname: 'C', email: 'c@x.com' },
        rows: [
          {
            id: 'r1',
            description: 'Work',
            quantity: '1',
            price: '1',
            subtotal: 1,
          },
        ],
        currency: {
          code: 'USD',
          fraction: 2,
          separator: 'commaDot',
          placement: 'before',
        },
      },
    };
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T12:00:00'));
    await runImport(
      { contacts: [], invoices: [], recurring: [incoming] },
      { mode: 'skip', includeSettings: false },
      { ipc }
    );
    vi.useRealTimers();
    expect(snapshotPayload.recurring).toEqual([]);
    const recurringWrite = bulkSaveDocs.mock.calls.find(
      c => c[0] === 'recurring'
    );
    expect(recurringWrite).toBeDefined();
    expect(recurringWrite[1][0].nextDate >= '2026-03-01').toBe(true);
  });

  it('passes the existing _rev to bulkSaveDocs on overwrite', async () => {
    const { bulkSaveDocs, getAllDocs } = await import('../pouchDB');
    bulkSaveDocs.mockReset();
    bulkSaveDocs.mockImplementation(async (_db, docs) => ({
      succeeded: docs.map(doc => doc._id),
      failed: [],
    }));
    getAllDocs.mockReset();
    getAllDocs.mockImplementation(async db => {
      if (db === 'invoices') {
        return [{ _id: 'i1', _rev: '1-abc' }];
      }
      return [];
    });
    const ipc = {
      invoke: vi.fn(async channel => {
        if (channel === 'backup-snapshot') {
          return { filePath: '/tmp/safety.json' };
        }
      }),
    };
    await runImport(
      {
        contacts: [],
        invoices: [{ _id: 'i1', status: 'pending' }],
      },
      { mode: 'overwrite', includeSettings: false },
      { ipc }
    );
    const invoiceWrite = bulkSaveDocs.mock.calls.find(
      call => call[0] === 'invoices'
    );
    expect(invoiceWrite[1]).toEqual([
      { _id: 'i1', status: 'pending', _rev: '1-abc' },
    ]);
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

  it('blocks new writes once import lock is requested while older writes finish', async () => {
    const { withImportWriteLock, trackImportWriteStart, isImportWriteLocked } =
      await import('../importWriteLock');

    const endOldWrite = trackImportWriteStart();
    expect(endOldWrite).toBeTypeOf('function');

    let releaseImport;
    const importBlocked = new Promise(resolve => {
      releaseImport = resolve;
    });

    const importPromise = withImportWriteLock(async () => {
      await importBlocked;
      return 'imported';
    });

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(isImportWriteLocked()).toBe(true);
    expect(trackImportWriteStart()).toBeNull();

    endOldWrite();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(isImportWriteLocked()).toBe(true);

    releaseImport();
    await expect(importPromise).resolves.toBe('imported');
    expect(isImportWriteLocked()).toBe(false);
  });

  it('keeps the lock until applySettings finishes', async () => {
    const { bulkSaveDocs, getAllDocs } = await import('../pouchDB');
    bulkSaveDocs.mockResolvedValue({ succeeded: [], failed: [] });
    const { isImportWriteLocked } = await import('../importWriteLock');
    let lockedDuringApply = false;
    const ipc = {
      invoke: vi.fn(async channel => {
        if (channel === 'backup-snapshot') {
          return { filePath: '/tmp/safety.json' };
        }
      }),
    };
    await runImport(
      {
        contacts: [],
        invoices: [],
        settings: {
          general: { language: 'en', theme: 'system', sound: 'default' },
        },
      },
      { mode: 'skip', includeSettings: true },
      {
        ipc,
        applySettings: async () => {
          lockedDuringApply = isImportWriteLocked();
          return [];
        },
      }
    );
    expect(lockedDuringApply).toBe(true);
    expect(isImportWriteLocked()).toBe(false);
  });
});
