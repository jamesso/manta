import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  settleCreditedInvoiceInDb,
  updateCreditedInvoiceInDb,
} from '../creditNoteSettlement';
import { getAllDocs, updateDocs } from '../pouchDB';

vi.mock('../pouchDB', () => ({
  getAllDocs: vi.fn(),
  updateDocs: vi.fn(),
}));

const currency = {
  code: 'USD',
  fraction: 2,
  placement: 'before',
  separator: 'commaDot',
};

function invoice(overrides = {}) {
  return {
    _id: 'inv-1',
    docType: 'invoice',
    status: 'pending',
    grandTotal: 1000,
    currency,
    ...overrides,
  };
}

function credit(overrides = {}) {
  return {
    _id: 'cn-1',
    docType: 'creditNote',
    status: 'issued',
    creditedInvoiceId: 'inv-1',
    grandTotal: 1000,
    currency,
    ...overrides,
  };
}

describe('settleCreditedInvoiceInDb', () => {
  beforeEach(() => {
    getAllDocs.mockReset();
    updateDocs.mockReset();
  });

  it('returns the loaded list when no invoice matches', async () => {
    const loaded = [invoice({ _id: 'other' })];
    getAllDocs.mockResolvedValue(loaded);
    const result = await settleCreditedInvoiceInDb('missing');
    expect(updateDocs).not.toHaveBeenCalled();
    expect(result).toBe(loaded);
  });

  it('writes the one changed invoice and reloads', async () => {
    const loaded = [invoice(), credit()];
    const reloaded = [{ _id: 'inv-1', status: 'cancelled' }];
    getAllDocs.mockResolvedValueOnce(loaded).mockResolvedValueOnce(reloaded);
    const result = await settleCreditedInvoiceInDb('inv-1');
    expect(updateDocs).toHaveBeenCalledTimes(1);
    expect(updateDocs.mock.calls[0][0]).toBe('invoices');
    expect(updateDocs.mock.calls[0][1]).toHaveLength(1);
    expect(updateDocs.mock.calls[0][1][0]).toMatchObject({
      _id: 'inv-1',
      status: 'cancelled',
    });
    expect(getAllDocs.mock.invocationCallOrder[1]).toBeGreaterThan(
      updateDocs.mock.invocationCallOrder[0]
    );
    expect(result).toBe(reloaded);
  });

  it('settles from caller documents without loading a list', async () => {
    updateDocs.mockResolvedValue({ succeeded: ['inv-1'], failed: [] });
    const changed = await updateCreditedInvoiceInDb('inv-1', [
      invoice(),
      credit(),
    ]);
    expect(changed).toBe(true);
    expect(getAllDocs).not.toHaveBeenCalled();
    expect(updateDocs.mock.calls[0][1][0]).toMatchObject({
      _id: 'inv-1',
      status: 'cancelled',
    });
  });

  it('does not write when the resolved invoice is the same object', async () => {
    const loaded = [invoice(), credit({ grandTotal: 400 })];
    getAllDocs.mockResolvedValue(loaded);
    const result = await settleCreditedInvoiceInDb('inv-1');
    expect(updateDocs).not.toHaveBeenCalled();
    expect(getAllDocs).toHaveBeenCalledTimes(1);
    expect(result).toBe(loaded);
  });
});
