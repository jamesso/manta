import { runImport } from '../backupFlow';

vi.mock('../pouchDB', () => ({
  getAllDocs: vi.fn(async db => (db === 'contacts' ? [{ _id: 'c1' }] : [])),
  bulkSaveDocs: vi.fn(async () => ({
    succeeded: ['c2'],
    failed: [],
    allDocs: [],
  })),
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
});
