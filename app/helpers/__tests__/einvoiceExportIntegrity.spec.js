import { describe, expect, it } from 'vitest';

import { validateEInvoiceExportPayload } from '../einvoiceExportIntegrity';
import { getEInvoiceDerived } from '../einvoice';

const lineInvoice = {
  _id: 'x',
  docType: 'invoice',
  status: 'pending',
  invoiceID: 'INV-1',
  issuedAt: Date.UTC(2026, 0, 15),
  currency: { code: 'EUR', fraction: 2 },
  taxMode: 'line',
  taxCalc: 1,
  rows: [
    {
      description: 'Work',
      quantity: 1,
      price: 100,
      subtotal: 100,
      taxRate: 19,
      taxCategory: 'S',
    },
  ],
};

function derivedFor(invoice) {
  return getEInvoiceDerived(invoice, {
    profile: {},
    invoiceSettings: { tax: { tin: '' } },
    lang: 'en',
  });
}

describe('validateEInvoiceExportPayload', () => {
  it('accepts matching derived totals', () => {
    const invoice = { ...lineInvoice };
    const derived = derivedFor(invoice);
    expect(validateEInvoiceExportPayload(invoice, derived)).toBeNull();
  });

  it('rejects tampered grand total', () => {
    const invoice = { ...lineInvoice };
    const derived = derivedFor(invoice);
    derived.totals = { ...derived.totals, grandTotal: derived.totals.grandTotal + 1 };
    expect(validateEInvoiceExportPayload(invoice, derived)).toBe(
      'derived-total-mismatch'
    );
  });

  it('rejects negative unit price', () => {
    const invoice = {
      ...lineInvoice,
      rows: [{ ...lineInvoice.rows[0], price: -1 }],
    };
    expect(validateEInvoiceExportPayload(invoice, derivedFor(invoice))).toBe(
      'invalid-price'
    );
  });

  it('rejects non-integer quantity', () => {
    const invoice = {
      ...lineInvoice,
      rows: [{ ...lineInvoice.rows[0], quantity: 1.5 }],
    };
    expect(validateEInvoiceExportPayload(invoice, derivedFor(invoice))).toBe(
      'invalid-quantity'
    );
  });

  it('rejects invalid currency code', () => {
    const invoice = {
      ...lineInvoice,
      currency: { code: 'EURO', fraction: 2 },
    };
    expect(validateEInvoiceExportPayload(invoice, derivedFor(invoice))).toBe(
      'invalid-currency'
    );
  });

  it('rejects unsupported unit code', () => {
    const invoice = {
      ...lineInvoice,
      rows: [{ ...lineInvoice.rows[0], unitCode: 'ZZZ' }],
    };
    expect(validateEInvoiceExportPayload(invoice, derivedFor(invoice))).toBe(
      'invalid-unit-code'
    );
  });

  it('rejects non-finite issue date', () => {
    const invoice = { ...lineInvoice };
    const derived = derivedFor(invoice);
    derived.issuedAt = Number.NaN;
    expect(validateEInvoiceExportPayload(invoice, derived)).toBe(
      'derived-issue-date-mismatch'
    );
  });

  it('rejects derived issue date that differs from invoice', () => {
    const invoice = { ...lineInvoice };
    const derived = derivedFor(invoice);
    derived.issuedAt = Date.UTC(2026, 0, 1);
    expect(validateEInvoiceExportPayload(invoice, derived)).toBe(
      'derived-issue-date-mismatch'
    );
  });

  it('rejects lowercase currency code', () => {
    const invoice = {
      ...lineInvoice,
      currency: { code: 'eur', fraction: 2 },
    };
    expect(validateEInvoiceExportPayload(invoice, derivedFor(invoice))).toBe(
      'invalid-currency'
    );
  });

  it('rejects derived tax breakdown missing a group', () => {
    const invoice = {
      ...lineInvoice,
      rows: [
        {
          description: 'Standard',
          quantity: 1,
          price: 100,
          subtotal: 100,
          taxRate: 19,
          taxCategory: 'S',
        },
        {
          description: 'Reduced',
          quantity: 1,
          price: 50,
          subtotal: 50,
          taxRate: 7,
          taxCategory: 'S',
        },
      ],
    };
    const derived = derivedFor(invoice);
    derived.totals = {
      ...derived.totals,
      taxBreakdown: derived.totals.taxBreakdown.slice(0, 1),
    };
    expect(validateEInvoiceExportPayload(invoice, derived)).toBe(
      'derived-total-mismatch'
    );
  });

  it('rejects oversized note text', () => {
    const invoice = { ...lineInvoice, note: 'x'.repeat(10_001) };
    expect(validateEInvoiceExportPayload(invoice, derivedFor(invoice))).toBe(
      'text-too-long'
    );
  });
});
