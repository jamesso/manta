import { describe, expect, it } from 'vitest';

import { normalizeFraction, roundMoney } from '../money';

describe('normalizeFraction', () => {
  it('accepts integers 0–8', () => {
    expect(normalizeFraction(0)).toBe(0);
    expect(normalizeFraction(8)).toBe(8);
  });

  it('falls back to 2 for invalid values', () => {
    expect(normalizeFraction('x')).toBe(2);
    expect(normalizeFraction(-1)).toBe(2);
    expect(normalizeFraction(9)).toBe(2);
    expect(normalizeFraction(2.5)).toBe(2);
  });
});

describe('roundMoney', () => {
  it('matches plan reference values at fraction 2', () => {
    expect(roundMoney(1.005, 2)).toBe(1.01);
    expect(roundMoney(2.675, 2)).toBe(2.68);
    expect(roundMoney(3937.0375, 2)).toBe(3937.04);
    expect(roundMoney(0.1 + 0.2, 2)).toBe(0.3);
    expect(roundMoney(99.995, 2)).toBe(100);
  });

  it('rounds at fraction 0', () => {
    expect(roundMoney(1234.5, 0)).toBe(1235);
  });

  it('keeps sign and treats non-finite as 0', () => {
    expect(roundMoney(-1.005, 2)).toBe(-1.01);
    expect(roundMoney(Number.NaN, 2)).toBe(0);
    expect(roundMoney(Number.POSITIVE_INFINITY, 2)).toBe(0);
  });

  it('normalizes negative zero', () => {
    expect(Object.is(roundMoney(-0, 2), -0)).toBe(false);
    expect(roundMoney(-0, 2)).toBe(0);
  });
});
