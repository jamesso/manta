import { describe, expect, it } from 'vitest';

import {
  buildCreditNoteDraft,
  canCreateCreditNote,
  getCreditableAmount,
  partitionDeletable,
  resolveStatusAfterCredit,
  validateCreditTotal,
} from '../creditNotes';

const currency = {
  code: 'USD',
  fraction: 2,
  placement: 'before',
  separator: 'commaDot',
};

function inv(overrides = {}) {
  return {
    _id: overrides._id ?? 'inv-1',
    docType: 'invoice',
    status: overrides.status ?? 'pending',
    grandTotal: overrides.grandTotal ?? 1000,
    currency: overrides.currency ?? currency,
    invoiceID: overrides.invoiceID ?? 'INV-0001',
    issuedAt: overrides.issuedAt ?? Date.UTC(2026, 0, 1),
    created_at: overrides.created_at ?? Date.UTC(2026, 0, 1),
    recipient: overrides.recipient ?? { fullname: 'A' },
    rows: overrides.rows ?? [
      { id: 'r1', subtotal: 1000, price: 100, quantity: 10 },
    ],
    ...overrides,
  };
}

function cn(overrides = {}) {
  return {
    _id: overrides._id ?? 'cn-1',
    docType: 'creditNote',
    status: overrides.status ?? 'issued',
    creditedInvoiceId: overrides.creditedInvoiceId ?? 'inv-1',
    grandTotal: overrides.grandTotal ?? 300,
    currency: overrides.currency ?? currency,
    ...overrides,
  };
}

describe('getCreditableAmount', () => {
  it('no credit notes returns invoice total', () => {
    expect(getCreditableAmount(inv(), [])).toBe(1000);
  });

  it('subtracts issued credit', () => {
    expect(getCreditableAmount(inv(), [cn({ grandTotal: 300 })])).toBe(700);
  });

  it('ignores draft and void', () => {
    const notes = [
      cn({ status: 'draft', grandTotal: 500 }),
      cn({ _id: 'cn-v', status: 'void', grandTotal: 500 }),
    ];
    expect(getCreditableAmount(inv(), notes)).toBe(1000);
  });

  it('ignores credits for other invoices', () => {
    expect(
      getCreditableAmount(inv(), [cn({ creditedInvoiceId: 'other' })])
    ).toBe(1000);
  });

  it('excludeId ignores self', () => {
    const note = cn({ _id: 'cn-edit', grandTotal: 300 });
    expect(getCreditableAmount(inv(), [note], { excludeId: 'cn-edit' })).toBe(
      1000
    );
  });

  it('never returns negative when over-credited', () => {
    expect(getCreditableAmount(inv(), [cn({ grandTotal: 2000 })])).toBe(0);
  });

  it('rounds fractional sums', () => {
    const invoice = inv({
      grandTotal: 1,
      currency: { ...currency, fraction: 2 },
    });
    const notes = [
      cn({ grandTotal: 0.1 }),
      cn({ _id: 'cn2', grandTotal: 0.2 }),
    ];
    expect(getCreditableAmount(invoice, notes)).toBe(0.7);
  });
});

describe('canCreateCreditNote', () => {
  it('allows pending paid refunded and partial display', () => {
    expect(canCreateCreditNote(inv({ status: 'pending' }), [])).toBe(true);
    expect(canCreateCreditNote(inv({ status: 'paid' }), [])).toBe(true);
    expect(canCreateCreditNote(inv({ status: 'refunded' }), [])).toBe(true);
    expect(canCreateCreditNote(inv({ status: undefined }), [])).toBe(true);
  });

  it('blocks draft cancelled estimate creditNote and fully credited', () => {
    expect(canCreateCreditNote(inv({ status: 'draft' }), [])).toBe(false);
    expect(canCreateCreditNote(inv({ status: 'cancelled' }), [])).toBe(false);
    expect(canCreateCreditNote(inv({ docType: 'estimate' }), [])).toBe(false);
    expect(canCreateCreditNote(cn(), [])).toBe(false);
    expect(canCreateCreditNote(inv(), [cn({ grandTotal: 1000 })])).toBe(false);
  });
});

describe('buildCreditNoteDraft', () => {
  it('omits persisted fields and snapshots original', () => {
    const invoice = inv({
      _rev: '1-abc',
      status: 'paid',
      payments: [{ id: 'p', amount: 1, date: 1, method: 'cash' }],
      paidAt: 1,
      dueDate: { useCustom: true, selectedDate: 1 },
      invoiceID: 'INV-0042',
      cancelledByCredit: true,
    });
    const before = structuredClone(invoice);
    const draft = buildCreditNoteDraft(invoice, { idFn: () => 'new-row-id' });
    expect(draft).not.toHaveProperty('_id');
    expect(draft).not.toHaveProperty('_rev');
    expect(draft).not.toHaveProperty('status');
    expect(draft).not.toHaveProperty('payments');
    expect(draft).not.toHaveProperty('paidAt');
    expect(draft).not.toHaveProperty('dueDate');
    expect(draft).not.toHaveProperty('issuedAt');
    expect(draft).not.toHaveProperty('created_at');
    expect(draft).not.toHaveProperty('invoiceID');
    expect(draft).not.toHaveProperty('cancelledByCredit');
    expect(draft.creditedInvoice).toEqual({
      invoiceID: 'INV-0042',
      issuedAt: invoice.issuedAt,
    });
    expect(draft.rows[0].id).toBe('new-row-id');
    expect(invoice).toEqual(before);
  });

  it('falls back invoice number and issued date', () => {
    const draft = buildCreditNoteDraft(
      inv({ invoiceID: undefined, _id: 'abcdefgh1234', issuedAt: undefined }),
      { idFn: () => 'x' }
    );
    expect(draft.creditedInvoice.invoiceID).toBe('abcdefgh');
    expect(draft.creditedInvoice.issuedAt).toBe(Date.UTC(2026, 0, 1));
  });
});

describe('validateCreditTotal', () => {
  const invoice = inv();

  it('returns each error code', () => {
    expect(validateCreditTotal(cn(), null, [])).toBe('creditedMissing');
    expect(validateCreditTotal(cn({ grandTotal: 0 }), invoice, [])).toBe(
      'creditZero'
    );
    expect(
      validateCreditTotal(
        cn({ currency: { ...currency, code: 'EUR' } }),
        invoice,
        []
      )
    ).toBe('creditCurrency');
    expect(validateCreditTotal(cn({ grandTotal: 1001 }), invoice, [])).toBe(
      'creditExceeds'
    );
  });

  it('allows exact creditable amount', () => {
    expect(validateCreditTotal(cn({ grandTotal: 1000 }), invoice, [])).toBe(
      null
    );
  });
});

describe('resolveStatusAfterCredit', () => {
  const now = Date.UTC(2026, 5, 1);

  it('1 pending full credit no payments → cancelled', () => {
    const invoice = inv({ status: 'pending' });
    const next = resolveStatusAfterCredit(
      invoice,
      [cn({ grandTotal: 1000 })],
      now
    );
    expect(next.status).toBe('cancelled');
    expect(next.cancelledByCredit).toBe(true);
  });

  it('2 partial credit → unchanged reference', () => {
    const invoice = inv({ status: 'pending' });
    const next = resolveStatusAfterCredit(
      invoice,
      [cn({ grandTotal: 400 })],
      now
    );
    expect(next).toBe(invoice);
  });

  it('3 pending with payment and credit clears balance → paid', () => {
    const invoice = inv({
      status: 'pending',
      grandTotal: 1000,
      payments: [
        {
          id: 'p1',
          date: Date.UTC(2026, 0, 2),
          amount: 400,
          method: 'cash',
        },
      ],
    });
    const next = resolveStatusAfterCredit(
      invoice,
      [cn({ grandTotal: 600 })],
      now
    );
    expect(next.status).toBe('paid');
    expect(next.paidAt).toBe(Date.UTC(2026, 0, 2));
  });

  it('4 paid with payments full credit stays paid', () => {
    const invoice = inv({
      status: 'paid',
      paidAt: Date.UTC(2026, 0, 3),
      payments: [
        { id: 'p1', date: Date.UTC(2026, 0, 3), amount: 1000, method: 'cash' },
      ],
    });
    const next = resolveStatusAfterCredit(
      invoice,
      [cn({ grandTotal: 1000 })],
      now
    );
    expect(next.status).toBe('paid');
    expect(next.paidAt).toBe(Date.UTC(2026, 0, 3));
  });

  it('5 legacy paid without payments full credit stays paid', () => {
    const invoice = inv({ status: 'paid', grandTotal: 1000 });
    const next = resolveStatusAfterCredit(
      invoice,
      [cn({ grandTotal: 1000 })],
      now
    );
    expect(next.status).toBe('paid');
  });

  it('5b pending settled by credit sets payments empty array', () => {
    const invoice = inv({ status: 'pending', grandTotal: 1000 });
    const next = resolveStatusAfterCredit(
      invoice,
      [cn({ grandTotal: 1000 })],
      now
    );
    expect(next.status).toBe('cancelled');
  });

  it('5c pending zero cash credit-only paid transition uses payments []', () => {
    const invoice = inv({
      status: 'pending',
      grandTotal: 500,
      payments: [{ id: 'p', date: 1, amount: 500, method: 'cash' }],
    });
    const next = resolveStatusAfterCredit(
      invoice,
      [cn({ grandTotal: 500 })],
      now
    );
    expect(next.status).toBe('paid');
  });

  it('6 cancelled by credit voided credit → pending', () => {
    const invoice = inv({
      status: 'cancelled',
      cancelledByCredit: true,
    });
    const next = resolveStatusAfterCredit(invoice, [], now);
    expect(next.status).toBe('pending');
    expect(next.cancelledByCredit).toBeUndefined();
  });

  it('7 manual cancel unchanged', () => {
    const invoice = inv({ status: 'cancelled' });
    expect(resolveStatusAfterCredit(invoice, [], now)).toBe(invoice);
  });

  it('8 refunded and draft unchanged', () => {
    const refunded = inv({ status: 'refunded' });
    const draft = inv({ status: 'draft' });
    expect(resolveStatusAfterCredit(refunded, [], now)).toBe(refunded);
    expect(resolveStatusAfterCredit(draft, [], now)).toBe(draft);
  });

  it('9 paid by credit and payment credit voided → pending', () => {
    const invoice = inv({
      status: 'paid',
      payments: [{ id: 'p', date: 1, amount: 600, method: 'cash' }],
    });
    const next = resolveStatusAfterCredit(invoice, [], now);
    expect(next.status).toBe('pending');
  });
});

describe('partitionDeletable', () => {
  it('blocks invoice with linked credit and issued credit note', () => {
    const docs = [inv({ _id: 'i1' }), cn({ creditedInvoiceId: 'i1' })];
    const r = partitionDeletable(['i1', 'cn-1'], docs);
    expect(r.deletable).toEqual([]);
    expect(r.blocked.map(b => b.reason).sort()).toEqual([
      'hasCreditNotes',
      'issuedCreditNote',
    ]);
  });

  it('draft credit note deletable', () => {
    const docs = [cn({ status: 'draft' })];
    expect(partitionDeletable(['cn-1'], docs).deletable).toEqual(['cn-1']);
  });

  it('unknown id deletable', () => {
    expect(partitionDeletable(['missing'], []).deletable).toEqual(['missing']);
  });
});
