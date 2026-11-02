// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { exportKey } from '../exportKey.js';

const base = {
  _id: 'inv-1',
  docType: 'invoice',
  status: 'pending',
  invoiceID: 'INV-1',
  issuedAt: Date.UTC(2026, 0, 15),
  created_at: Date.UTC(2026, 0, 1),
  currency: { code: 'EUR', fraction: 2 },
  taxMode: 'line',
  rows: [{ description: 'A', quantity: 1, price: 10, subtotal: 10, taxRate: 19, taxCategory: 'S' }],
  configs: { template: 'business', language: 'en', showRecipient: true },
};

describe('exportKey', () => {
  it('changes when issuedAt differs for the same id', () => {
    const profile = { fullname: 'Co' };
    const configs = base.configs;
    const a = exportKey(base, profile, configs);
    const b = exportKey(
      { ...base, issuedAt: Date.UTC(2026, 0, 20) },
      profile,
      configs
    );
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes when live preview configs differ from invoice.configs', () => {
    const profile = { fullname: 'Co' };
    const invoice = {
      ...base,
      configs: { ...base.configs, showRecipient: true },
    };
    const live = { ...base.configs, showRecipient: false };
    expect(exportKey(invoice, profile, live)).not.toBe(
      exportKey(invoice, profile, invoice.configs)
    );
  });
});
