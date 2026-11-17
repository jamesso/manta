import 'fake-indexeddb/auto';
import { vi, describe, it, expect, beforeAll } from 'vitest';
import PouchDB from 'pouchdb-browser';

vi.mock('pouchdb-browser', async () => vi.importActual('pouchdb-browser'));

function failNextReload(dbName) {
  const list = PouchDB._destructionListeners?.get(dbName);
  if (!list?.length) {
    throw new Error(`No open database named ${dbName}`);
  }
  let pending = true;
  const spies = list.map(db => {
    const original = db.allDocs.bind(db);
    return vi.spyOn(db, 'allDocs').mockImplementation((...args) => {
      const opts = args[0];
      if (pending && opts && typeof opts === 'object' && opts.include_docs) {
        pending = false;
        return Promise.reject(new Error('reload failed'));
      }
      return original(...args);
    });
  });
  return {
    mockRestore() {
      spies.forEach(spy => spy.mockRestore());
    },
  };
}

describe('invoice migration', () => {
  it('migrates historical invoices without currency on first open', async () => {
    // 2a32058^ saved pending invoices using the obsolete appSettings.currency key.
    const historical = {
      _id: 'historical-no-currency',
      status: 'pending',
      created_at: 1514700000000,
      rows: [],
      subtotal: 0,
      grandTotal: 0,
    };
    const withCurrency = {
      _id: 'historical-with-currency',
      status: 'pending',
      currency: { code: 'EUR' },
      dueDate: '2018-02-01',
      configs: { accentColor: { color: '#123456', useCustom: true } },
    };
    const previousVersion = localStorage.getItem('invoicesVersion');
    const db = new PouchDB('invoices', { adapter: 'idb' });
    vi.resetModules();
    localStorage.removeItem('invoicesVersion');
    try {
      await db.bulkDocs([historical, withCurrency]);
      const { getAllDocs } = await import('../pouchDB.js');
      const docs = await getAllDocs('invoices');
      const migrated = docs.find(doc => doc._id === historical._id);
      const { _rev, ...body } = migrated;
      expect(body).toEqual(historical);
      expect(localStorage.getItem('invoicesVersion')).toBe('4');
      expect(docs.find(doc => doc._id === withCurrency._id)).toMatchObject({
        status: 'pending',
        currency: {
          code: 'EUR',
          placement: 'before',
          separator: 'commaDot',
          fraction: 2,
        },
        dueDate: { selectedDate: '2018-02-01', useCustom: true },
        configs: { accentColor: '#123456', customAccentColor: true },
      });
    } finally {
      await db.destroy();
      vi.resetModules();
      if (previousVersion === null) {
        localStorage.removeItem('invoicesVersion');
      } else {
        localStorage.setItem('invoicesVersion', previousVersion);
      }
    }
  });
});

describe('pouchDB helpers', () => {
  let getAllDocs;
  let saveDoc;
  let updateDoc;
  let deleteDoc;
  let getSingleDoc;

  beforeAll(async () => {
    localStorage.clear();
    const mod = await import('../pouchDB.js');
    getAllDocs = mod.getAllDocs;
    saveDoc = mod.saveDoc;
    updateDoc = mod.updateDoc;
    deleteDoc = mod.deleteDoc;
    getSingleDoc = mod.getSingleDoc;
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  it('saveDoc adds a contact', async () => {
    const result = await saveDoc('contacts', { _id: 'c1', fullname: 'A' });
    expect(result).toEqual({ ok: true, id: 'c1', rev: expect.any(String) });
    const docs = await getAllDocs('contacts');
    expect(docs.some(d => d._id === 'c1')).toBe(true);
  });

  it('updateDoc changes a contact', async () => {
    const all = await getAllDocs('contacts');
    const saved = all.find(d => d._id === 'c1');
    const result = await updateDoc('contacts', { ...saved, fullname: 'B' });
    expect(result).toEqual({ ok: true, id: 'c1', rev: expect.any(String) });
    const docs = await getAllDocs('contacts');
    expect(docs.find(d => d._id === 'c1').fullname).toBe('B');
  });

  it('deleteDoc removes a contact', async () => {
    expect(await deleteDoc('contacts', 'c1')).toEqual({ ok: true, id: 'c1' });
    const docs = await getAllDocs('contacts');
    expect(docs.some(d => d._id === 'c1')).toBe(false);
  });

  it('mutation helpers never load the full list', async () => {
    const mod = await import('../pouchDB.js');
    const dbs = PouchDB._destructionListeners.get('contacts');
    const spies = dbs.map(db => vi.spyOn(db, 'allDocs'));
    try {
      await saveDoc('contacts', { _id: 'contract-1' });
      const doc = await getSingleDoc('contacts', 'contract-1');
      await updateDoc('contacts', { ...doc, fullname: 'B' });
      const current = await getSingleDoc('contacts', 'contract-1');
      expect(await mod.updateDocs('contacts', [current])).toEqual({
        succeeded: ['contract-1'],
        failed: [],
      });
      expect(
        await mod.bulkSaveDocs('contacts', [{ _id: 'contract-2' }])
      ).toEqual({ succeeded: ['contract-2'], failed: [] });
      const result = await mod.removeDocs('contacts', [
        'contract-1',
        'missing',
      ]);
      expect(result.succeeded).toEqual(['contract-1']);
      expect(result.failed).toEqual(['missing']);
      await mod.restoreDocs('contacts', result.removed);
      await deleteDoc('contacts', 'contract-1');
      await deleteDoc('contacts', 'contract-2');
      spies.forEach(spy => expect(spy).not.toHaveBeenCalled());
    } finally {
      spies.forEach(spy => spy.mockRestore());
    }
  });

  it('saveDoc adds an invoice and getAllDocs lists it', async () => {
    await saveDoc('invoices', {
      _id: 'i1',
      status: 'pending',
      currency: { code: 'USD' },
    });
    const docs = await getAllDocs('invoices');
    expect(docs.some(d => d._id === 'i1')).toBe(true);
  });

  it('getSingleDoc rejects for a missing document', async () => {
    await expect(getSingleDoc('contacts', 'missing')).rejects.toBeDefined();
  });

  it('saveDoc stores items in the items database only', async () => {
    await saveDoc('items', {
      _id: 'it1',
      name: 'Item',
      unitPrice: 1,
      unitCode: 'C62',
    });
    const items = await getAllDocs('items');
    expect(items.some(d => d._id === 'it1')).toBe(true);
    const contacts = await getAllDocs('contacts');
    expect(contacts.some(d => d._id === 'it1')).toBe(false);
  });

  it('getAllDocs rejects unknown database names', async () => {
    await expect(getAllDocs('nope')).rejects.toThrow('Unknown database: nope');
  });

  it('saveDoc stores recurring profiles in the recurring database only', async () => {
    await saveDoc('recurring', { _id: 'r1', name: 'A', active: true });
    const recurring = await getAllDocs('recurring');
    expect(recurring.some(d => d._id === 'r1')).toBe(true);
    const invoices = await getAllDocs('invoices');
    expect(invoices.some(d => d._id === 'r1')).toBe(false);
  });

  describe('bulk invoice helpers', () => {
    let removeDocs;
    let restoreDocs;
    let updateDocs;

    beforeAll(async () => {
      const mod = await import('../pouchDB.js');
      removeDocs = mod.removeDocs;
      restoreDocs = mod.restoreDocs;
      updateDocs = mod.updateDocs;
    });

    it('removeDocs snapshots without _rev and tracks failures', async () => {
      await saveDoc('invoices', {
        _id: 'bulk-a',
        status: 'pending',
        currency: { code: 'USD' },
      });
      const { removed, failed, succeeded } = await removeDocs('invoices', [
        'bulk-a',
        'missing',
      ]);
      expect(removed).toHaveLength(1);
      expect(removed[0]._id).toBe('bulk-a');
      expect(removed[0]._rev).toBeUndefined();
      expect(failed).toEqual(['missing']);
      expect(succeeded).toEqual(['bulk-a']);
      const docs = await getAllDocs('invoices');
      expect(docs.some(d => d._id === 'bulk-a')).toBe(false);
    });

    it('restoreDocs re-creates a removed doc when no successor exists', async () => {
      const snapshot = {
        _id: 'bulk-a',
        status: 'pending',
        currency: { code: 'USD' },
        clientNote: 'original',
      };
      expect(await restoreDocs('invoices', [snapshot])).toEqual({
        succeeded: ['bulk-a'],
        failed: [],
      });
      const docs = await getAllDocs('invoices');
      expect(docs.find(d => d._id === 'bulk-a').clientNote).toBe('original');
    });

    it('restoreDocs rejects a 409 when a successor document exists', async () => {
      const snapshot = {
        _id: 'restore-conflict-1',
        status: 'pending',
        currency: { code: 'USD' },
      };
      await saveDoc('invoices', snapshot);
      await deleteDoc('invoices', snapshot._id);
      await saveDoc('invoices', {
        _id: snapshot._id,
        recurringTombstone: true,
      });
      try {
        await restoreDocs('invoices', [snapshot]);
        expect.unreachable('should reject partial-restore');
      } catch (err) {
        expect(err.message).toBe('partial-restore');
        expect(err.failed).toHaveLength(1);
        expect(err.failed[0].id).toBe(snapshot._id);
        expect(err.failed[0].status).toBe(409);
        expect(err.failed[0].message).toEqual(expect.any(String));
        expect(err.restored).not.toContain(snapshot._id);
      }
    });

    it('restoreDocs partial failure reports earlier restores for an explicit reload', async () => {
      try {
        await restoreDocs('invoices', [
          {
            _id: 'partial-restore-1',
            status: 'pending',
            currency: { code: 'USD' },
          },
          { status: 'pending', currency: { code: 'USD' } },
        ]);
        expect.unreachable('should reject partial-restore');
      } catch (err) {
        expect(err.message).toBe('partial-restore');
        const docs = await getAllDocs('invoices');
        expect(docs.some(d => d._id === 'partial-restore-1')).toBe(true);
        expect(err.restored).toEqual(['partial-restore-1']);
        expect(err.failed).toHaveLength(1);
      }
    });

    it('bulkSaveDocs adds and overwrites', async () => {
      const mod = await import('../pouchDB.js');
      const { bulkSaveDocs, saveDoc, getAllDocs } = mod;
      await saveDoc('contacts', { _id: 'b1', fullname: 'A', email: 'a@b.co' });
      const existing = (await getAllDocs('contacts')).find(d => d._id === 'b1');
      const result = await bulkSaveDocs('contacts', [
        { _id: 'b2', fullname: 'B', email: 'b@b.co' },
        { ...existing, fullname: 'A2' },
        { _id: 'b1', _rev: '0-0', fullname: 'Stale' },
      ]);
      expect(result.succeeded).toContain('b2');
      expect(result.failed.length).toBeGreaterThan(0);
      const docs = await getAllDocs('contacts');
      expect(docs.find(d => d._id === 'b1').fullname).toBe('A2');
    });

    it('updateDocs partial failure keeps successful writes in DB', async () => {
      await saveDoc('invoices', {
        _id: 'bulk-u1',
        status: 'pending',
        currency: { code: 'USD' },
      });
      await saveDoc('invoices', {
        _id: 'bulk-u2',
        status: 'pending',
        currency: { code: 'USD' },
      });
      const all = await getAllDocs('invoices');
      const d1 = all.find(d => d._id === 'bulk-u1');
      const d2 = all.find(d => d._id === 'bulk-u2');
      const stale = { ...d2, _rev: '1-deadbeef' };
      try {
        await updateDocs('invoices', [
          { ...d1, status: 'paid' },
          { ...stale, status: 'paid' },
        ]);
        expect.unreachable('should reject partial-update');
      } catch (err) {
        expect(err.message).toBe('partial-update');
        expect(err.written.find(x => x._id === 'bulk-u1').status).toBe('paid');
        expect(err.succeeded).toEqual(['bulk-u1']);
        expect(err.failed).toHaveLength(1);
      }
    });

    it('updateDocs retains written revisions without a reload on partial failure', async () => {
      await saveDoc('invoices', {
        _id: 'reload-u1',
        status: 'pending',
        currency: { code: 'USD' },
      });
      await saveDoc('invoices', {
        _id: 'reload-u2',
        status: 'pending',
        currency: { code: 'USD' },
      });
      const all = await getAllDocs('invoices');
      const d1 = all.find(d => d._id === 'reload-u1');
      const d2 = all.find(d => d._id === 'reload-u2');
      const reload = failNextReload('invoices');
      let err;
      try {
        await updateDocs('invoices', [
          { ...d1, status: 'paid' },
          { ...d2, _rev: '1-deadbeef', status: 'paid' },
        ]);
        expect.unreachable('should reject partial-update');
      } catch (error) {
        err = error;
      } finally {
        reload.mockRestore();
      }
      expect(err.message).toBe('partial-update');
      expect(err.succeeded).toEqual(['reload-u1']);
      expect(err.failed).toEqual([
        expect.objectContaining({ id: 'reload-u2', status: 409 }),
      ]);
      expect(err.written).toHaveLength(1);
      expect(err.written[0]).toMatchObject({
        _id: 'reload-u1',
        status: 'paid',
      });
      expect(err.written[0]._rev).toEqual(expect.any(String));
      expect(err.written[0]._rev).not.toBe(d1._rev);
      const after = await getAllDocs('invoices');
      expect(after.find(d => d._id === 'reload-u1')).toMatchObject({
        status: 'paid',
        _rev: err.written[0]._rev,
      });
      expect(after.find(d => d._id === 'reload-u2').status).toBe('pending');
    });

    it('updateDocs succeeds without a reload when every put succeeds', async () => {
      await saveDoc('contacts', { _id: 'no-reload', fullname: 'A' });
      const doc = await getSingleDoc('contacts', 'no-reload');
      const reload = failNextReload('contacts');
      try {
        expect(
          await updateDocs('contacts', [{ ...doc, fullname: 'B' }])
        ).toEqual({
          succeeded: ['no-reload'],
          failed: [],
        });
        await expect(getAllDocs('contacts')).rejects.toThrow('reload failed');
      } finally {
        reload.mockRestore();
      }
      expect((await getSingleDoc('contacts', doc._id)).fullname).toBe('B');
    });

    it('updateDocs reports write conflicts without a reload when every put fails', async () => {
      const doc = await getSingleDoc('contacts', 'no-reload');
      const reload = failNextReload('contacts');
      try {
        await expect(
          updateDocs('contacts', [{ ...doc, _rev: '1-stale' }])
        ).rejects.toMatchObject({
          message: 'partial-update',
          succeeded: [],
          written: [],
          failed: [expect.objectContaining({ id: doc._id, status: 409 })],
        });
        await expect(getAllDocs('contacts')).rejects.toThrow('reload failed');
      } finally {
        reload.mockRestore();
      }
    });
  });
});
