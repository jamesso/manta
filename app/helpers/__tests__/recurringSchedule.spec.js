import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  nextDateAfter,
  dateKeyToMs,
  toDateKey,
  getDuePeriods,
  firstPeriodOnOrAfter,
  DATE_KEY,
} from '../recurringSchedule';

const TZ_OFFSET = {
  UTC: 0,
  'America/New_York': 300,
  'America/Sao_Paulo': 180,
};

describe.each(['UTC', 'America/New_York', 'America/Sao_Paulo'])(
  'recurringSchedule (%s)',
  tz => {
    let prevTz;

    beforeAll(() => {
      prevTz = process.env.TZ;
      process.env.TZ = tz;
      expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(TZ_OFFSET[tz]);
    });

    afterAll(() => {
      process.env.TZ = prevTz;
    });

    it('nextDateAfter monthly anchor 31', () => {
      expect(nextDateAfter('2026-01-31', 'monthly', 1, 31)).toBe('2026-02-28');
      expect(nextDateAfter('2026-02-28', 'monthly', 1, 31)).toBe('2026-03-31');
      expect(nextDateAfter('2026-03-31', 'monthly', 1, 31)).toBe('2026-04-30');
    });

    it('anchor 30 in February', () => {
      expect(nextDateAfter('2026-01-30', 'monthly', 1, 30)).toBe('2026-02-28');
    });

    it('leap year Jan 31 to Feb 29', () => {
      expect(nextDateAfter('2028-01-31', 'monthly', 1, 31)).toBe('2028-02-29');
    });

    it('yearly anchor Feb 29', () => {
      expect(nextDateAfter('2028-02-29', 'yearly', 1, 29)).toBe('2029-02-28');
      expect(nextDateAfter('2029-02-28', 'yearly', 1, 29)).toBe('2030-02-28');
      expect(nextDateAfter('2030-02-28', 'yearly', 1, 29)).toBe('2031-02-28');
      expect(nextDateAfter('2031-02-28', 'yearly', 1, 29)).toBe('2032-02-29');
    });

    it('quarterly anchor 31', () => {
      expect(nextDateAfter('2026-01-31', 'quarterly', 1, 31)).toBe(
        '2026-04-30'
      );
      expect(nextDateAfter('2026-04-30', 'quarterly', 1, 31)).toBe(
        '2026-07-31'
      );
    });

    it('every 2 monthly', () => {
      expect(nextDateAfter('2026-01-15', 'monthly', 2, 15)).toBe('2026-03-15');
    });

    it('weekly across DST (NY)', () => {
      if (tz !== 'America/New_York') {
        return;
      }
      expect(nextDateAfter('2026-03-07', 'weekly', 1, 7)).toBe('2026-03-14');
      expect(nextDateAfter('2026-10-31', 'weekly', 1, 31)).toBe('2026-11-07');
      for (const key of [
        '2026-03-07',
        '2026-03-14',
        '2026-10-31',
        '2026-11-07',
      ]) {
        expect(toDateKey(dateKeyToMs(key))).toBe(key);
      }
    });

    it('Sao_Paulo nonexistent midnight', () => {
      if (tz !== 'America/Sao_Paulo') {
        return;
      }
      expect(toDateKey(dateKeyToMs('2018-11-04'))).toBe('2018-11-04');
    });

    it('getDuePeriods midnight boundaries', () => {
      const profile = {
        active: true,
        interval: 'monthly',
        every: 1,
        anchorDay: 15,
        startDate: '2026-01-15',
        nextDate: '2026-06-15',
        endDate: null,
      };
      const before = dateKeyToMs('2026-06-15') - 1;
      expect(getDuePeriods(profile, before).periods).toEqual([]);
      const atStart = dateKeyToMs('2026-06-15');
      expect(getDuePeriods(profile, atStart).periods).toEqual(['2026-06-15']);
      const atEnd =
        dateKeyToMs('2026-06-15') +
        23 * 3600 * 1000 +
        59 * 60 * 1000 +
        59 * 1000;
      expect(getDuePeriods(profile, atEnd).periods).toEqual(['2026-06-15']);
    });

    it('inactive profile', () => {
      const profile = {
        active: false,
        interval: 'monthly',
        every: 1,
        anchorDay: 1,
        startDate: '2026-01-01',
        nextDate: '2026-01-01',
      };
      expect(getDuePeriods(profile, Date.now()).periods).toEqual([]);
    });

    it('endDate inclusive', () => {
      const profile = {
        active: true,
        interval: 'monthly',
        every: 1,
        anchorDay: 10,
        startDate: '2026-01-10',
        nextDate: '2026-03-10',
        endDate: '2026-03-10',
      };
      const now = dateKeyToMs('2026-03-10') + 3600 * 1000;
      const r = getDuePeriods(profile, now);
      expect(r.periods).toEqual(['2026-03-10']);
      expect(r.nextDate).toBe('2026-04-10');
    });

    it('endDate before nextDate', () => {
      const profile = {
        active: true,
        interval: 'monthly',
        every: 1,
        anchorDay: 1,
        startDate: '2026-01-01',
        nextDate: '2026-05-01',
        endDate: '2026-03-01',
      };
      expect(getDuePeriods(profile, dateKeyToMs('2026-06-01')).periods).toEqual(
        []
      );
    });

    it('caps at 12 periods', () => {
      const profile = {
        active: true,
        interval: 'monthly',
        every: 1,
        anchorDay: 1,
        startDate: '2024-01-01',
        nextDate: '2024-01-01',
        endDate: null,
      };
      const now = dateKeyToMs('2026-06-01');
      const first = getDuePeriods(profile, now);
      expect(first.periods).toHaveLength(12);
      expect(first.capped).toBe(true);
      const second = getDuePeriods(
        { ...profile, nextDate: first.nextDate },
        now
      );
      expect(second.periods).toHaveLength(12);
    });

    it('invalid every and interval', () => {
      const base = {
        active: true,
        interval: 'monthly',
        every: 1,
        anchorDay: 1,
        startDate: '2026-01-01',
        nextDate: '2026-01-01',
      };
      expect(getDuePeriods({ ...base, every: 0 }, Date.now()).periods).toEqual(
        []
      );
      expect(
        getDuePeriods({ ...base, every: 1.5 }, Date.now()).periods
      ).toEqual([]);
      expect(
        getDuePeriods({ ...base, interval: 'daily' }, Date.now()).periods
      ).toEqual([]);
    });

    it('getDuePeriods idempotent', () => {
      const profile = {
        active: true,
        interval: 'monthly',
        every: 1,
        anchorDay: 1,
        startDate: '2026-01-01',
        nextDate: '2026-01-01',
        endDate: null,
      };
      const now = dateKeyToMs('2026-03-15');
      const a = getDuePeriods(profile, now);
      const b = getDuePeriods(profile, now);
      expect(a).toEqual(b);
    });

    it('firstPeriodOnOrAfter', () => {
      const profile = {
        interval: 'monthly',
        every: 1,
        anchorDay: 31,
        startDate: '2025-01-31',
      };
      expect(firstPeriodOnOrAfter(profile, '2026-12-01')).toBe('2026-12-31');
      expect(firstPeriodOnOrAfter(profile, '2025-01-31')).toBe('2025-01-31');
      expect(firstPeriodOnOrAfter(profile, '2026-11-01')).toBe('2026-11-30');
    });
  }
);

describe('DATE_KEY format', () => {
  it('uses YYYY-MM-DD', () => {
    expect(DATE_KEY).toBe('YYYY-MM-DD');
  });
});
