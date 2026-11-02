import moment from 'moment';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addPaymentToDoc,
  formatAmountInput,
  getClearingPaymentDate,
  getPaymentEditErrors,
  getPaymentErrors,
  getPaymentEvents,
  markDocPaidInFull,
  parseMoneyInput,
  reconcilePaymentStatus,
  removePaymentFromDoc,
  setDocStatus,
  startOfDay,
} from '../payments';
import { getDisplayStatus, getStoredStatus } from '../invoice';

const currency = { code: 'USD', fraction: 2, separator: 'commaDot' };
const now = Date.UTC(2026, 10, 15, 12);

function inv100(extra = {}) {
  return {
    status: 'pending',
    grandTotal: 100,
    currency,
    ...extra,
  };
}

describe('parseMoneyInput', () => {
  it('parses commaDot, dotComma, and space separators', () => {
    expect(parseMoneyInput('1,234.50', 'commaDot')?.value).toBe(1234.5);
    expect(parseMoneyInput('1.234,5', 'dotComma')?.value).toBe(1234.5);
    expect(parseMoneyInput('1 234.5', 'commaDot')?.value).toBe(1234.5);
  });

  it('rejects invalid input', () => {
    expect(parseMoneyInput('', 'commaDot')).toBeNull();
    expect(parseMoneyInput('1,2,3', 'commaDot')).toBeNull();
    expect(parseMoneyInput('1.2.3', 'dotComma')).toBeNull();
    expect(parseMoneyInput('1e3', 'commaDot')).toBeNull();
    expect(parseMoneyInput('-5', 'commaDot')).toBeNull();
  });
});

describe('formatAmountInput round trip', () => {
  it('matches roundMoney', () => {
    const c = { fraction: 2, separator: 'commaDot' };
    const x = 1234.5;
    const raw = formatAmountInput(x, c);
    expect(parseMoneyInput(raw, c.separator)?.value).toBe(1234.5);
  });
});

describe('getPaymentErrors', () => {
  const invoice = inv100();

  it('flags each error type', () => {
    expect(
      getPaymentErrors({ amountRaw: 'abc', date: 1 }, invoice, now).amount
    ).toBe('invoices:payments:errors:amountInvalid');
    expect(
      getPaymentErrors({ amountRaw: '1.234', date: 1 }, invoice, now).amount
    ).toBe('invoices:payments:errors:tooManyDecimals');
    expect(
      getPaymentErrors({ amountRaw: '0', date: 1 }, invoice, now).amount
    ).toBe('invoices:payments:errors:amountPositive');
    expect(
      getPaymentErrors({ amountRaw: '101', date: 1 }, invoice, now).amount
    ).toBe('invoices:payments:errors:overpayment');
    expect(
      getPaymentErrors({ amountRaw: '60', date: NaN }, invoice, now).date
    ).toBe('invoices:payments:errors:dateRequired');
    const tomorrow = moment(now).add(1, 'day').startOf('day').valueOf();
    expect(
      getPaymentErrors({ amountRaw: '10', date: tomorrow }, invoice, now).date
    ).toBe('invoices:payments:errors:dateFuture');
  });

  it('accepts balance amount and today end of day', () => {
    expect(
      Object.keys(getPaymentErrors({ amountRaw: '100', date: 1 }, invoice, now))
    ).toHaveLength(0);
    const endToday = moment(now).endOf('day').valueOf();
    expect(
      Object.keys(
        getPaymentErrors({ amountRaw: '50', date: endToday }, invoice, now)
      )
    ).toHaveLength(0);
  });
});

describe('payment transitions on 100 invoice', () => {
  it('add 40 partial, add 60 paid, remove restores', () => {
    let doc = inv100();
    const d1 = Date.UTC(2026, 10, 1);
    const d2 = Date.UTC(2026, 10, 3);
    let r = addPaymentToDoc(
      doc,
      { id: 'a', date: d1, amount: 40, method: 'cash' },
      { now }
    );
    expect(r.ok).toBe(true);
    doc = r.doc;
    expect(getDisplayStatus(doc, now)).toBe('partial');
    expect(getStoredStatus(doc)).toBe('pending');

    r = addPaymentToDoc(
      doc,
      { id: 'b', date: d2, amount: 60, method: 'bank' },
      { now }
    );
    expect(r.ok).toBe(true);
    doc = r.doc;
    expect(getStoredStatus(doc)).toBe('paid');
    expect(doc.paidAt).toBe(d2);

    r = removePaymentFromDoc(doc, 'b', now);
    doc = r.doc;
    expect(getStoredStatus(doc)).toBe('pending');
    expect(doc.paidAt).toBeUndefined();
    expect(getDisplayStatus(doc, now)).toBe('partial');

    r = removePaymentFromDoc(doc, 'a', now);
    doc = r.doc;
    expect(doc.payments).toEqual([]);
    expect(getDisplayStatus(doc, now)).toBe('pending');
  });
});

describe('clearing date uses cumulative sum not newest', () => {
  it('back-dated payment sets paidAt to the clearing date', () => {
    let doc = inv100();
    const newer = Date.UTC(2026, 10, 10);
    const older = Date.UTC(2026, 10, 1);
    doc = addPaymentToDoc(
      doc,
      { id: 'a', date: newer, amount: 10, method: 'cash' },
      { now }
    ).doc;
    doc = addPaymentToDoc(
      doc,
      { id: 'b', date: older, amount: 90, method: 'cash' },
      { now }
    ).doc;
    expect(doc.paidAt).toBe(getClearingPaymentDate(doc, now));
    expect(doc.paidAt).toBe(newer);
  });
});

describe('addPaymentToDoc guards', () => {
  it('does not mutate input', () => {
    const doc = inv100();
    const copy = { ...doc };
    addPaymentToDoc(doc, { date: Date.UTC(2026, 0, 1), amount: 10 }, { now });
    expect(doc).toEqual(copy);
  });

  it('refuses draft, closed, nothingDue, duplicate, overpayment', () => {
    expect(
      addPaymentToDoc(
        { status: 'draft', grandTotal: 1, currency },
        { date: 1, amount: 1 },
        { now }
      ).error
    ).toBe('draft');
    expect(
      addPaymentToDoc(
        { status: 'refunded', grandTotal: 1, currency },
        { date: 1, amount: 1 },
        { now }
      ).error
    ).toBe('closed');
    expect(
      addPaymentToDoc(
        inv100({ status: 'paid' }),
        { date: 1, amount: 1 },
        { now }
      ).error
    ).toBe('nothingDue');
    const withPay = {
      ...inv100(),
      payments: [{ id: 'x', date: 1, amount: 1, method: 'cash' }],
    };
    expect(
      addPaymentToDoc(withPay, { id: 'x', date: 2, amount: 1 }, { now }).error
    ).toBe('duplicate');
    expect(
      addPaymentToDoc(inv100(), { date: 1, amount: 101 }, { now }).error
    ).toBe('overpayment');
  });

  it('refuses invalid payment ids', () => {
    const doc = inv100();
    const copy = { ...doc };
    expect(
      addPaymentToDoc(doc, { id: '', date: 1, amount: 10 }, { now }).ok
    ).toBe(false);
    expect(doc).toEqual(copy);
    expect(
      addPaymentToDoc(doc, { id: 42, date: 1, amount: 10 }, { now }).ok
    ).toBe(false);
    expect(doc).toEqual(copy);
  });

  it('maps unknown method to other', () => {
    const r = addPaymentToDoc(
      inv100(),
      { id: 'm', date: 1, amount: 10, method: 'wire' },
      { now }
    );
    expect(r.payment.method).toBe('other');
  });
});

describe('markDocPaidInFull', () => {
  it('adds exact balance payment for pending', () => {
    const r = markDocPaidInFull(inv100(), now);
    expect(r.ok).toBe(true);
    expect(r.doc.payments).toHaveLength(1);
    expect(r.doc.payments[0].amount).toBe(100);
    expect(getStoredStatus(r.doc)).toBe('paid');
  });

  it('zero total pending becomes paid without payment', () => {
    const r = markDocPaidInFull(
      { status: 'pending', grandTotal: 0, currency },
      now
    );
    expect(r.ok).toBe(true);
    expect(r.doc.payments).toBeUndefined();
    expect(getStoredStatus(r.doc)).toBe('paid');
  });
});

describe('setDocStatus', () => {
  it('draft with payments fails', () => {
    const doc = {
      ...inv100(),
      payments: [{ id: 'p', date: 1, amount: 1, method: 'cash' }],
    };
    expect(setDocStatus(doc, 'draft', now).error).toBe('draftWithPayments');
  });

  it('pending on fully paid stays paid with stillPaid', () => {
    const doc = {
      ...inv100({ status: 'paid', paidAt: 1 }),
      payments: [{ id: 'p', date: 1, amount: 100, method: 'cash', note: '' }],
    };
    const r = setDocStatus(doc, 'pending', now);
    expect(r.ok).toBe(true);
    expect(getStoredStatus(r.doc)).toBe('paid');
    expect(r.stillPaid).toBe(true);
  });

  it('reopens legacy paid invoice as pending without a payments array', () => {
    const doc = inv100({ status: 'paid', paidAt: 1 });
    const r = setDocStatus(doc, 'pending', now);
    expect(r.ok).toBe(true);
    expect(getStoredStatus(r.doc)).toBe('pending');
    expect(r.doc.paidAt).toBeUndefined();
    expect(r.doc).not.toHaveProperty('payments');
    expect(r.stillPaid).toBeFalsy();
  });

  it('cancelled keeps payments and removes paidAt', () => {
    const doc = {
      status: 'paid',
      paidAt: 1,
      grandTotal: 100,
      currency,
      payments: [{ id: 'p', date: 1, amount: 100, method: 'cash' }],
    };
    const r = setDocStatus(doc, 'cancelled', now);
    expect(r.doc.payments).toHaveLength(1);
    expect(r.doc.paidAt).toBeUndefined();
  });
});

describe('getPaymentEditErrors', () => {
  it('blocks currency and total below paid', () => {
    const edit = {
      status: 'pending',
      grandTotal: 100,
      currency,
      payments: [{ id: 'p', date: 1, amount: 40, method: 'cash' }],
    };
    const newDoc = { ...edit, grandTotal: 30 };
    expect(
      getPaymentEditErrors(newDoc, edit).some(e =>
        e.key.includes('totalBelowPaid')
      )
    ).toBe(true);
    const eur = { ...edit, currency: { ...currency, code: 'EUR' } };
    expect(getPaymentEditErrors(eur, edit)[0].key).toBe(
      'form:errors:currencyLocked'
    );
  });

  it('legacy paid blocks changes', () => {
    const edit = { status: 'paid', grandTotal: 100, currency };
    const newDoc = { ...edit, grandTotal: 90 };
    expect(getPaymentEditErrors(newDoc, edit).length).toBeGreaterThan(0);
  });

  it('unpaid without payments has no errors', () => {
    expect(getPaymentEditErrors(inv100(), inv100())).toEqual([]);
  });
});

describe('getPaymentEvents', () => {
  it('returns payment rows, legacy paid, empty for refunded', () => {
    const withPay = {
      ...inv100(),
      payments: [{ id: 'p', date: 5, amount: 10, method: 'cash' }],
    };
    expect(getPaymentEvents(withPay)).toEqual([{ date: 5, amount: 10 }]);
    expect(
      getPaymentEvents({ status: 'paid', grandTotal: 50, currency })
    ).toEqual([{ date: null, amount: 50 }]);
    expect(
      getPaymentEvents({
        status: 'refunded',
        grandTotal: 1,
        currency,
        payments: [],
      })
    ).toEqual([]);
  });
});

describe('startOfDay', () => {
  it('normalizes to local start', () => {
    expect(startOfDay(Date.UTC(2026, 0, 15, 15))).toBe(
      moment(Date.UTC(2026, 0, 15, 15))
        .startOf('day')
        .valueOf()
    );
  });
});

describe('getClearingPaymentDate', () => {
  it('returns now when no payments', () => {
    expect(getClearingPaymentDate(inv100(), now)).toBe(now);
  });
});
