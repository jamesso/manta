import { describe, expect, it } from 'vitest';

import {
  INVOICE_TABS,
  countByTab,
  matchesSearch,
  matchesTab,
  toCreditNoteRow,
  toInvoiceRow,
} from '../invoiceList';

function invoiceRow(displayStatus) {
  return { docType: 'invoice', displayStatus };
}

describe('matchesTab', () => {
  const statuses = [
    'draft',
    'pending',
    'partial',
    'overdue',
    'paid',
    'refunded',
    'cancelled',
  ];

  it('invoice rows match invoice tabs only', () => {
    for (const tab of INVOICE_TABS) {
      if (tab === 'creditNotes') continue;
      for (const status of statuses) {
        const result = matchesTab(invoiceRow(status), tab);
        if (tab === 'all') expect(result).toBe(true);
        else if (tab === 'draft') expect(result).toBe(status === 'draft');
        else if (tab === 'outstanding')
          expect(result).toBe(status === 'pending' || status === 'partial');
        else if (tab === 'overdue') expect(result).toBe(status === 'overdue');
        else if (tab === 'paid') expect(result).toBe(status === 'paid');
        else if (tab === 'closed')
          expect(result).toBe(status === 'refunded' || status === 'cancelled');
      }
    }
  });

  it('credit note rows only match creditNotes tab', () => {
    const row = { docType: 'creditNote', displayStatus: 'issued' };
    expect(matchesTab(row, 'creditNotes')).toBe(true);
    expect(matchesTab(row, 'all')).toBe(false);
    expect(matchesTab(row, 'paid')).toBe(false);
  });
});

describe('countByTab', () => {
  it('counts mixed invoice rows and excludes credit notes from all', () => {
    const rows = [
      { docType: 'invoice', displayStatus: 'draft' },
      { docType: 'invoice', displayStatus: 'pending' },
      { docType: 'invoice', displayStatus: 'partial' },
      { docType: 'invoice', displayStatus: 'overdue' },
      { docType: 'invoice', displayStatus: 'paid' },
      { docType: 'invoice', displayStatus: 'refunded' },
      { docType: 'invoice', displayStatus: 'cancelled' },
      { docType: 'creditNote', displayStatus: 'issued' },
    ];
    expect(countByTab(rows)).toEqual({
      all: 7,
      draft: 1,
      outstanding: 2,
      overdue: 1,
      paid: 1,
      closed: 2,
      creditNotes: 1,
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

  it('finds credit note by original invoice number', () => {
    const cnRow = {
      number: 'CN-1',
      creditedNumber: 'INV-0042',
      amountText: 'USD 10.00',
      doc: { recipient: {} },
    };
    expect(matchesSearch(cnRow, 'inv-0042')).toBe(true);
  });
});

describe('toInvoiceRow', () => {
  it('falls back number to first 8 chars of _id', () => {
    const row = toInvoiceRow({ _id: 'abcdefghijklmnop', grandTotal: 0 });
    expect(row.number).toBe('abcdefgh');
  });
});

describe('toCreditNoteRow', () => {
  it('maps credited invoice number', () => {
    const row = toCreditNoteRow(
      {
        _id: 'cn1',
        docType: 'creditNote',
        invoiceID: 'CN-0001',
        creditedInvoice: { invoiceID: 'INV-7' },
        grandTotal: 50,
        currency: {
          code: 'USD',
          fraction: 2,
          placement: 'before',
          separator: 'commaDot',
        },
      },
      new Map()
    );
    expect(row.creditedNumber).toBe('INV-7');
    expect(row.docType).toBe('creditNote');
  });
});
