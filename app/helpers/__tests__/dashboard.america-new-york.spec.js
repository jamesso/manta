import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useNow } from '../../components/invoices/useNow';
import {
  addLocalDays,
  getDashboardStats,
  getNeedsAttention,
  startOfLocalDay,
} from '../dashboard';

const MS_HOUR = 60 * 60 * 1000;
const REQUIRED_TZ = 'America/New_York';

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

function localDaySpanMs(year, monthIndex, day) {
  const start = new Date(year, monthIndex, day, 0, 0, 0, 0).getTime();
  const end = new Date(year, monthIndex, day + 1, 0, 0, 0, 0).getTime();
  return end - start;
}

describe('America/New_York dashboard boundaries', () => {
  beforeAll(() => {
    expect(process.env.TZ).toBe(REQUIRED_TZ);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses a 23-hour local day on US spring-forward and a 25-hour day on fall-back', () => {
    expect(localDaySpanMs(2026, 2, 8)).toBe(23 * MS_HOUR);
    expect(localDaySpanMs(2026, 10, 1)).toBe(25 * MS_HOUR);
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
    expect(localDaySpanMs(2026, 2, 8)).toBe(23 * MS_HOUR);
    const dueNextDay = addLocalDays(startOfLocalDay(springForward), 1);
    const invoice = inv({
      status: 'pending',
      dueDate: { useCustom: true, selectedDate: dueNextDay },
    });
    expect(getNeedsAttention([invoice], springForward, 7)).toHaveLength(1);
  });

  it('counts a due date on the 25-hour fall-back day', () => {
    const fallBack = new Date(2026, 10, 1, 12, 0, 0, 0).getTime();
    expect(localDaySpanMs(2026, 10, 1)).toBe(25 * MS_HOUR);
    const dueSameDay = addLocalDays(startOfLocalDay(fallBack), 0);
    const invoice = inv({
      status: 'pending',
      dueDate: { useCustom: true, selectedDate: dueSameDay },
    });
    expect(getNeedsAttention([invoice], fallBack, 7)).toHaveLength(1);
  });

  it('updates useNow via the interval when local midnight passes without focus', () => {
    vi.useFakeTimers();
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
