import {
  DEFAULT_NUMBERING,
  normalizeNumbering,
  formatInvoiceNumber,
  advanceNumbering,
  mergeNumbering,
} from '../numbering';

describe('normalizeNumbering', () => {
  it('returns defaults for undefined', () => {
    expect(normalizeNumbering(undefined)).toEqual(DEFAULT_NUMBERING);
  });

  it('fixes bad next', () => {
    expect(normalizeNumbering({ next: 0, padding: 4, prefix: 'X-' }).next).toBe(1);
  });
});

describe('formatInvoiceNumber', () => {
  it('pads next', () => {
    expect(formatInvoiceNumber({ prefix: 'INV-', next: 7, padding: 4 })).toBe('INV-0007');
  });

  it('allows next longer than padding', () => {
    expect(formatInvoiceNumber({ prefix: 'INV-', next: 12345, padding: 4 })).toBe(
      'INV-12345'
    );
  });

  it('allows empty prefix', () => {
    expect(formatInvoiceNumber({ prefix: '', next: 1, padding: 3 })).toBe('001');
  });
});

describe('advanceNumbering', () => {
  const base = { prefix: 'INV-', next: 1, padding: 4 };

  it('advances when saved id matches suggestion', () => {
    expect(advanceNumbering(base, 'INV-0001')).toEqual({ ...base, next: 2 });
  });

  it('advances to typed higher number', () => {
    expect(advanceNumbering(base, 'INV-0099')).toEqual({ ...base, next: 100 });
  });

  it('does not rewind for lower typed number', () => {
    expect(advanceNumbering({ ...base, next: 50 }, 'INV-0002')).toEqual({
      ...base,
      next: 50,
    });
  });

  it('ignores other prefix', () => {
    expect(advanceNumbering(base, 'BILL-0001')).toEqual(base);
  });

  it('escapes regexp characters in prefix', () => {
    const special = { prefix: 'INV.(26)-', next: 1, padding: 2 };
    expect(advanceNumbering(special, 'INV.(26)-03')).toEqual({
      ...special,
      next: 4,
    });
  });
});

describe('mergeNumbering', () => {
  const stored = { prefix: 'INV-', next: 5, padding: 4 };
  const saved = { prefix: 'INV-', next: 5, padding: 4 };

  it('keeps stored next when settings unchanged', () => {
    expect(mergeNumbering(stored, saved, saved)).toEqual(stored);
  });

  it('uses edited next when changed in settings tab', () => {
    expect(
      mergeNumbering(stored, saved, { prefix: 'INV-', next: 10, padding: 4 })
    ).toEqual({ prefix: 'INV-', next: 10, padding: 4 });
  });

  it('keeps stored next when only prefix edited in stale tab', () => {
    expect(
      mergeNumbering(stored, saved, { prefix: '2026-', next: 1, padding: 4 })
    ).toEqual({ prefix: '2026-', next: 5, padding: 4 });
  });
});
