import * as T from '../../constants/actions.jsx';
import {
  persistInvoiceNumberingCounter,
  readInvoiceNumberingCounter,
  resolveInvoiceNumberingForAllocation,
  runInvoiceNumberingWrite,
} from '../invoiceNumberingWrites';
import { getAllDocs } from '../pouchDB';
import { buildRecurringTombstone } from '../recurring';

vi.mock('../pouchDB', () => ({
  getAllDocs: vi.fn(),
}));

describe('invoiceNumberingWrites', () => {
  it('serializes overlapping allocation tasks', async () => {
    const order = [];
    await Promise.all([
      runInvoiceNumberingWrite(async () => {
        order.push('a-start');
        await new Promise(r => setTimeout(r, 20));
        order.push('a-end');
      }),
      runInvoiceNumberingWrite(async () => {
        order.push('b-start');
        order.push('b-end');
      }),
    ]);
    expect(order).toEqual(['a-start', 'a-end', 'b-start', 'b-end']);
  });

  it('raises next from persisted invoice numbers after failed settings write', async () => {
    const store = {
      get: () => ({ prefix: 'INV-', next: 1, padding: 4 }),
      set: () => {
        throw new Error('disk');
      },
    };
    getAllDocs.mockResolvedValue([
      {
        _id: 'saved',
        docType: 'invoice',
        invoiceID: 'INV-0001',
        rows: [{ subtotal: 1 }],
        recipient: { fullname: 'A' },
      },
    ]);
    await persistInvoiceNumberingCounter(
      store,
      { prefix: 'INV-', next: 2, padding: 4 },
      { dispatch: vi.fn(), actionTypes: T }
    );
    expect(readInvoiceNumberingCounter(store, null).next).toBe(2);
    const resolved = await resolveInvoiceNumberingForAllocation(store, null);
    expect(resolved.next).toBe(2);
  });

  it('ignores tombstones estimates and credit notes when reconciling', async () => {
    getAllDocs.mockResolvedValue([
      buildRecurringTombstone('p', '2026-11-02'),
      {
        _id: 'e',
        docType: 'estimate',
        invoiceID: 'INV-0099',
        rows: [],
        recipient: {},
      },
      {
        _id: 'cn',
        docType: 'creditNote',
        invoiceID: 'INV-0005',
        rows: [],
        recipient: {},
      },
      {
        _id: 'i',
        docType: 'invoice',
        invoiceID: 'INV-0003',
        rows: [],
        recipient: {},
      },
    ]);
    const store = {
      get: () => ({ prefix: 'INV-', next: 1, padding: 4 }),
    };
    const resolved = await resolveInvoiceNumberingForAllocation(store, null);
    expect(resolved.next).toBe(4);
  });
});
