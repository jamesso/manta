// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { getEInvoiceIssues } from '../getEInvoiceIssues.js';

function baseModel(overrides = {}) {
  return {
    number: 'INV-1',
    typeCode: '380',
    currency: 'EUR',
    dueDate: '2026-02-01',
    buyerReference: '04011000-1234512345-06',
    seller: {
      name: 'Seller',
      vatId: 'DE123456789',
      taxNumber: 'T1',
      electronicAddress: 's@de.de',
      address: {
        street: 'St',
        postcode: '10115',
        city: 'Berlin',
        countryCode: 'DE',
      },
      contact: { name: 'A', phone: '+1', email: 's@de.de' },
    },
    buyer: {
      name: 'Buyer',
      vatId: 'ATU12345678',
      electronicAddress: 'b@at.co',
      address: {
        street: 'St',
        postcode: '80331',
        city: 'Munich',
        countryCode: 'DE',
      },
    },
    payment: { iban: 'DE89370400440532013000', bic: 'COBADEFFXXX' },
    lines: [{ net: 100, taxCategory: 'S', taxRate: 19 }],
    vatBreakdown: [{ base: 100, amount: 19, category: 'S', rate: 19, exemptionReason: '' }],
    totals: {
      subtotal: 100,
      discount: 0,
      taxExclusive: 100,
      taxTotal: 19,
      grandTotal: 119,
      prepaid: 0,
      payable: 119,
    },
    ...overrides,
  };
}

function baseInvoice(overrides = {}) {
  return {
    status: 'pending',
    currency: { fraction: 2 },
    rows: [{ taxCategory: 'S', taxRate: 19, price: 100, quantity: 1 }],
    recipient: { taxId: 'ATU12345678' },
    ...overrides,
  };
}

function baseDerived(overrides = {}) {
  return {
    docType: 'invoice',
    status: 'pending',
    totals: { mode: 'line' },
    ...overrides,
  };
}

describe('getEInvoiceIssues', () => {
  it('flags unsupported estimate', () => {
    const issues = getEInvoiceIssues(baseModel(), {
      format: 'xrechnung-ubl',
      invoice: baseInvoice(),
      derived: baseDerived({ docType: 'estimate' }),
    });
    expect(issues.some(i => i.code === 'DOC_TYPE_UNSUPPORTED')).toBe(true);
  });

  it('flags draft and void credit note', () => {
    expect(
      getEInvoiceIssues(baseModel(), {
        format: 'xrechnung-ubl',
        invoice: baseInvoice({ status: 'draft' }),
        derived: baseDerived({ status: 'draft' }),
      }).some(i => i.code === 'NOT_FINAL')
    ).toBe(true);
    expect(
      getEInvoiceIssues(baseModel({ typeCode: '381' }), {
        format: 'xrechnung-ubl',
        invoice: baseInvoice({ status: 'void' }),
        derived: baseDerived({ docType: 'creditNote', status: 'void' }),
      }).some(i => i.code === 'NOT_FINAL')
    ).toBe(true);
  });

  it('flags rate/category mismatch', () => {
    const issues = getEInvoiceIssues(baseModel(), {
      format: 'facturx-en16931',
      invoice: baseInvoice({
        rows: [{ taxCategory: 'S', taxRate: 0, price: 1, quantity: 1 }],
      }),
      derived: baseDerived(),
    });
    expect(issues.some(i => i.code === 'RATE_CATEGORY_MISMATCH')).toBe(true);
  });

  it('XRechnung-only buyer reference rule', () => {
    const model = baseModel({ buyerReference: '' });
    const xr = getEInvoiceIssues(model, {
      format: 'xrechnung-ubl',
      invoice: baseInvoice(),
      derived: baseDerived(),
    });
    const fx = getEInvoiceIssues(model, {
      format: 'facturx-en16931',
      invoice: baseInvoice(),
      derived: baseDerived(),
    });
    expect(xr.some(i => i.code === 'BUYER_REFERENCE_MISSING')).toBe(true);
    expect(fx.some(i => i.code === 'BUYER_REFERENCE_MISSING')).toBe(false);
  });

  it('buyer address severity differs by format', () => {
    const model = baseModel({
      buyer: {
        ...baseModel().buyer,
        address: { street: 'S', postcode: '', city: '', countryCode: 'DE' },
      },
    });
    const xr = getEInvoiceIssues(model, {
      format: 'xrechnung-ubl',
      invoice: baseInvoice(),
      derived: baseDerived(),
    });
    const fx = getEInvoiceIssues(model, {
      format: 'facturx-en16931',
      invoice: baseInvoice(),
      derived: baseDerived(),
    });
    const xrIssue = xr.find(i => i.code === 'BUYER_ADDRESS_INCOMPLETE');
    const fxIssue = fx.find(i => i.code === 'BUYER_ADDRESS_INCOMPLETE');
    expect(xrIssue?.severity).toBe('error');
    expect(fxIssue?.severity).toBe('warning');
  });

  it('detects arithmetic mismatch on tax amount', () => {
    const model = baseModel({
      vatBreakdown: [{ base: 100, amount: 18.99, category: 'S', rate: 19, exemptionReason: '' }],
      totals: {
        subtotal: 100,
        discount: 0,
        taxExclusive: 100,
        taxTotal: 18.99,
        grandTotal: 118.99,
        prepaid: 0,
        payable: 118.99,
      },
    });
    const issues = getEInvoiceIssues(model, {
      format: 'xrechnung-ubl',
      invoice: baseInvoice(),
      derived: baseDerived(),
    });
    expect(issues.some(i => i.code === 'ARITHMETIC_MISMATCH')).toBe(true);
  });
});
