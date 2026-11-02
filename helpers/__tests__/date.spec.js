import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calTermDate } from '../date';

describe('calTermDate', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-11-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds net30 days from the invoice date, not today', () => {
    const createdAt = Date.UTC(2025, 0, 15, 10);
    expect(calTermDate(createdAt, 'net30')).toBe(Date.UTC(2025, 1, 14, 10));
  });

  it('rolls month and year for net7', () => {
    const createdAt = Date.UTC(2025, 11, 28);
    expect(calTermDate(createdAt, 'net7')).toBe(Date.UTC(2026, 0, 4));
  });

  it('defaults unknown or null term to 7 days', () => {
    const createdAt = Date.UTC(2025, 0, 1);
    expect(calTermDate(createdAt, null)).toBe(Date.UTC(2025, 0, 8));
    expect(calTermDate(createdAt, 'unknown')).toBe(Date.UTC(2025, 0, 8));
  });
});
