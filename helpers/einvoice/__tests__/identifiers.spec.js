// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  isValidBic,
  isValidIban,
  leitwegCheck,
  looksLikeVatId,
} from '../identifiers.js';
import { fmt2, fmtQty, round2 } from '../money.js';

describe('identifiers', () => {
  it('validates IBAN', () => {
    expect(isValidIban('DE89370400440532013000')).toBe(true);
    expect(isValidIban('DE89370400440532013001')).toBe(false);
    expect(isValidIban('de89 3704 0044 0532 0130 00')).toBe(true);
  });

  it('validates BIC', () => {
    expect(isValidBic('COBADEFFXXX')).toBe(true);
    expect(isValidBic('COBADEF')).toBe(false);
  });

  it('detects VAT ID shape', () => {
    expect(looksLikeVatId('DE123456789')).toBe(true);
    expect(looksLikeVatId('not-a-vat')).toBe(false);
  });

  it('checks Leitweg-ID digits', () => {
    expect(leitwegCheck('991-33333TEST-33')).toBe('ok');
    expect(leitwegCheck('04011000-1234512345-06')).toBe('ok');
    expect(leitwegCheck('04011000-1234512345-07')).toBe('bad-check-digits');
    expect(leitwegCheck('PO-4711')).toBe('not-leitweg');
  });
});

describe('money', () => {
  it('round2 bank rounding', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(-1.005)).toBe(-1.01);
    expect(fmt2(0.1 + 0.2)).toBe('0.30');
  });

  it('fmtQty trims trailing zeros', () => {
    expect(fmtQty(1)).toBe('1');
    expect(fmtQty(1.5)).toBe('1.5');
    expect(fmtQty(1.23456)).toBe('1.2346');
  });
});
