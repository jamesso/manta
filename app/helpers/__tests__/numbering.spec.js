import { beforeEach, vi } from 'vitest';
import {
  DEFAULT_CREDIT_NOTE_NUMBERING,
  DEFAULT_ESTIMATE_NUMBERING,
  DEFAULT_NUMBERING,
  defaultNumberingFor,
  normalizeNumbering,
  formatInvoiceNumber,
  advanceNumbering,
  mergeNumbering,
  assignNumberIfMissing,
  numberingKeyFor,
  reconcileNumberingWithPersistedInvoices,
  resolveFormInvoiceIdForWrite,
  isRandomNumber,
  resolveStoredNumbering,
  suggestedInvoiceNumberFromReconciled,
} from '../numbering';

describe('estimate and credit-note numbering', () => {
  it('maps each doc type to its settings key', () => {
    expect(numberingKeyFor('estimate')).toBe('estimateNumbering');
    expect(numberingKeyFor('creditNote')).toBe('creditNoteNumbering');
    expect(numberingKeyFor('invoice')).toBe('numbering');
    expect(numberingKeyFor(undefined)).toBe('numbering');
  });

  it('uses the EST- and CN- prefixes', () => {
    expect(defaultNumberingFor('estimate').prefix).toBe('EST-');
    expect(defaultNumberingFor('creditNote').prefix).toBe('CN-');
    expect(formatInvoiceNumber(DEFAULT_ESTIMATE_NUMBERING)).toBe('EST-0001');
    expect(formatInvoiceNumber(DEFAULT_CREDIT_NOTE_NUMBERING)).toBe('CN-0001');
  });
});

describe('normalizeNumbering', () => {
  it('returns defaults for undefined', () => {
    expect(normalizeNumbering(undefined)).toEqual(DEFAULT_NUMBERING);
  });

  it('fixes bad next', () => {
    expect(normalizeNumbering({ next: 0, padding: 4, prefix: 'X-' }).next).toBe(
      1
    );
  });
});

describe('formatInvoiceNumber', () => {
  it('pads next', () => {
    expect(formatInvoiceNumber({ prefix: 'INV-', next: 7, padding: 4 })).toBe(
      'INV-0007'
    );
  });

  it('allows next longer than padding', () => {
    expect(
      formatInvoiceNumber({ prefix: 'INV-', next: 12345, padding: 4 })
    ).toBe('INV-12345');
  });

  it('allows empty prefix', () => {
    expect(formatInvoiceNumber({ prefix: '', next: 1, padding: 3 })).toBe(
      '001'
    );
  });
});

describe('advanceNumbering', () => {
  const base = { prefix: 'INV-', next: 1, padding: 4, format: 'sequential' };

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
    const special = {
      prefix: 'INV.(26)-',
      next: 1,
      padding: 2,
      format: 'sequential',
    };
    expect(advanceNumbering(special, 'INV.(26)-03')).toEqual({
      ...special,
      next: 4,
    });
  });
});

describe('mergeNumbering', () => {
  const stored = { prefix: 'INV-', next: 5, padding: 4, format: 'sequential' };
  const saved = { ...stored };

  it('keeps stored next when settings unchanged', () => {
    expect(mergeNumbering(stored, saved, saved)).toEqual(stored);
  });

  it('uses edited next when changed in settings tab', () => {
    expect(
      mergeNumbering(stored, saved, { prefix: 'INV-', next: 10, padding: 4 })
    ).toEqual({ ...stored, next: 10 });
  });

  it('keeps stored next when only prefix edited in stale tab', () => {
    expect(
      mergeNumbering(stored, saved, { prefix: '2026-', next: 1, padding: 4 })
    ).toEqual({ ...stored, prefix: '2026-' });
  });
});

describe('assignNumberIfMissing', () => {
  const base = { prefix: 'INV-', next: 1, padding: 4 };

  it('assigns number when leaving draft', () => {
    const doc = { status: 'draft', _id: 'a' };
    const { doc: next, numbering } = assignNumberIfMissing(
      doc,
      'pending',
      base
    );
    expect(next.invoiceID).toBe('INV-0001');
    expect(numbering.next).toBe(2);
  });

  it('threads consecutive numbers in bulk order', () => {
    let numbering = base;
    const first = assignNumberIfMissing(
      { status: 'draft', _id: '1' },
      'pending',
      numbering
    );
    numbering = first.numbering;
    const second = assignNumberIfMissing(
      { status: 'draft', _id: '2' },
      'pending',
      numbering
    );
    expect(first.doc.invoiceID).toBe('INV-0001');
    expect(second.doc.invoiceID).toBe('INV-0002');
  });

  it('leaves numbered doc unchanged', () => {
    const doc = { status: 'draft', invoiceID: 'INV-0099' };
    const { doc: next, numbering } = assignNumberIfMissing(
      doc,
      'pending',
      base
    );
    expect(next.invoiceID).toBe('INV-0099');
    expect(numbering.next).toBe(1);
  });

  it('does not assign for draft to draft', () => {
    const doc = { status: 'draft', _id: 'a' };
    const { doc: next, numbering } = assignNumberIfMissing(doc, 'draft', base);
    expect(next.invoiceID).toBeUndefined();
    expect(numbering.next).toBe(1);
  });
});

describe('reconcileNumberingWithPersistedInvoices', () => {
  const base = { prefix: 'INV-', next: 1, padding: 4 };

  it('bumps next past highest matching invoice id', () => {
    const next = reconcileNumberingWithPersistedInvoices(base, [
      { docType: 'invoice', invoiceID: 'INV-0007' },
      { docType: 'invoice', invoiceID: 'INV-0002' },
    ]);
    expect(next.next).toBe(8);
  });

  it('skips tombstones and non-invoice doc types', () => {
    const next = reconcileNumberingWithPersistedInvoices(base, [
      { recurringTombstone: true, invoiceID: 'INV-9999' },
      { docType: 'estimate', invoiceID: 'INV-0004' },
      { docType: 'creditNote', invoiceID: 'INV-0003' },
    ]);
    expect(next.next).toBe(1);
  });

  it('ignores an estimate whose number is above the invoice counter', () => {
    const next = reconcileNumberingWithPersistedInvoices(base, [
      { docType: 'invoice', invoiceID: 'INV-0003' },
      { docType: 'estimate', invoiceID: 'INV-0050' },
      { docType: 'creditNote', invoiceID: 'INV-0060' },
    ]);
    expect(next).toEqual({
      prefix: 'INV-',
      next: 4,
      padding: 4,
      format: 'sequential',
    });
  });
});

describe('resolveFormInvoiceIdForWrite', () => {
  const numbering = { prefix: 'INV-', next: 1, padding: 4 };

  it('allocates the next free id when the form matches the suggested number but it is taken', () => {
    const id = resolveFormInvoiceIdForWrite({
      formInvoiceId: 'INV-0001',
      ownDocId: 'new-id',
      persistedInvoiceId: undefined,
      numbering,
      invoices: [{ _id: 'a', docType: 'invoice', invoiceID: 'INV-0001' }],
    });
    expect(id).toBe('INV-0002');
  });

  it('keeps a typed number that is not used elsewhere', () => {
    const id = resolveFormInvoiceIdForWrite({
      formInvoiceId: 'INV-0099',
      ownDocId: 'new-id',
      persistedInvoiceId: undefined,
      numbering,
      invoices: [],
    });
    expect(id).toBe('INV-0099');
  });
});

describe('random number format', () => {
  const random = { ...DEFAULT_NUMBERING, format: 'random' };

  // vitest.setup.js mocks randomUUID with a fixed value.
  beforeEach(() => {
    vi.mocked(crypto.randomUUID).mockRestore();
  });

  it('defaults to sequential and drops unknown formats', () => {
    expect(normalizeNumbering({ prefix: 'X-' }).format).toBe('sequential');
    expect(normalizeNumbering({ format: 'nope' }).format).toBe('sequential');
    expect(normalizeNumbering(random).format).toBe('random');
  });

  it('formats an 8-character hex ID with a letter', () => {
    for (let i = 0; i < 50; i += 1) {
      const id = formatInvoiceNumber(random);
      expect(isRandomNumber(id)).toBe(true);
      expect(id).toMatch(/[a-f]/);
    }
  });

  it('does not move the counter', () => {
    const base = { ...random, prefix: '', next: 3 };
    expect(advanceNumbering(base, '12345678')).toEqual(base);
    expect(
      assignNumberIfMissing({ status: 'draft' }, 'pending', base).numbering
    ).toEqual(base);
  });

  it('keeps the current random ID while no doc uses it', () => {
    expect(
      suggestedInvoiceNumberFromReconciled(null, random, [], 'abcd1234')
    ).toBe('abcd1234');
  });

  it('makes a new ID when any doc type already uses the current one', () => {
    const docs = [{ docType: 'estimate', invoiceID: 'abcd1234' }];
    const next = suggestedInvoiceNumberFromReconciled(
      null,
      random,
      docs,
      'abcd1234'
    );
    expect(isRandomNumber(next)).toBe(true);
    expect(next).not.toBe('abcd1234');
  });

  it('replaces a sequential number in the form', () => {
    expect(
      isRandomNumber(
        suggestedInvoiceNumberFromReconciled(null, random, [], 'INV-0001')
      )
    ).toBe(true);
  });

  it('takes the format from settings, not the counter overlay', () => {
    const overlay = { ...DEFAULT_NUMBERING, next: 9 };
    expect(resolveStoredNumbering(overlay, random)).toEqual({
      ...random,
      next: 9,
    });
  });

  it('merges an edited format', () => {
    const saved = DEFAULT_NUMBERING;
    expect(mergeNumbering({ ...saved, next: 5 }, saved, random)).toEqual({
      ...saved,
      next: 5,
      format: 'random',
    });
  });

  it('gives a free random ID on write when the typed one is taken', () => {
    const id = resolveFormInvoiceIdForWrite({
      formInvoiceId: 'abcd1234',
      ownDocId: 'me',
      numbering: random,
      invoices: [{ _id: 'other', invoiceID: 'abcd1234' }],
    });
    expect(isRandomNumber(id)).toBe(true);
    expect(id).not.toBe('abcd1234');
  });
});
