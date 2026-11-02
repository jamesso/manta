import 'fake-indexeddb/auto';
import { vi, describe, it, expect, beforeAll } from 'vitest';

vi.mock('pouchdb-browser', async () => vi.importActual('pouchdb-browser'));

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
    const docs = await saveDoc('contacts', { _id: 'c1', fullname: 'A' });
    expect(docs.some(d => d._id === 'c1')).toBe(true);
  });

  it('updateDoc changes a contact', async () => {
    const all = await getAllDocs('contacts');
    const saved = all.find(d => d._id === 'c1');
    const docs = await updateDoc('contacts', { ...saved, fullname: 'B' });
    expect(docs.find(d => d._id === 'c1').fullname).toBe('B');
  });

  it('deleteDoc removes a contact', async () => {
    const docs = await deleteDoc('contacts', 'c1');
    expect(docs.some(d => d._id === 'c1')).toBe(false);
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
      const { removed, failed, docs } = await removeDocs('invoices', [
        'bulk-a',
        'missing',
      ]);
      expect(removed).toHaveLength(1);
      expect(removed[0]._id).toBe('bulk-a');
      expect(removed[0]._rev).toBeUndefined();
      expect(failed).toEqual(['missing']);
      expect(docs.some(d => d._id === 'bulk-a')).toBe(false);
    });

    it('restoreDocs re-creates removed docs and skips 409 conflicts', async () => {
      const snapshot = {
        _id: 'bulk-a',
        status: 'pending',
        currency: { code: 'USD' },
        clientNote: 'original',
      };
      await restoreDocs('invoices', [snapshot]);
      let docs = await getAllDocs('invoices');
      expect(docs.find(d => d._id === 'bulk-a').clientNote).toBe('original');

      const live = docs.find(d => d._id === 'bulk-a');
      await updateDoc('invoices', { ...live, clientNote: 'replaced' });
      await restoreDocs('invoices', [snapshot]);
      docs = await getAllDocs('invoices');
      expect(docs.find(d => d._id === 'bulk-a').clientNote).toBe('replaced');
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
        expect(err.docs.find(x => x._id === 'bulk-u1').status).toBe('paid');
        expect(err.succeeded).toEqual(['bulk-u1']);
        expect(err.failed).toHaveLength(1);
      }
    });
  });
});
