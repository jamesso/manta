// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { toUblJson } from '../toUblJson.js';

function walkStrings(value, path = '') {
  const hits = [];
  if (typeof value === 'string') {
    if (value === '') {
      hits.push(path);
    }
    return hits;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => hits.push(...walkStrings(v, `${path}[${i}]`)));
    return hits;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      hits.push(...walkStrings(v, path ? `${path}.${k}` : k));
    }
  }
  return hits;
}

describe('toUblJson', () => {
  const model = {
    number: 'INV-9',
    issueDate: '2026-01-01',
    dueDate: '2026-02-01',
    typeCode: '380',
    currency: 'EUR',
    note: 'Thanks',
    buyerReference: '04011000-1234512345-06',
    seller: {
      name: 'Seller GmbH',
      tradingName: '',
      vatId: 'DE123456789',
      taxNumber: 'FC123',
      electronicAddress: 's@de.de',
      address: {
        street: 'St',
        city: 'Berlin',
        postcode: '10115',
        countryCode: 'DE',
      },
      contact: { name: 'A', phone: '+1', email: 's@de.de' },
    },
    buyer: {
      name: 'Buyer',
      vatId: 'ATU12345678',
      electronicAddress: 'b@at.co',
      address: {
        street: 'St2',
        city: 'Munich',
        postcode: '80331',
        countryCode: 'DE',
      },
      contactName: '',
    },
    payment: {
      meansCode: '58',
      iban: 'DE89370400440532013000',
      accountName: 'Seller GmbH',
      bic: 'COBADEFFXXX',
    },
    allowances: [{ amount: 5, category: 'S', rate: 19, reason: 'Discount' }],
    vatBreakdown: [
      {
        base: 95,
        amount: 18.05,
        category: 'S',
        rate: 19,
        exemptionReason: '',
        vatexCode: '',
      },
    ],
    lines: [
      {
        id: '1',
        quantity: 1,
        unitCode: 'C62',
        net: 95,
        price: 100,
        taxCategory: 'S',
        taxRate: 19,
        description: 'Item',
      },
    ],
    totals: {
      subtotal: 100,
      discount: 5,
      taxExclusive: 95,
      taxTotal: 18.05,
      grandTotal: 113.05,
      prepaid: 10,
      payable: 103.05,
    },
  };

  it('uses VAT and FC tax schemes and currency attributes', () => {
    const json = toUblJson(model);
    const root = json['ubl:Invoice'];
    expect(root).toBeDefined();
    expect(root['cbc:DocumentCurrencyCode']).toBe('EUR');
    expect(root['cac:TaxTotal'][0]['cbc:TaxAmount@currencyID']).toBe('EUR');
    const schemes =
      root['cac:AccountingSupplierParty']['cac:Party']['cac:PartyTaxScheme'];
    expect(schemes.some(s => s['cac:TaxScheme']['cbc:ID'] === 'VAT')).toBe(true);
    expect(schemes.some(s => s['cac:TaxScheme']['cbc:ID'] === 'FC')).toBe(true);
    expect(walkStrings(json)).toEqual([]);
  });

  it('keeps ubl:Invoice root for credit notes (library converts output)', () => {
    const json = toUblJson({
      ...model,
      typeCode: '381',
      dueDate: undefined,
      preceding: { number: 'INV-1', issuedAt: Date.parse('2025-12-01') },
    });
    expect(json['ubl:Invoice']).toBeDefined();
    expect(json['ubl:CreditNote']).toBeUndefined();
    expect(json['ubl:Invoice']['cbc:InvoiceTypeCode']).toBe('381');
    expect(
      json['ubl:Invoice']['cac:BillingReference'][0][
        'cac:InvoiceDocumentReference'
      ]['cbc:IssueDate']
    ).toBe('2025-12-01');
  });
});
