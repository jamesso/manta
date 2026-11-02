import { describe, expect, it } from 'vitest';

import {
  buildDefaultTaxRates,
  buildSellerSnapshot,
  getDefaultTaxRate,
  getSellerTaxIds,
  getTaxRateErrors,
  getTaxRates,
  getTaxRatesErrors,
  matchLegacyTaxRate,
  resolveRowTaxRate,
  roundMoney,
} from '../tax';

describe('roundMoney', () => {
  it('rounds half away from zero', () => {
    expect(roundMoney(1.005, 2)).toBe(1.01);
    expect(roundMoney(2.675, 2)).toBe(2.68);
    expect(roundMoney(-1.005, 2)).toBe(-1.01);
  });

  it('handles fraction 0', () => {
    expect(roundMoney(0.5, 0)).toBe(1);
    expect(roundMoney(1234.5, 0)).toBe(1235);
  });

  it('normalizes tiny negatives to zero', () => {
    expect(roundMoney(-0.001, 2)).toBe(0);
    expect(Object.is(roundMoney(-0.001, 2), -0)).toBe(false);
  });
});

describe('buildDefaultTaxRates', () => {
  it('uses Standard S when legacy amount > 0', () => {
    const rates = buildDefaultTaxRates({ amount: 19 });
    expect(rates).toHaveLength(1);
    expect(rates[0].id).toBe('standard');
    expect(rates[0].category).toBe('S');
    expect(rates[0].rate).toBe(19);
  });

  it('uses Zero Z for zero, undefined, or missing tax', () => {
    for (const tax of [{ amount: 0 }, undefined, null]) {
      const rates = buildDefaultTaxRates(tax);
      expect(rates[0].id).toBe('zero');
      expect(rates[0].category).toBe('Z');
    }
  });
});

describe('getTaxRates', () => {
  it('falls back when taxRates is empty', () => {
    expect(getTaxRates({ taxRates: [], tax: { amount: 7 } })[0].rate).toBe(7);
  });
});

describe('resolveRowTaxRate', () => {
  const rates = [
    {
      id: 'a',
      name: 'A',
      rate: 19,
      category: 'S',
      isDefault: true,
      active: true,
      exemptionReason: '',
    },
    {
      id: 'b',
      name: 'B',
      rate: 7,
      category: 'S',
      isDefault: false,
      active: false,
      exemptionReason: '',
    },
  ];

  it('returns default for inactive id', () => {
    expect(resolveRowTaxRate('b', rates)?.id).toBe('a');
  });

  it('returns default for unknown id', () => {
    expect(resolveRowTaxRate('missing', rates)?.id).toBe('a');
  });

  it('returns null when no active rate', () => {
    expect(resolveRowTaxRate('a', [{ ...rates[1] }])).toBeNull();
  });
});

describe('matchLegacyTaxRate', () => {
  const rates = [
    {
      id: 'std',
      name: 'Std',
      rate: 19,
      category: 'S',
      isDefault: true,
      active: true,
      exemptionReason: '',
    },
    {
      id: 's7',
      name: '7',
      rate: 7,
      category: 'S',
      isDefault: false,
      active: true,
      exemptionReason: '',
    },
    {
      id: 'ae',
      name: 'AE',
      rate: 0,
      category: 'AE',
      isDefault: false,
      active: true,
      exemptionReason: 'RC',
    },
  ];

  it('reverse maps to AE', () => {
    expect(
      matchLegacyTaxRate({ method: 'reverse', amount: 19 }, rates)?.id
    ).toBe('ae');
  });

  it('matches S rate by amount', () => {
    expect(matchLegacyTaxRate({ amount: 7 }, rates)?.id).toBe('s7');
  });

  it('falls back to default', () => {
    expect(matchLegacyTaxRate({ amount: 99 }, rates)?.id).toBe('std');
  });
});

describe('getTaxRateErrors', () => {
  it('rejects invalid standard and zero rates', () => {
    expect(
      getTaxRateErrors({ name: 'X', category: 'S', rate: 0 }).rate
    ).toBeTruthy();
    expect(
      getTaxRateErrors({ name: 'X', category: 'S', rate: 101 }).rate
    ).toBeTruthy();
    expect(
      getTaxRateErrors({ name: 'X', category: 'Z', rate: 5 }).rate
    ).toBeTruthy();
  });

  it('requires exemption reason for E', () => {
    expect(
      getTaxRateErrors({
        name: 'X',
        category: 'E',
        rate: 0,
        exemptionReason: '',
      }).exemptionReason
    ).toBeTruthy();
  });

  it('accepts AE with reason', () => {
    expect(
      Object.keys(
        getTaxRateErrors({
          name: 'X',
          category: 'AE',
          rate: 0,
          exemptionReason: 'Reverse charge',
        })
      )
    ).toHaveLength(0);
  });

  it('rejects long name', () => {
    expect(
      getTaxRateErrors({ name: 'x'.repeat(41), category: 'S', rate: 19 }).name
    ).toBeTruthy();
  });
});

describe('getTaxRatesErrors', () => {
  const valid = {
    id: 'one',
    name: 'One',
    rate: 19,
    category: 'S',
    isDefault: true,
    active: true,
    exemptionReason: '',
  };

  it('flags duplicate id', () => {
    expect(getTaxRatesErrors([valid, { ...valid }]).taxRates).toBe(
      'settings:taxRates:errors:duplicateId'
    );
  });

  it('flags no default', () => {
    expect(getTaxRatesErrors([{ ...valid, isDefault: false }]).taxRates).toBe(
      'settings:taxRates:errors:noDefault'
    );
  });

  it('flags empty list', () => {
    expect(getTaxRatesErrors([]).taxRates).toBe(
      'settings:taxRates:errors:empty'
    );
  });
});

describe('getSellerTaxIds', () => {
  it('profile wins over legacy tin', () => {
    expect(
      getSellerTaxIds({ taxId: ' P-1 ', vatId: ' V ' }, { tax: { tin: 'LEG' } })
    ).toEqual({ taxId: 'P-1', vatId: 'V' });
  });

  it('uses legacy tin when profile empty', () => {
    expect(getSellerTaxIds({}, { tax: { tin: 'LEG-9' } }).taxId).toBe('LEG-9');
  });

  it('ignores placeholder tin', () => {
    expect(getSellerTaxIds({}, { tax: { tin: '123-456-789' } }).taxId).toBe('');
  });
});

describe('buildSellerSnapshot', () => {
  it('copies free-text address onto the snapshot', () => {
    expect(
      buildSellerSnapshot({ address: '1 Original Street' }, {}).address
    ).toBe('1 Original Street');
    expect(buildSellerSnapshot({}, {}).address).toBe('');
  });
});

describe('getDefaultTaxRate', () => {
  it('returns first active when no default flag', () => {
    const r = getDefaultTaxRate([
      { id: 'a', active: true, isDefault: false },
      { id: 'b', active: true, isDefault: false },
    ]);
    expect(r.id).toBe('a');
  });
});
