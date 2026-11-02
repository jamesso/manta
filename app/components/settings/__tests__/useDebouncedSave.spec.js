import { isEqual } from 'lodash';
import { act, renderHook } from '@testing-library/react';

import { useDebouncedSave } from '../useDebouncedSave';

const rate19 = [
  {
    id: 'standard',
    name: 'Standard',
    rate: 19,
    category: 'S',
    isDefault: true,
    active: true,
    exemptionReason: '',
  },
];

const rate7 = [{ ...rate19[0], rate: 7 }];

function invoiceSettings(overrides = {}) {
  return {
    template: 'minimal',
    taxRates: rate19,
    taxRatesRevision: 0,
    ...overrides,
  };
}

function simulateInvoiceSave(getStored, setStored) {
  return async payload => {
    await Promise.resolve();
    const stored = getStored();
    const merged = { ...stored, ...payload };
    const incomingRates =
      'taxRates' in payload ? payload.taxRates : stored.taxRates;
    const storedRev = Number(stored.taxRatesRevision ?? 0);
    if ('taxRates' in payload && !isEqual(incomingRates, stored.taxRates)) {
      if (Number(payload.taxRatesRevision ?? 0) !== storedRev) {
        return { ok: false, conflict: 'taxRates' };
      }
      merged.taxRates = incomingRates;
      merged.taxRatesRevision = storedRev + 1;
    } else {
      merged.taxRates = stored.taxRates;
      merged.taxRatesRevision = storedRev;
    }
    setStored(merged);
    return { ok: true, data: merged };
  };
}

describe('useDebouncedSave', () => {
  it('serializes overlapping saveNow and keeps bumped taxRatesRevision', async () => {
    let stored = invoiceSettings();
    const save = vi.fn(
      simulateInvoiceSave(
        () => stored,
        next => {
          stored = next;
        }
      )
    );

    const { result } = renderHook(
      ({ value }) => useDebouncedSave(value, save),
      { initialProps: { value: stored } }
    );

    let first;
    let second;
    await act(async () => {
      first = result.current.saveNow(current => ({
        ...current,
        taxRates: rate7,
        taxRatesRevision: 0,
      }));
      second = result.current.saveNow(current => ({
        ...current,
        template: 'business',
      }));
    });

    const [r1, r2] = await Promise.all([first, second]);
    expect(r1).toMatchObject({ ok: true });
    expect(r2).toMatchObject({ ok: true });
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].taxRatesRevision).toBe(1);
    expect(stored.taxRates[0].rate).toBe(7);
    expect(stored.template).toBe('business');
    expect(stored.taxRatesRevision).toBe(1);
    expect(result.current.draft.taxRatesRevision).toBe(1);
  });

  it('returns conflict when save rejects stale taxRatesRevision', async () => {
    let stored = invoiceSettings({ taxRatesRevision: 1, taxRates: rate7 });
    const save = vi.fn(
      simulateInvoiceSave(
        () => stored,
        next => {
          stored = next;
        }
      )
    );

    const { result } = renderHook(
      ({ value }) => useDebouncedSave(value, save),
      { initialProps: { value: stored } }
    );

    let conflict;
    await act(async () => {
      conflict = await result.current.saveNow(current => ({
        ...current,
        taxRates: rate19,
        taxRatesRevision: 0,
      }));
    });

    expect(conflict).toEqual({ ok: false, conflict: 'taxRates' });
    expect(stored.taxRates[0].rate).toBe(7);
    expect(stored.taxRatesRevision).toBe(1);
  });
});
