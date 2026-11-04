import { describe, expect, it } from 'vitest';
import { facetOptions, matchesAny, toggleValue } from '../listFilters';

describe('toggleValue', () => {
  it('adds a missing value and removes a present one', () => {
    expect(toggleValue(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleValue(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('matchesAny', () => {
  it('treats an empty selection as no filter', () => {
    expect(matchesAny([], () => false)).toBe(true);
  });

  it('matches when any selected value passes', () => {
    expect(matchesAny(['x', 'y'], v => v === 'y')).toBe(true);
    expect(matchesAny(['x'], v => v === 'y')).toBe(false);
  });
});

describe('facetOptions', () => {
  const rows = [
    { client: 'Zed' },
    { client: 'acme' },
    { client: 'Acme Corp' },
    { client: 'Zed' },
    { client: '' },
  ];

  it('counts distinct values, most common first, then by name', () => {
    expect(facetOptions(rows, r => r.client)).toEqual([
      { value: 'Zed', label: 'Zed', count: 2 },
      { value: 'acme', label: 'acme', count: 1 },
      { value: 'Acme Corp', label: 'Acme Corp', count: 1 },
    ]);
  });

  it('keeps selected values that no longer match any row', () => {
    const options = facetOptions([], r => r.client, ['Gone']);
    expect(options).toEqual([{ value: 'Gone', label: 'Gone', count: 0 }]);
  });
});
