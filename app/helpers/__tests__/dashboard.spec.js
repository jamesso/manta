import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useNow } from '../../components/invoices/useNow';
import {
  addLocalDays,
  formatMoney,
  getDashboardStats,
  getMonthlyPaid,
  getNeedsAttention,
  getRecentInvoices,
  resolveDashboardCurrencySelection,
  startOfLocalDay,
  startOfLocalMonth,
} from '../dashboard';

const AMERICA_NEW_YORK = 'America/New_York';

const fallback = {
  code: 'USD',
  placement: 'before',
  separator: 'commaDot',
  fraction: 2,
};

function inv(overrides = {}) {
  return {
    _id: overrides._id ?? crypto.randomUUID(),
    created_at: overrides.created_at ?? Date.UTC(2026, 0, 1),
    status: overrides.status ?? 'pending',
    grandTotal: overrides.grandTotal ?? 100,
    currency: overrides.currency ?? fallback,
    rows: overrides.rows,
    ...overrides,
  };
}

describe('getDashboardStats', () => {
  it('never sums different currencies into one total', () => {
    const invoices = [
      inv({ currency: { ...fallback, code: 'USD' }, grandTotal: 100 }),
      inv({
        currency: { ...fallback, code: 'EUR' },
        grandTotal: 50,
        _id: 'e',
      }),
    ];
    const stats = getDashboardStats(invoices, Date.UTC(2026, 5, 15), fallback);
    expect(stats.currencies.sort()).toEqual(['EUR', 'USD']);
    expect(stats.byCurrency.USD.outstanding).toBe(100);
    expect(stats.byCurrency.EUR.outstanding).toBe(50);
    expect(stats.byCurrency.USD.outstanding).not.toBe(150);
  });

  it('counts overdue in both outstanding and overdue', () => {
    const now = startOfLocalDay(Date.UTC(2026, 5, 10));
    const yesterday = addLocalDays(now, -1);
    const invoices = [
      inv({
        status: 'pending',
        dueDate: { useCustom: true, selectedDate: yesterday },
      }),
    ];
    const stats = getDashboardStats(invoices, now, fallback);
    expect(stats.byCurrency.USD.outstanding).toBe(100);
    expect(stats.byCurrency.USD.overdue).toBe(100);
    expect(stats.counts.overdue).toBe(1);
  });

  it('treats due today as pending not overdue', () => {
    const now = startOfLocalDay(Date.UTC(2026, 5, 10));
    const invoices = [
      inv({
        status: 'pending',
        dueDate: { useCustom: true, selectedDate: now },
      }),
    ];
    const stats = getDashboardStats(invoices, now, fallback);
    expect(stats.byCurrency.USD.overdueCount).toBe(0);
    expect(stats.byCurrency.USD.outstandingCount).toBe(1);
  });

  it('buckets paidThisMonth by local month boundaries', () => {
    const now = Date.UTC(2026, 10, 15, 12);
    const octEnd = Date.UTC(2026, 9, 31, 23, 59, 59, 999);
    const novStart = Date.UTC(2026, 10, 1);
    const invoices = [
      inv({ status: 'paid', paidAt: octEnd, grandTotal: 10 }),
      inv({
        status: 'paid',
        paidAt: novStart,
        grandTotal: 20,
        _id: 'nov',
      }),
    ];
    const stats = getDashboardStats(invoices, now, fallback);
    expect(stats.byCurrency.USD.paidThisMonth).toBe(20);
  });

  it('handles legacy docs without status or paidAt', () => {
    const now = Date.UTC(2026, 5, 15);
    const invoices = [
      { _id: 'a', created_at: Date.UTC(2026, 0, 1), grandTotal: 5 },
      {
        _id: 'b',
        status: 'paid',
        issuedAt: Date.UTC(2026, 5, 10),
        grandTotal: 7,
      },
      {
        _id: 'c',
        status: 'paid',
        created_at: Date.UTC(2026, 5, 5),
        rows: [{ price: 2, quantity: 3, subtotal: 6 }],
      },
      { _id: 'd', status: 'pending', grandTotal: 1 },
    ];
    const stats = getDashboardStats(invoices, now, fallback);
    expect(stats.byCurrency.USD.outstanding).toBe(6);
    expect(stats.byCurrency.USD.paidThisMonth).toBeCloseTo(13);
  });

  it('excludes refunded and cancelled from money, counts drafts', () => {
    const now = Date.UTC(2026, 5, 1);
    const invoices = [
      inv({ status: 'draft', grandTotal: 99 }),
      inv({ status: 'refunded', grandTotal: 50 }),
      inv({ status: 'cancelled', grandTotal: 40 }),
    ];
    const stats = getDashboardStats(invoices, now, fallback);
    expect(stats.byCurrency.USD.outstanding).toBe(0);
    expect(stats.counts.draft).toBe(1);
  });
});

describe('getMonthlyPaid', () => {
  it('returns six months ending at current month across year boundary', () => {
    const now = Date.UTC(2026, 1, 10);
    const data = getMonthlyPaid([], now, 6, fallback);
    expect(data.USD).toBeUndefined();
    const invoices = [inv({ status: 'paid', paidAt: Date.UTC(2025, 8, 5) })];
    const withData = getMonthlyPaid(invoices, now, 6, fallback);
    expect(withData.USD.map(r => r.key)).toEqual([
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
    expect(withData.USD[0].total).toBe(100);
    expect(withData.USD[1].total).toBe(0);
  });
});

describe('getNeedsAttention', () => {
  const now = startOfLocalDay(Date.UTC(2026, 5, 10));

  it('lists overdue first then pending due within seven days', () => {
    const overdue = inv({
      _id: 'o',
      status: 'pending',
      dueDate: { useCustom: true, selectedDate: addLocalDays(now, -2) },
    });
    const soon = inv({
      _id: 's',
      status: 'pending',
      dueDate: { useCustom: true, selectedDate: addLocalDays(now, 3) },
    });
    const list = getNeedsAttention([soon, overdue], now, 7);
    expect(list.map(i => i._id)).toEqual(['o', 's']);
  });

  it('excludes day eight and missing due dates', () => {
    const day8 = inv({
      status: 'pending',
      dueDate: { useCustom: true, selectedDate: addLocalDays(now, 8) },
    });
    const noDue = inv({ status: 'pending' });
    const list = getNeedsAttention([day8, noDue], now, 7);
    expect(list).toHaveLength(0);
  });

  it('includes an invoice due at local midnight on day seven', () => {
    const day7 = addLocalDays(now, 7);
    const dueDay7 = inv({
      _id: 'd7',
      status: 'pending',
      dueDate: { useCustom: true, selectedDate: day7 },
    });
    expect(getNeedsAttention([dueDay7], now, 7).map(i => i._id)).toEqual([
      'd7',
    ]);
  });

  it('excludes an invoice due at local midnight on day eight', () => {
    const day8 = addLocalDays(now, 8);
    const dueDay8 = inv({
      status: 'pending',
      dueDate: { useCustom: true, selectedDate: day8 },
    });
    expect(getNeedsAttention([dueDay8], now, 7)).toHaveLength(0);
  });
});

describe('getRecentInvoices', () => {
  it('sorts by issuedAt then created_at', () => {
    const invoices = [
      inv({ _id: 'old', created_at: 1, issuedAt: 2 }),
      inv({ _id: 'new', created_at: 5, issuedAt: 10 }),
    ];
    expect(getRecentInvoices(invoices, 5).map(i => i._id)).toEqual([
      'new',
      'old',
    ]);
  });
});

describe('resolveDashboardCurrencySelection', () => {
  it('prefers configured currency over first available when unset', () => {
    expect(resolveDashboardCurrencySelection(null, ['USD', 'EUR'], 'EUR')).toBe(
      'EUR'
    );
  });

  it('does not stick to USD when configured currency is available', () => {
    expect(
      resolveDashboardCurrencySelection(null, ['USD', 'EUR'], 'EUR')
    ).not.toBe('USD');
  });

  it('keeps an explicit user selection until that code disappears', () => {
    expect(
      resolveDashboardCurrencySelection('USD', ['USD', 'EUR'], 'EUR')
    ).toBe('USD');
    expect(resolveDashboardCurrencySelection('USD', ['EUR'], 'EUR')).toBe(
      'EUR'
    );
  });
});

describe('America/New_York local boundaries', () => {
  beforeEach(() => {
    vi.stubEnv('TZ', AMERICA_NEW_YORK);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('buckets paidThisMonth on both sides of a local month boundary', () => {
    const lastOct = new Date(2026, 9, 31, 23, 30, 0, 0).getTime();
    const firstNov = new Date(2026, 10, 1, 0, 30, 0, 0).getTime();
    const nowNov = new Date(2026, 10, 15, 12, 0, 0, 0).getTime();
    const invoices = [
      inv({ status: 'paid', paidAt: lastOct, grandTotal: 10, _id: 'oct' }),
      inv({
        status: 'paid',
        paidAt: firstNov,
        grandTotal: 20,
        _id: 'nov',
      }),
    ];
    const stats = getDashboardStats(invoices, nowNov, fallback);
    expect(stats.byCurrency.USD.paidThisMonth).toBe(20);
    const octOnly = getDashboardStats([invoices[0]], lastOct, fallback);
    expect(octOnly.byCurrency.USD.paidThisMonth).toBe(10);
  });

  it('counts a due date on the 23-hour spring-forward day', () => {
    const springForward = new Date(2026, 2, 8, 12, 0, 0, 0).getTime();
    const dueNextDay = addLocalDays(startOfLocalDay(springForward), 1);
    const invoice = inv({
      status: 'pending',
      dueDate: { useCustom: true, selectedDate: dueNextDay },
    });
    expect(getNeedsAttention([invoice], springForward, 7)).toHaveLength(1);
  });

  it('counts a due date on the 25-hour fall-back day', () => {
    const fallBack = new Date(2026, 10, 1, 12, 0, 0, 0).getTime();
    const dueSameDay = addLocalDays(startOfLocalDay(fallBack), 0);
    const invoice = inv({
      status: 'pending',
      dueDate: { useCustom: true, selectedDate: dueSameDay },
    });
    expect(getNeedsAttention([invoice], fallBack, 7)).toHaveLength(1);
  });
});

describe('useNow refresh across local midnight', () => {
  beforeEach(() => {
    vi.stubEnv('TZ', AMERICA_NEW_YORK);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('updates now via the interval when local midnight passes without focus', () => {
    const beforeMidnight = new Date(2026, 10, 1, 23, 59, 0, 0).getTime();
    vi.setSystemTime(beforeMidnight);
    const { result } = renderHook(() => useNow());
    expect(new Date(result.current).getDate()).toBe(1);

    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });

    expect(new Date(result.current).getDate()).toBe(2);
    expect(new Date(result.current).getHours()).toBe(0);
  });
});

describe('formatMoney', () => {
  it('formats with currency placement', () => {
    expect(formatMoney(10, fallback)).toBe('USD 10.00');
  });
});

describe('startOfLocalMonth', () => {
  it('aligns to first local day of month', () => {
    const ts = Date.UTC(2026, 5, 15, 18, 0);
    expect(startOfLocalMonth(ts)).toBe(new Date(2026, 5, 1).getTime());
  });
});
