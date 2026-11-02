import { describe, expect, it } from 'vitest';

import {
  INVOICE_TABS,
  countByTab,
  matchesSearch,
  matchesTab,
  toInvoiceRow,
} from '../invoiceList';

describe('matchesTab', () => {
  const statuses = [
    'draft',
    'pending',
    'overdue',
    'paid',
    'refunded',
    'cancelled',
  ];

  it('covers every tab against every display status', () => {
    for (const tab of INVOICE_TABS) {
      for (const status of statuses) {
        const result = matchesTab(status, tab);
        if (tab === 'all') expect(result).toBe(true);
        else if (tab === 'draft') expect(result).toBe(status === 'draft');
        else if (tab === 'outstanding')
          expect(result).toBe(status === 'pending');
        else if (tab === 'overdue') expect(result).toBe(status === 'overdue');
        else if (tab === 'paid') expect(result).toBe(status === 'paid');
        else if (tab === 'closed')
          expect(result).toBe(status === 'refunded' || status === 'cancelled');
      }
    }
  });
});

describe('countByTab', () => {
  it('counts mixed rows', () => {
    const rows = [
      { displayStatus: 'draft' },
      { displayStatus: 'pending' },
      { displayStatus: 'overdue' },
      { displayStatus: 'paid' },
      { displayStatus: 'refunded' },
      { displayStatus: 'cancelled' },
    ];
    expect(countByTab(rows)).toEqual({
      all: 6,
      draft: 1,
      outstanding: 1,
      overdue: 1,
      paid: 1,
      closed: 2,
    });
  });
});

describe('matchesSearch', () => {
  const row = {
    number: 'INV-9',
    amountText: 'USD 1,234.00',
    invoice: {
      recipient: {
        fullname: 'Ada Lovelace',
        company: 'Analytical Engines',
        email: 'ada@example.com',
      },
    },
  };

  it('matches case-insensitive fields and digit-only amount', () => {
    expect(matchesSearch(row, '')).toBe(true);
    expect(matchesSearch(row, 'ada')).toBe(true);
    expect(matchesSearch(row, 'ANALYTICAL')).toBe(true);
    expect(matchesSearch(row, 'ada@example.com')).toBe(true);
    expect(matchesSearch(row, 'inv-9')).toBe(true);
    expect(matchesSearch(row, '1234')).toBe(true);
    expect(matchesSearch(row, 'zzzz')).toBe(false);
  });
});

describe('toInvoiceRow', () => {
  it('falls back number to first 8 chars of _id', () => {
    const row = toInvoiceRow({ _id: 'abcdefghijklmnop', grandTotal: 0 });
    expect(row.number).toBe('abcdefgh');
  });
});
