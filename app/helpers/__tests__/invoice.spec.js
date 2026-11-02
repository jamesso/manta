import moment from 'moment';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatNumber } from '../../../helpers/formatNumber';
import {
  formatInvoiceAmount,
  getAmountPaid,
  getBalanceDue,
  getDisplayStatus,
  getDueDate,
  getDueInDays,
  getIssuedAt,
  getInvoiceNumber,
  getInvoiceValue,
  getPaidDate,
  getPayments,
  roundMoney,
  withStatus,
} from '../invoice';

const data1 = {
  rows: [
    { subtotal: 20 },
    { subtotal: 40 },
    { subtotal: 60 },
    { subtotal: 80 },
  ],
  discount: {
    type: 'flat',
    amount: 100,
  },
  tax: {
    amount: 10,
    method: 'default',
  },
};

const data2 = {
  rows: [
    { subtotal: 10 },
    { subtotal: 30 },
    { subtotal: 50 },
    { subtotal: 70 },
  ],
  discount: {
    type: 'percentage',
    amount: 10,
  },
  tax: {
    amount: 5,
    method: 'reverse',
  },
};

const data3 = {
  rows: [{ subtotal: 50 }, { subtotal: 100 }, { subtotal: 150 }],
};

it('should return correct subtotal value', () => {
  expect(getInvoiceValue(data1).subtotal).toEqual(200);
  expect(getInvoiceValue(data1).subtotal).not.toEqual(100);
  expect(getInvoiceValue(data2).subtotal).toEqual(160);
  expect(getInvoiceValue(data2).subtotal).not.toEqual(180);
  expect(getInvoiceValue(data3).subtotal).toEqual(300);
  expect(getInvoiceValue(data3).subtotal).not.toEqual(310);
});

it('should return correct discount', () => {
  expect(getInvoiceValue(data1).discount).toEqual(100);
  expect(getInvoiceValue(data1).discount).not.toEqual(200);
  expect(getInvoiceValue(data2).discount).toEqual(16);
  expect(getInvoiceValue(data2).discount).not.toEqual(18);
  expect(getInvoiceValue(data3).discount).toEqual(undefined);
});

it('should return correct tax value', () => {
  expect(getInvoiceValue(data1).taxAmount).toEqual(10);
  expect(getInvoiceValue(data1).taxAmount).not.toEqual(11);
  expect(getInvoiceValue(data2).taxAmount).toEqual(7.2);
  expect(getInvoiceValue(data2).taxAmount).not.toEqual(8);
  expect(getInvoiceValue(data3).taxAmount).toEqual(undefined);
});

it('should return correct grandTotal value', () => {
  expect(getInvoiceValue(data1).grandTotal).toEqual(110);
  expect(getInvoiceValue(data1).grandTotal).not.toEqual(100);
  expect(getInvoiceValue(data2).grandTotal).toEqual(144);
  expect(getInvoiceValue(data2).grandTotal).not.toEqual(151.2);
  expect(getInvoiceValue(data3).grandTotal).toEqual(300);
  expect(getInvoiceValue(data3).grandTotal).not.toEqual(310);
});

describe('getIssuedAt', () => {
  it('returns null for garbage and non-finite values', () => {
    expect(getIssuedAt({ issuedAt: 'garbage' })).toBeNull();
    expect(getIssuedAt({ created_at: Number.POSITIVE_INFINITY })).toBeNull();
  });

  it('returns a valid timestamp for created_at', () => {
    const created = Date.UTC(2025, 0, 15, 10);
    expect(getIssuedAt({ created_at: created })).toBe(created);
  });
});

describe('getDueDate', () => {
  it('parses custom moment object selectedDate', () => {
    const invoice = {
      dueDate: {
        useCustom: true,
        selectedDate: { years: 2026, months: 9, date: 31 },
      },
    };
    expect(getDueDate(invoice)).toBe(Date.UTC(2026, 9, 31));
  });

  it('returns null when selectedDate is null', () => {
    expect(
      getDueDate({ dueDate: { useCustom: true, selectedDate: null } })
    ).toBeNull();
  });

  it('returns null when dueDate key is absent', () => {
    expect(getDueDate({})).toBeNull();
  });

  it('returns null for invalid selectedDate', () => {
    expect(
      getDueDate({ dueDate: { useCustom: true, selectedDate: 'garbage' } })
    ).toBeNull();
  });

  it('adds net30 from created_at', () => {
    const created = Date.UTC(2025, 0, 1);
    const invoice = {
      created_at: created,
      dueDate: { useCustom: false, paymentTerm: 'net30' },
    };
    expect(getDueDate(invoice)).toBe(Date.UTC(2025, 0, 31));
  });

  it('uses issuedAt over created_at for payment terms', () => {
    const invoice = {
      created_at: Date.UTC(2020, 0, 1),
      issuedAt: Date.UTC(2025, 0, 1),
      dueDate: { useCustom: false, paymentTerm: 'net7' },
    };
    expect(getDueDate(invoice)).toBe(Date.UTC(2025, 0, 8));
  });

  it('returns null for payment term when no issue date', () => {
    expect(
      getDueDate({
        dueDate: { useCustom: false, paymentTerm: 'net30' },
      })
    ).toBeNull();
  });

  it('returns null when calTermDate would be non-finite', () => {
    const invoice = {
      created_at: Number.NaN,
      dueDate: { useCustom: false, paymentTerm: 'net30' },
    };
    expect(getDueDate(invoice)).toBeNull();
  });
});

describe('getDisplayStatus', () => {
  const pastDue = {
    created_at: Date.UTC(2020, 0, 1),
    dueDate: {
      useCustom: true,
      selectedDate: { years: 2020, months: 0, date: 1 },
    },
  };
  const now = Date.UTC(2026, 0, 15);

  it('treats missing status as pending/overdue rules', () => {
    expect(getDisplayStatus(pastDue, now)).toBe('overdue');
    expect(getDisplayStatus({}, now)).toBe('pending');
  });

  it('maps unknown status to pending rules', () => {
    expect(getDisplayStatus({ ...pastDue, status: 'void' }, now)).toBe(
      'overdue'
    );
  });

  it('keeps draft/paid/refunded/cancelled despite past due', () => {
    for (const status of ['draft', 'paid', 'refunded', 'cancelled']) {
      expect(getDisplayStatus({ ...pastDue, status }, now)).toBe(status);
    }
  });

  it('pending when due today at end of day', () => {
    const dueToday = Date.UTC(2026, 0, 15);
    const invoice = {
      status: 'pending',
      dueDate: {
        useCustom: true,
        selectedDate: moment(dueToday).toObject(),
      },
    };
    const endOfDay = Date.UTC(2026, 0, 15, 23, 59);
    expect(getDisplayStatus(invoice, endOfDay)).toBe('pending');
  });

  it('overdue when due was yesterday', () => {
    const invoice = {
      status: 'pending',
      dueDate: {
        useCustom: true,
        selectedDate: { years: 2026, months: 0, date: 14 },
      },
    };
    const startToday = Date.UTC(2026, 0, 15);
    expect(getDisplayStatus(invoice, startToday)).toBe('overdue');
  });

  it('partial when partially paid and not overdue', () => {
    const invoice = {
      status: 'pending',
      grandTotal: 100,
      currency: { fraction: 2 },
      payments: [
        {
          id: 'p1',
          date: Date.UTC(2026, 0, 1),
          amount: 40,
          method: 'cash',
        },
      ],
      dueDate: {
        useCustom: true,
        selectedDate: { years: 2026, months: 0, date: 20 },
      },
    };
    const now = Date.UTC(2026, 0, 10);
    expect(getDisplayStatus(invoice, now)).toBe('partial');
  });

  it('overdue wins over partial', () => {
    const pastDue = {
      status: 'pending',
      grandTotal: 100,
      currency: { fraction: 2 },
      payments: [
        {
          id: 'p1',
          date: Date.UTC(2026, 0, 1),
          amount: 40,
          method: 'cash',
        },
      ],
      dueDate: {
        useCustom: true,
        selectedDate: { years: 2026, months: 0, date: 1 },
      },
    };
    expect(getDisplayStatus(pastDue, Date.UTC(2026, 0, 15))).toBe('overdue');
  });

  it('pending when nothing paid', () => {
    expect(
      getDisplayStatus(
        { status: 'pending', grandTotal: 100 },
        Date.UTC(2026, 0, 1)
      )
    ).toBe('pending');
  });

  it('paid stays paid', () => {
    expect(getDisplayStatus({ status: 'paid' }, Date.UTC(2026, 0, 1))).toBe(
      'paid'
    );
  });
});

describe('getDueInDays timezone edge', () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it('counts calendar days across DST end in America/New_York', () => {
    process.env.TZ = 'America/New_York';
    const invoice = {
      status: 'pending',
      dueDate: {
        useCustom: true,
        selectedDate: { years: 2026, months: 9, date: 31 },
      },
    };
    const now1 = new Date(2026, 10, 1, 0, 30);
    expect(getDisplayStatus(invoice, now1)).toBe('overdue');
    expect(getDueInDays(invoice, now1)).toBe(-1);

    const now3 = new Date(2026, 10, 3, 0, 30);
    expect(getDueInDays(invoice, now3)).toBe(-3);
  });

  it('spring DST case', () => {
    process.env.TZ = 'America/New_York';
    const invoice = {
      status: 'pending',
      dueDate: { useCustom: true, selectedDate: new Date(2027, 2, 13) },
    };
    const now = new Date(2027, 2, 15, 0, 30);
    expect(getDueInDays(invoice, now)).toBe(-2);
  });
});

describe('withStatus', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pending to paid sets paidAt', () => {
    const doc = { status: 'pending' };
    const next = withStatus(doc, 'paid', Date.now());
    expect(next.paidAt).toBe(Date.now());
    expect(doc.paidAt).toBeUndefined();
  });

  it('paid to paid keeps paidAt', () => {
    const doc = { status: 'paid', paidAt: 100 };
    const next = withStatus(doc, 'paid', 200);
    expect(next.paidAt).toBe(100);
  });

  it('paid to refunded removes paidAt', () => {
    const doc = { status: 'paid', paidAt: 100 };
    const next = withStatus(doc, 'refunded', Date.now());
    expect(next.paidAt).toBeUndefined();
  });

  it('does not mutate input', () => {
    const doc = { status: 'pending', x: 1 };
    withStatus(doc, 'paid', 1);
    expect(doc.status).toBe('pending');
  });
});

describe('getPaidDate', () => {
  it('prefers paidAt, then issuedAt, then created_at, then null', () => {
    expect(getPaidDate({ paidAt: 1, issuedAt: 2, created_at: 3 })).toBe(1);
    expect(getPaidDate({ issuedAt: 2, created_at: 3 })).toBe(2);
    expect(getPaidDate({ created_at: 3 })).toBe(3);
    expect(getPaidDate({})).toBe(null);
  });
});

describe('formatInvoiceAmount', () => {
  it('formats before placement', () => {
    const invoice = {
      grandTotal: 1234,
      currency: {
        code: 'USD',
        placement: 'before',
        fraction: 2,
        separator: 'dotComma',
      },
    };
    expect(formatInvoiceAmount(invoice)).toBe('USD 1.234,00');
  });

  it('formats after placement', () => {
    const invoice = {
      grandTotal: 1234,
      currency: {
        code: 'USD',
        placement: 'after',
        fraction: 2,
        separator: 'dotComma',
      },
    };
    expect(formatInvoiceAmount(invoice)).toBe('1.234,00 USD');
  });

  it('returns number only when currency missing', () => {
    expect(formatInvoiceAmount({ grandTotal: 10 })).toBe('10.00');
  });
});

describe('getInvoiceNumber', () => {
  it('uses invoiceID or first 8 of _id', () => {
    expect(getInvoiceNumber({ invoiceID: 'INV-1', _id: 'abcdefghij' })).toBe(
      'INV-1'
    );
    expect(getInvoiceNumber({ _id: 'abcdefghijklmnop' })).toBe('abcdefgh');
  });
});

describe('roundMoney', () => {
  it('matches reference rounding values', () => {
    expect(roundMoney(1.005, 2)).toBe(1.01);
    expect(roundMoney(2.675, 2)).toBe(2.68);
    expect(roundMoney(3937.0375, 2)).toBe(3937.04);
    expect(roundMoney(99.995, 2)).toBe(100);
    expect(roundMoney(0.125, 2)).toBe(0.13);
    expect(roundMoney(-1.005, 2)).toBe(-1.01);
    expect(roundMoney(Number.NaN, 2)).toBe(0);
    expect(roundMoney(1234.5, 'x')).toBe(1234.5);
  });

  it('matches formatNumber after rounding', () => {
    for (const x of [1.005, 2.675, 3937.0375, 99.995, 0.125]) {
      expect(formatNumber(roundMoney(x, 2), 2, 'commaDot')).toBe(
        formatNumber(x, 2, 'commaDot')
      );
    }
  });
});

describe('getPayments', () => {
  const base = { currency: { fraction: 2 } };

  it('returns empty when payments missing', () => {
    expect(getPayments({})).toEqual([]);
  });

  it('dedupes ids and drops invalid entries', () => {
    const invoice = {
      ...base,
      payments: [
        { id: 'a', date: Date.UTC(2026, 0, 2), amount: 10, method: 'cash' },
        { id: 'a', date: Date.UTC(2026, 0, 3), amount: 20, method: 'cash' },
        { id: 'b', amount: 5 },
        { id: 'c', date: Date.UTC(2026, 0, 1), amount: -1 },
        { id: 'd', date: Date.UTC(2026, 0, 1), amount: 'x' },
        null,
        { id: 'e', date: Date.UTC(2026, 0, 4), amount: 15, method: 'bank' },
      ],
    };
    expect(getPayments(invoice).map(p => p.id)).toEqual(['a', 'e']);
  });

  it('sorts by date', () => {
    const invoice = {
      ...base,
      payments: [
        { id: 'b', date: Date.UTC(2026, 0, 5), amount: 1, method: 'cash' },
        { id: 'a', date: Date.UTC(2026, 0, 1), amount: 2, method: 'cash' },
      ],
    };
    expect(getPayments(invoice).map(p => p.id)).toEqual(['a', 'b']);
  });
});

describe('getAmountPaid', () => {
  it('legacy paid without payments array uses total', () => {
    expect(
      getAmountPaid({
        status: 'paid',
        grandTotal: 100,
        currency: { fraction: 2 },
      })
    ).toBe(100);
  });

  it('paid with empty payments array is zero', () => {
    expect(
      getAmountPaid({
        status: 'paid',
        grandTotal: 100,
        payments: [],
        currency: { fraction: 2 },
      })
    ).toBe(0);
  });

  it('pending without payments is zero', () => {
    expect(
      getAmountPaid({
        status: 'pending',
        grandTotal: 100,
        currency: { fraction: 2 },
      })
    ).toBe(0);
  });

  it('sums rounded payments', () => {
    expect(
      getAmountPaid({
        status: 'pending',
        grandTotal: 1,
        currency: { fraction: 2 },
        payments: [
          { id: 'a', date: 1, amount: 0.1, method: 'cash' },
          { id: 'b', date: 2, amount: 0.2, method: 'cash' },
        ],
      })
    ).toBe(0.3);
  });
});

describe('getBalanceDue', () => {
  it('3937.0375 total minus 3937.04 payment is zero', () => {
    const invoice = {
      status: 'pending',
      grandTotal: 3937.0375,
      currency: { fraction: 2 },
      payments: [
        {
          id: 'p',
          date: Date.UTC(2026, 0, 1),
          amount: 3937.04,
          method: 'bank',
        },
      ],
    };
    expect(getBalanceDue(invoice)).toBe(0);
  });

  it('supports fraction 0', () => {
    const invoice = {
      status: 'pending',
      grandTotal: 100,
      currency: { fraction: 0 },
      payments: [{ id: 'p', date: 1, amount: 40, method: 'cash' }],
    };
    expect(getBalanceDue(invoice)).toBe(60);
  });
});
