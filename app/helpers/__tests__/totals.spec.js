import { describe, expect, it } from 'vitest';

import { getInvoiceTotals, getInvoiceValue } from '../invoice';

const data1 = {
  rows: [
    { subtotal: 20 },
    { subtotal: 40 },
    { subtotal: 60 },
    { subtotal: 80 },
  ],
  discount: { type: 'flat', amount: 100 },
  tax: { amount: 10, method: 'default' },
};

const data2 = {
  rows: [
    { subtotal: 10 },
    { subtotal: 30 },
    { subtotal: 50 },
    { subtotal: 70 },
  ],
  discount: { type: 'percentage', amount: 10 },
  tax: { amount: 5, method: 'reverse' },
};

const data3 = {
  rows: [{ subtotal: 50 }, { subtotal: 100 }, { subtotal: 150 }],
};

const BASE = {
  rows: [{ subtotal: 1200 }, { subtotal: 2327.5 }, { subtotal: 240 }],
  currency: { fraction: 2 },
  tax: { method: 'default', amount: 10 },
  discount: { type: 'percentage', amount: 5 },
};

function expectInvoiceModeMatchesLegacy(doc) {
  const v = getInvoiceValue(doc);
  const t = getInvoiceTotals(doc);
  expect(t.mode).toBe('invoice');
  expect(Object.is(t.subtotal, v.subtotal)).toBe(true);
  expect(Object.is(t.grandTotal, v.grandTotal)).toBe(true);
  expect(t.discount).toBe(v.discount ?? 0);
  expect(t.taxTotal).toBe(v.taxAmount ?? 0);
}

describe('getInvoiceTotals invoice mode golden', () => {
  it('data1', () => {
    expectInvoiceModeMatchesLegacy(data1);
    expect(getInvoiceTotals(data1).grandTotal).toBe(110);
  });

  it('data2 reverse charge', () => {
    expectInvoiceModeMatchesLegacy(data2);
    const t = getInvoiceTotals(data2);
    expect(t.taxTotal).toBe(7.2);
    expect(t.grandTotal).toBe(144);
    expect(t.taxBreakdown[0].addedToTotal).toBe(false);
  });

  it('data3 no tax', () => {
    expectInvoiceModeMatchesLegacy(data3);
    expect(getInvoiceTotals(data3).taxBreakdown).toEqual([]);
  });

  it('018 BASE', () => {
    expectInvoiceModeMatchesLegacy(BASE);
    expect(getInvoiceTotals(BASE).grandTotal).toBe(3937.0375);
  });

  it('tax method undefined does not add tax to total', () => {
    const doc = {
      rows: [{ subtotal: 100 }],
      tax: { amount: 10, method: undefined },
    };
    expectInvoiceModeMatchesLegacy(doc);
  });

  it('discount without tax', () => {
    const doc = {
      rows: [{ subtotal: 100 }],
      discount: { type: 'flat', amount: 10 },
    };
    expectInvoiceModeMatchesLegacy(doc);
  });

  it('empty string subtotal row', () => {
    const doc = {
      rows: [{ subtotal: '' }, { subtotal: 100 }],
      tax: { amount: 10, method: 'default' },
    };
    expectInvoiceModeMatchesLegacy(doc);
  });

  it('row taxRate switches to line mode', () => {
    const doc = {
      taxMode: 'line',
      taxCalc: 1,
      currency: { fraction: 2 },
      rows: [
        { price: 1, quantity: 1, subtotal: 1, taxRate: 19, taxCategory: 'S' },
      ],
      tax: { amount: 10, method: 'default' },
    };
    expect(getInvoiceTotals(doc).mode).toBe('line');
  });
});

describe('getInvoiceTotals line mode', () => {
  it('groups three 1.03 lines at S 7', () => {
    const doc = {
      taxMode: 'line',
      taxCalc: 1,
      currency: { fraction: 2 },
      rows: [1, 2, 3].map(i => ({
        id: String(i),
        price: 1.03,
        quantity: 1,
        subtotal: 1.03,
        taxRate: 7,
        taxCategory: 'S',
      })),
    };
    const t = getInvoiceTotals(doc);
    expect(t.taxTotal).toBe(0.22);
  });

  it('mixed rates with percentage discount', () => {
    const doc = {
      taxMode: 'line',
      taxCalc: 1,
      currency: { fraction: 2 },
      discount: { type: 'percentage', amount: 10 },
      rows: [
        {
          price: 100,
          quantity: 1,
          subtotal: 100,
          taxRate: 19,
          taxCategory: 'S',
        },
        {
          price: 50,
          quantity: 1,
          subtotal: 50,
          taxRate: 7,
          taxCategory: 'S',
        },
        {
          price: 30,
          quantity: 1,
          subtotal: 30,
          taxRate: 0,
          taxCategory: 'E',
          taxExemptionReason: 'Exempt',
        },
      ],
    };
    const t = getInvoiceTotals(doc);
    expect(t.discount).toBe(18);
    const byRate = Object.fromEntries(t.taxBreakdown.map(g => [g.rate, g]));
    expect(byRate[19].base).toBe(90);
    expect(byRate[7].base).toBe(45);
    expect(byRate[0].base).toBe(27);
    expect(byRate[19].amount).toBe(17.1);
    expect(byRate[7].amount).toBe(3.15);
    expect(byRate[0].amount).toBe(0);
    expect(t.grandTotal).toBe(182.25);
  });

  it('discount remainder on largest group', () => {
    const doc = {
      taxMode: 'line',
      taxCalc: 1,
      currency: { fraction: 2 },
      discount: { type: 'flat', amount: 1 },
      rows: [
        {
          price: 10,
          quantity: 1,
          subtotal: 10,
          taxRate: 19,
          taxCategory: 'S',
        },
        {
          price: 10,
          quantity: 1,
          subtotal: 10,
          taxRate: 7,
          taxCategory: 'S',
        },
        {
          price: 10,
          quantity: 1,
          subtotal: 10,
          taxRate: 0,
          taxCategory: 'E',
          taxExemptionReason: 'E',
        },
      ],
    };
    const t = getInvoiceTotals(doc);
    const shares = t.taxBreakdown.map(g => roundShare(g, t));
    expect(t.grandTotal).toBe(31.52);
    expect(t.taxBreakdown.find(g => g.rate === 19).amount).toBe(1.84);
    expect(t.taxBreakdown.find(g => g.rate === 7).amount).toBe(0.68);
  });

  it('fraction 0 currency', () => {
    const doc = {
      taxMode: 'line',
      taxCalc: 1,
      currency: { fraction: 0 },
      rows: [
        {
          price: 1000,
          quantity: 1,
          subtotal: 1000,
          taxRate: 10,
          taxCategory: 'S',
        },
        {
          price: 333,
          quantity: 1,
          subtotal: 333,
          taxRate: 8,
          taxCategory: 'S',
        },
      ],
    };
    const t = getInvoiceTotals(doc);
    expect(t.taxTotal).toBe(127);
    expect(t.grandTotal).toBe(1460);
  });

  it('price 0.333 x qty 3', () => {
    const doc = {
      taxMode: 'line',
      taxCalc: 1,
      currency: { fraction: 2 },
      rows: [
        {
          price: 0.333,
          quantity: 3,
          subtotal: 0.999,
          taxRate: 19,
          taxCategory: 'S',
        },
      ],
    };
    expect(getInvoiceTotals(doc).lines[0].net).toBe(1);
  });

  it('explicit line mode with tax off keeps line mode', () => {
    const doc = {
      taxMode: 'line',
      taxCalc: 1,
      currency: { fraction: 2 },
      rows: [{ price: 10, quantity: 1, subtotal: 10 }],
    };
    const t = getInvoiceTotals(doc);
    expect(t.mode).toBe('line');
    expect(t.taxTotal).toBe(0);
    expect(Number.isNaN(t.grandTotal)).toBe(false);
  });

  it('subtotal zero flat discount', () => {
    const doc = {
      taxMode: 'line',
      taxCalc: 1,
      currency: { fraction: 2 },
      discount: { type: 'flat', amount: 5 },
      rows: [
        {
          price: 0,
          quantity: 1,
          subtotal: 0,
          taxRate: 19,
          taxCategory: 'S',
        },
      ],
    };
    const t = getInvoiceTotals(doc);
    expect(t.taxBreakdown[0].base).toBe(0);
  });

  it('breakdown order', () => {
    const doc = {
      taxMode: 'line',
      taxCalc: 1,
      currency: { fraction: 2 },
      rows: [
        { price: 1, quantity: 1, subtotal: 1, taxRate: 0, taxCategory: 'AE' },
        { price: 1, quantity: 1, subtotal: 1, taxRate: 0, taxCategory: 'E' },
        { price: 1, quantity: 1, subtotal: 1, taxRate: 0, taxCategory: 'Z' },
        { price: 1, quantity: 1, subtotal: 1, taxRate: 7, taxCategory: 'S' },
        { price: 1, quantity: 1, subtotal: 1, taxRate: 19, taxCategory: 'S' },
      ],
    };
    const cats = getInvoiceTotals(doc).taxBreakdown.map(g => g.category);
    expect(cats).toEqual(['S', 'S', 'Z', 'E', 'AE']);
    expect(getInvoiceTotals(doc).taxBreakdown.map(g => g.rate)).toEqual([
      19, 7, 0, 0, 0,
    ]);
  });
});

function roundShare(g, t) {
  return g.base;
}
