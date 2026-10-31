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
});
