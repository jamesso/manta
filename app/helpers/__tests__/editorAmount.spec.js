import { describe, it, expect } from 'vitest';
import { formatAmount } from '../../components/form/editor/formatAmount';
describe('editor amount display', () => {
  it('formats valid fractions and safely falls back for invalid fractions', () => {
    expect(formatAmount(12.5, { fraction: 2, separator: 'commaDot' })).toBe(
      '12.50'
    );
    expect(formatAmount(12.5, { fraction: -1, separator: 'commaDot' })).toBe(
      '12.50'
    );
    expect(formatAmount(12.5, { fraction: 101, separator: 'commaDot' })).toBe(
      '12.50'
    );
    expect(formatAmount(Infinity, { fraction: 2, separator: 'commaDot' })).toBe(
      '0.00'
    );
  });
});
