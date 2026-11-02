import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { runRecurringOnce } from '../recurringRunner';
import { buildRecurringTombstone } from '../recurring';
import { dateKeyToMs } from '../recurringSchedule';

function memoryDb(initial = {}) {
  const stores = {
    recurring: [...(initial.recurring ?? [])],
    invoices: [...(initial.invoices ?? [])],
  };
  const failId = initial.failSaveId ?? null;

  return {
    getAllDocs: async name => stores[name].map(d => ({ ...d })),
    getSingleDoc: async (name, id) => {
      const doc = stores[name].find(d => d._id === id);
      if (!doc) {
        const err = new Error('missing');
        err.status = 404;
        throw err;
      }
      return { ...doc };
    },
    saveDoc: async (name, doc) => {
      if (failId && doc._id === failId) {
        const err = new Error('conflict');
        err.status = 409;
        throw err;
      }
      if (stores[name].some(d => d._id === doc._id)) {
        const err = new Error('conflict');
        err.status = 409;
        throw err;
      }
      stores[name].push({ ...doc });
      return stores[name];
    },
    updateDoc: async (name, doc) => {
      const idx = stores[name].findIndex(d => d._id === doc._id);
      if (idx === -1) {
        throw new Error('missing');
      }
      stores[name][idx] = { ...doc };
      return stores[name];
    },
    stores,
  };
}

describe('runRecurringOnce', () => {
  const now = dateKeyToMs('2026-03-01');

  it('creates missed monthly drafts and advances nextDate', async () => {
    const profile = {
      _id: 'p1',
      name: 'A',
      active: true,
      interval: 'monthly',
      every: 1,
      anchorDay: 1,
      startDate: '2026-01-01',
      nextDate: '2026-01-01',
      endDate: null,
      template: {
        docType: 'invoice',
        recipient: { fullname: 'C' },
        rows: [{ id: 'r', quantity: '1', price: '1' }],
      },
    };
    const db = memoryDb({ recurring: [profile], invoices: [] });
    const first = await runRecurringOnce({ now, db, makeId: () => 'row-1' });
    expect(first.created).toBe(3);
    const updated = db.stores.recurring[0];
    expect(updated.nextDate).toBe('2026-04-01');
    const second = await runRecurringOnce({ now, db, makeId: () => 'row-2' });
    expect(second.created).toBe(0);
  });

  it('counts 409 skip when draft already exists', async () => {
    const profile = {
      _id: 'p1',
      active: true,
      interval: 'monthly',
      every: 1,
      anchorDay: 1,
      startDate: '2026-03-01',
      nextDate: '2026-03-01',
      endDate: null,
      template: {
        docType: 'invoice',
        recipient: { fullname: 'C' },
        rows: [{ id: 'r', quantity: '1', price: '1' }],
      },
    };
    const existing = {
      _id: 'rec-p1-2026-03-01',
      recurringId: 'p1',
      periodKey: '2026-03-01',
      status: 'draft',
      docType: 'invoice',
    };
    const db = memoryDb({ recurring: [profile], invoices: [existing] });
    const result = await runRecurringOnce({
      now: dateKeyToMs('2026-03-01'),
      db,
    });
    expect(result.created).toBe(0);
    expect(result.skipped).toBeGreaterThan(0);
  });

  it('does not advance nextDate past a failed period', async () => {
    const profile = {
      _id: 'p1',
      active: true,
      interval: 'monthly',
      every: 1,
      anchorDay: 1,
      startDate: '2026-01-01',
      nextDate: '2026-01-01',
      endDate: null,
      template: {
        docType: 'invoice',
        recipient: { fullname: 'C' },
        rows: [{ id: 'r', quantity: '1', price: '1' }],
      },
    };
    const db = memoryDb({
      recurring: [profile],
      invoices: [],
      failSaveId: 'rec-p1-2026-02-01',
    });
    const result = await runRecurringOnce({ now, db });
    expect(result.created).toBe(1);
    expect(result.errors.length).toBe(1);
    expect(db.stores.recurring[0].nextDate).toBe('2026-02-01');
  });

  it('skips paused profiles', async () => {
    const profile = {
      _id: 'p1',
      active: false,
      interval: 'monthly',
      every: 1,
      anchorDay: 1,
      startDate: '2026-01-01',
      nextDate: '2026-01-01',
      template: {
        docType: 'invoice',
        recipient: { fullname: 'C' },
        rows: [{ id: 'r', quantity: '1', price: '1' }],
      },
    };
    const db = memoryDb({ recurring: [profile], invoices: [] });
    const result = await runRecurringOnce({ now, db });
    expect(result.created).toBe(0);
  });

  it('does not recreate a period when a tombstone exists', async () => {
    const profile = {
      _id: 'p1',
      active: true,
      interval: 'monthly',
      every: 1,
      anchorDay: 1,
      startDate: '2026-03-01',
      nextDate: '2026-03-01',
      endDate: null,
      template: {
        docType: 'invoice',
        recipient: { fullname: 'C' },
        rows: [{ id: 'r', quantity: '1', price: '1' }],
      },
    };
    const tombstone = buildRecurringTombstone('p1', '2026-03-01');
    const db = memoryDb({ recurring: [profile], invoices: [tombstone] });
    const result = await runRecurringOnce({
      now: dateKeyToMs('2026-03-01'),
      db,
    });
    expect(result.created).toBe(0);
    expect(db.stores.invoices.filter(d => !d.recurringTombstone)).toHaveLength(
      0
    );
  });

  it('skips periods when drafts already exist', async () => {
    const profile = {
      _id: 'p1',
      active: true,
      interval: 'monthly',
      every: 1,
      anchorDay: 1,
      startDate: '2026-03-01',
      nextDate: '2026-03-01',
      endDate: null,
      template: {
        docType: 'invoice',
        recipient: { fullname: 'C' },
        rows: [{ id: 'r', quantity: '1', price: '1' }],
      },
    };
    const draft = {
      _id: 'rec-p1-2026-03-01',
      recurringId: 'p1',
      periodKey: '2026-03-01',
      status: 'draft',
    };
    const db = memoryDb({ recurring: [profile], invoices: [draft] });
    const result = await runRecurringOnce({
      now: dateKeyToMs('2026-03-01'),
      db,
    });
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('keeps user-edited nextDate when profile changes mid-run', async () => {
    const profile = {
      _id: 'p1',
      name: 'A',
      active: true,
      interval: 'monthly',
      every: 1,
      anchorDay: 1,
      startDate: '2026-01-01',
      nextDate: '2026-01-01',
      endDate: null,
      template: {
        docType: 'invoice',
        recipient: { fullname: 'C' },
        rows: [{ id: 'r', quantity: '1', price: '1' }],
      },
    };
    let invoiceSaves = 0;
    const stores = {
      recurring: [{ ...profile }],
      invoices: [],
    };
    const db = {
      getAllDocs: async name => stores[name].map(d => ({ ...d })),
      getSingleDoc: async (name, id) => {
        const doc = stores[name].find(d => d._id === id);
        if (!doc) {
          const err = new Error('missing');
          err.status = 404;
          throw err;
        }
        if (name === 'recurring' && invoiceSaves > 0) {
          return { ...doc, nextDate: '2026-06-01' };
        }
        return { ...doc };
      },
      saveDoc: async (name, doc) => {
        if (stores[name].some(d => d._id === doc._id)) {
          const err = new Error('conflict');
          err.status = 409;
          throw err;
        }
        stores[name].push({ ...doc });
        if (name === 'invoices') {
          invoiceSaves += 1;
        }
        return stores[name];
      },
      updateDoc: async (name, doc) => {
        const idx = stores[name].findIndex(d => d._id === doc._id);
        stores[name][idx] = { ...doc };
        return stores[name];
      },
      stores,
    };
    await runRecurringOnce({ now: dateKeyToMs('2026-03-01'), db });
    expect(stores.recurring[0].nextDate).toBe('2026-06-01');
  });

  it('stops creating when profile is paused mid-run', async () => {
    const profile = {
      _id: 'p1',
      active: true,
      interval: 'monthly',
      every: 1,
      anchorDay: 1,
      startDate: '2026-01-01',
      nextDate: '2026-01-01',
      endDate: null,
      template: {
        docType: 'invoice',
        recipient: { fullname: 'C' },
        rows: [{ id: 'r', quantity: '1', price: '1' }],
      },
    };
    let saves = 0;
    const stores = {
      recurring: [{ ...profile }],
      invoices: [],
    };
    const db = {
      getAllDocs: async name => stores[name].map(d => ({ ...d })),
      getSingleDoc: async (name, id) => {
        const doc = stores[name].find(d => d._id === id);
        if (!doc) {
          const err = new Error('missing');
          err.status = 404;
          throw err;
        }
        if (name === 'recurring' && saves >= 1) {
          return { ...doc, active: false };
        }
        return { ...doc };
      },
      saveDoc: async (name, doc) => {
        stores[name].push({ ...doc });
        if (name === 'invoices') {
          saves += 1;
        }
        return stores[name];
      },
      updateDoc: async (name, doc) => {
        const idx = stores[name].findIndex(d => d._id === doc._id);
        stores[name][idx] = { ...doc };
        return stores[name];
      },
      stores,
    };
    const result = await runRecurringOnce({
      now: dateKeyToMs('2026-03-01'),
      db,
    });
    expect(result.created).toBe(1);
    expect(stores.invoices).toHaveLength(1);
  });
});

describe('runRecurringOnce tombstone with PouchDB', () => {
  it('does not create a second draft after delete leaves tombstone', async () => {
    vi.resetModules();
    localStorage.clear();
    const mod = await import('../pouchDB.js');
    const { runRecurringOnce: runOnce } = await import('../recurringRunner.js');
    await new Promise(r => setTimeout(r, 500));

    const profile = {
      _id: 'prof-t',
      name: 'T',
      active: true,
      interval: 'monthly',
      every: 1,
      anchorDay: 15,
      startDate: '2026-03-15',
      nextDate: '2026-03-15',
      endDate: null,
      template: {
        docType: 'invoice',
        recipient: { fullname: 'Client' },
        rows: [{ id: 'r1', description: 'x', quantity: '1', price: '10' }],
        currency: {
          code: 'USD',
          fraction: 2,
          separator: 'commaDot',
          placement: 'before',
        },
      },
    };
    await mod.saveDoc('recurring', profile);
    const now = dateKeyToMs('2026-03-15');
    const first = await runOnce({ now });
    expect(first.created).toBe(1);
    const invoices = await mod.getAllDocs('invoices');
    const draft = invoices.find(d => d.recurringId === 'prof-t');
    expect(draft).toBeDefined();
    await mod.deleteDoc('invoices', draft._id);
    await mod.saveDoc(
      'invoices',
      buildRecurringTombstone('prof-t', '2026-03-15')
    );
    const second = await runOnce({ now });
    expect(second.created).toBe(0);
    const after = await mod.getAllDocs('invoices');
    expect(after.filter(d => !d.recurringTombstone)).toHaveLength(0);
    expect(after.some(d => d.recurringTombstone)).toBe(true);
  });
});
