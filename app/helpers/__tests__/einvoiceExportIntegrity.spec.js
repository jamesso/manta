import { describe, expect, it } from 'vitest';

import {
  taxGroupMultisetSignature,
  validateEInvoiceExportPayload,
} from '../einvoiceExportIntegrity';
import { getEInvoiceDerived } from '../einvoice';
import { getEInvoiceIssues } from '../../../helpers/einvoice/getEInvoiceIssues.js';
import { toEn16931 } from '../../../helpers/einvoice/toEn16931.js';

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

const ctx = {
  profile: { taxId: 'T', vatId: 'V' },
  invoiceSettings: { tax: { tin: '' } },
};

function derivedFor(
  invoice,
  profile = ctx.profile,
  invoiceSettings = ctx.invoiceSettings
) {
  return getEInvoiceDerived(invoice, {
    profile,
    invoiceSettings,
    lang: 'en',
  });
}

describe('validateEInvoiceExportPayload', () => {
  it('accepts matching derived totals', () => {
    const invoice = { ...lineInvoice };
    const derived = derivedFor(invoice);
    expect(validateEInvoiceExportPayload(invoice, derived, ctx)).toBeNull();
  });

  it('rejects spoofed derived docType or status', () => {
    const estimate = {
      ...lineInvoice,
      docType: 'estimate',
      status: 'sent',
    };
    const derived = {
      ...derivedFor(estimate),
      docType: 'invoice',
      status: 'pending',
    };
    expect(validateEInvoiceExportPayload(estimate, derived, ctx)).toBe(
      'derived-doc-type-mismatch'
    );

    const draft = { ...lineInvoice, status: 'draft' };
    const derivedDraft = { ...derivedFor(draft), status: 'pending' };
    expect(validateEInvoiceExportPayload(draft, derivedDraft, ctx)).toBe(
      'derived-status-mismatch'
    );
  });

  it('rejects forged derived seller tax ids', () => {
    const invoice = {
      ...lineInvoice,
      seller: { version: 1, taxId: 'REAL', vatId: 'DE111' },
    };
    const derived = derivedFor(invoice);
    derived.seller = { taxId: 'FORGED', vatId: 'DE999' };
    expect(validateEInvoiceExportPayload(invoice, derived, ctx)).toBe(
      'derived-seller-mismatch'
    );
  });

  it('rejects forged credit-note preceding reference', () => {
    const invoice = {
      _id: 'cn',
      docType: 'creditNote',
      status: 'issued',
      invoiceID: 'CN-1',
      issuedAt: Date.UTC(2026, 1, 1),
      currency: { code: 'EUR', fraction: 2 },
      taxMode: 'line',
      rows: lineInvoice.rows,
      creditedInvoice: {
        invoiceID: 'INV-ORIG',
        issuedAt: Date.UTC(2026, 0, 1),
      },
    };
    const derived = derivedFor(invoice);
    derived.preceding = { number: 'WRONG', issuedAt: Date.UTC(2025, 0, 1) };
    expect(validateEInvoiceExportPayload(invoice, derived, ctx)).toBe(
      'derived-preceding-mismatch'
    );
  });

  it('rejects duplicate tax group masquerading as another group', () => {
    const invoice = {
      ...lineInvoice,
      rows: [
        {
          description: 'Exempt',
          quantity: 1,
          price: 100,
          subtotal: 100,
          taxRate: 0,
          taxCategory: 'E',
        },
        {
          description: 'Zero',
          quantity: 1,
          price: 100,
          subtotal: 100,
          taxRate: 0,
          taxCategory: 'Z',
        },
      ],
    };
    const derived = derivedFor(invoice);
    const zGroup = derived.totals.taxBreakdown.find(g => g.category === 'Z');
    derived.totals = {
      ...derived.totals,
      taxBreakdown: [zGroup, { ...zGroup }],
    };
    expect(validateEInvoiceExportPayload(invoice, derived, ctx)).toBe(
      'derived-total-mismatch'
    );
    expect(taxGroupMultisetSignature(derived.totals.taxBreakdown)).not.toBe(
      taxGroupMultisetSignature(derivedFor(invoice).totals.taxBreakdown)
    );
  });

  it('rejects unit prices with more than four decimal places', () => {
    const invoice = {
      ...lineInvoice,
      rows: [
        { ...lineInvoice.rows[0], price: 1.23456, quantity: 1, subtotal: 1.23 },
      ],
    };
    expect(
      validateEInvoiceExportPayload(invoice, derivedFor(invoice), ctx)
    ).toBe('invalid-price-precision');
    const fuzzy = {
      ...lineInvoice,
      rows: [
        {
          ...lineInvoice.rows[0],
          price: 1.00000000009,
          quantity: 1_000_000_000,
          subtotal: 1_000_000_000,
        },
      ],
    };
    expect(validateEInvoiceExportPayload(fuzzy, derivedFor(fuzzy), ctx)).toBe(
      'invalid-price-precision'
    );
    expect(
      validateEInvoiceExportPayload(
        { ...lineInvoice, rows: [{ ...lineInvoice.rows[0], price: 19.99 }] },
        derivedFor({
          ...lineInvoice,
          rows: [{ ...lineInvoice.rows[0], price: 19.99 }],
        }),
        ctx
      )
    ).toBeNull();
  });

  it('rejects negative credit-note grand totals', () => {
    const invoice = {
      ...lineInvoice,
      docType: 'creditNote',
      status: 'issued',
      discount: { type: 'flat', amount: 200 },
      rows: [{ ...lineInvoice.rows[0], price: 50, subtotal: 50 }],
    };
    const derived = derivedFor(invoice);
    expect(validateEInvoiceExportPayload(invoice, derived, ctx)).toBe(
      'negative-grand-total'
    );
  });

  it('rejects stored grandTotal that disagrees with recomputed totals', () => {
    const invoice = { ...lineInvoice, grandTotal: 999, subtotal: 100 };
    const derived = derivedFor(invoice);
    expect(validateEInvoiceExportPayload(invoice, derived, ctx)).toBe(
      'stored-total-mismatch'
    );
  });

  it('does not block legacy invoice-level tax with derived-total-mismatch', () => {
    const legacy = {
      ...lineInvoice,
      taxMode: undefined,
      tax: { amount: 19, method: 'default' },
      rows: [{ description: 'W', quantity: 1, price: 100, subtotal: 100 }],
    };
    const derived = derivedFor(legacy);
    expect(validateEInvoiceExportPayload(legacy, derived, ctx)).toBeNull();
    const model = toEn16931(
      legacy,
      { profile: ctx.profile, invoice: ctx.invoiceSettings },
      derived
    );
    const issues = getEInvoiceIssues(model, {
      format: 'xrechnung-ubl',
      invoice: legacy,
      derived,
    });
    expect(issues.some(i => i.code === 'TAX_PER_LINE_REQUIRED')).toBe(true);
  });

  it('rejects legacy invoice when derived totals claim line mode', () => {
    const legacy = {
      ...lineInvoice,
      taxMode: undefined,
      tax: { amount: 19, method: 'default' },
      rows: [{ description: 'W', quantity: 1, price: 100, subtotal: 100 }],
    };
    const derived = derivedFor(legacy);
    derived.totals = {
      mode: 'line',
      subtotal: 100,
      discount: 0,
      taxTotal: 19,
      grandTotal: 119,
      lines: [{ net: 100 }],
      taxBreakdown: [
        { category: 'S', rate: 19, base: 100, amount: 19, key: 'S-19' },
      ],
    };
    expect(validateEInvoiceExportPayload(legacy, derived, ctx)).toBe(
      'derived-total-mismatch'
    );
  });

  it('rejects tampered grand total', () => {
    const invoice = { ...lineInvoice };
    const derived = derivedFor(invoice);
    derived.totals = {
      ...derived.totals,
      grandTotal: derived.totals.grandTotal + 1,
    };
    expect(validateEInvoiceExportPayload(invoice, derived, ctx)).toBe(
      'derived-total-mismatch'
    );
  });

  it('rejects negative unit price', () => {
    const invoice = {
      ...lineInvoice,
      rows: [{ ...lineInvoice.rows[0], price: -1 }],
    };
    expect(
      validateEInvoiceExportPayload(invoice, derivedFor(invoice), ctx)
    ).toBe('invalid-price');
  });

  it('rejects non-integer quantity', () => {
    const invoice = {
      ...lineInvoice,
      rows: [{ ...lineInvoice.rows[0], quantity: 1.5 }],
    };
    expect(
      validateEInvoiceExportPayload(invoice, derivedFor(invoice), ctx)
    ).toBe('invalid-quantity');
  });

  it('rejects invalid currency code', () => {
    const invoice = {
      ...lineInvoice,
      currency: { code: 'EURO', fraction: 2 },
    };
    expect(
      validateEInvoiceExportPayload(invoice, derivedFor(invoice), ctx)
    ).toBe('invalid-currency');
  });

  it('rejects unsupported unit code', () => {
    const invoice = {
      ...lineInvoice,
      rows: [{ ...lineInvoice.rows[0], unitCode: 'ZZZ' }],
    };
    expect(
      validateEInvoiceExportPayload(invoice, derivedFor(invoice), ctx)
    ).toBe('invalid-unit-code');
  });

  it('rejects derived issue date that differs from invoice', () => {
    const invoice = { ...lineInvoice };
    const derived = derivedFor(invoice);
    derived.issuedAt = Date.UTC(2026, 0, 1);
    expect(validateEInvoiceExportPayload(invoice, derived, ctx)).toBe(
      'derived-issue-date-mismatch'
    );
  });

  it('rejects lowercase currency code', () => {
    const invoice = {
      ...lineInvoice,
      currency: { code: 'eur', fraction: 2 },
    };
    expect(
      validateEInvoiceExportPayload(invoice, derivedFor(invoice), ctx)
    ).toBe('invalid-currency');
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
    expect(validateEInvoiceExportPayload(invoice, derived, ctx)).toBe(
      'derived-total-mismatch'
    );
  });

  it('rejects oversized note text', () => {
    const invoice = { ...lineInvoice, note: 'x'.repeat(10_001) };
    expect(
      validateEInvoiceExportPayload(invoice, derivedFor(invoice), ctx)
    ).toBe('text-too-long');
  });
});
