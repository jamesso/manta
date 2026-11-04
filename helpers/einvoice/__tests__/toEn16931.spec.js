// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { toEn16931, resolveProfile } from '../toEn16931.js';
import { getInvoiceTotals } from '../../../app/helpers/invoice.js';

const profile = {
  legalName: 'Legal Co',
  company: 'Trade Co',
  fullname: 'Contact',
  email: 'a@b.de',
  phone: '+1',
  postalAddress: {
    street: 'St',
    postcode: '10115',
    city: 'Berlin',
    countryCode: 'DE',
  },
  bank: {
    iban: 'DE89370400440532013000',
    bic: 'COBADEFFXXX',
    accountName: 'Co',
  },
};

const settings = { profile, invoice: {} };

function derived(overrides = {}) {
  return {
    docType: 'invoice',
    status: 'pending',
    issuedAt: Date.parse('2026-03-10T10:00:00'),
    dueAt: Date.parse('2026-04-10T10:00:00'),
    amountPaid: 0,
    totals: {
      mode: 'line',
      subtotal: 100,
      discount: 0,
      taxTotal: 19,
      grandTotal: 119,
      lines: [{ net: 100 }],
      taxBreakdown: [
        {
          key: 'S-19',
          category: 'S',
          rate: 19,
          base: 100,
          amount: 19,
          exemptionReason: '',
        },
      ],
    },
    seller: { taxId: 'T1', vatId: 'DE123456789' },
    preceding: null,
    lang: 'en',
    ...overrides,
  };
}

describe('resolveProfile', () => {
  const currentProfile = { address: '99 Changed Street', fullname: 'Live' };

  it('keeps snapshot free-text address when the key is present', () => {
    const invoice = { seller: { address: '1 Original Street', taxId: 'T' } };
    expect(resolveProfile(invoice, { profile: currentProfile }).address).toBe(
      '1 Original Street'
    );
  });

  it('uses current profile address when snapshot omits the key', () => {
    const invoice = { seller: { taxId: 'T' } };
    expect(resolveProfile(invoice, { profile: currentProfile }).address).toBe(
      '99 Changed Street'
    );
  });

  it('does not fall through when snapshot address is empty', () => {
    const invoice = { seller: { address: '', taxId: 'T' } };
    expect(resolveProfile(invoice, { profile: currentProfile }).address).toBe(
      ''
    );
  });
});

describe('toEn16931', () => {
  it('maps a single-rate invoice', () => {
    const invoice = {
      invoiceID: ' INV-1 ',
      currency: { code: 'EUR' },
      recipient: { company: 'Buyer', fullname: 'Person', email: 'b@c.de' },
      rows: [
        {
          price: 100,
          quantity: 1,
          taxCategory: 'S',
          taxRate: 19,
          description: 'Work',
        },
      ],
    };
    const model = toEn16931(invoice, settings, derived());
    expect(model.number).toBe('INV-1');
    expect(model.typeCode).toBe('380');
    expect(model.issueDate).toBe('2026-03-10');
    expect(model.dueDate).toBe('2026-04-10');
    expect(model.lines[0].net).toBe(100);
    expect(model.lines[0].unitCode).toBe('C62');
    expect(model.seller.name).toBe('Legal Co');
    expect(model.seller.tradingName).toBe('Trade Co');
  });

  it('uses totals.lines nets not price*qty', () => {
    const invoice = {
      invoiceID: 'X',
      currency: { code: 'EUR' },
      recipient: { fullname: 'B' },
      rows: [{ price: 10, quantity: 3, taxCategory: 'S', taxRate: 19 }],
    };
    const d = derived({
      totals: {
        mode: 'line',
        subtotal: 29.99,
        discount: 0,
        taxTotal: 5.7,
        grandTotal: 35.69,
        lines: [{ net: 29.99 }],
        taxBreakdown: [
          {
            category: 'S',
            rate: 19,
            base: 29.99,
            amount: 5.7,
            exemptionReason: '',
          },
        ],
      },
    });
    const model = toEn16931(invoice, settings, d);
    expect(model.lines[0].net).toBe(29.99);
  });

  it('builds allowances from 021 mixed discount case', () => {
    const doc = {
      taxMode: 'line',
      taxCalc: 1,
      currency: { fraction: 2 },
      discount: { type: 'percentage', amount: 10 },
      rows: [
        { price: 100, quantity: 1, taxRate: 19, taxCategory: 'S' },
        { price: 50, quantity: 1, taxRate: 7, taxCategory: 'S' },
        {
          price: 30,
          quantity: 1,
          taxRate: 0,
          taxCategory: 'E',
          taxExemptionReason: 'Exempt',
        },
      ],
    };
    const totals = getInvoiceTotals(doc);
    const invoice = {
      invoiceID: 'MIX',
      currency: { code: 'EUR' },
      recipient: { fullname: 'B' },
      rows: doc.rows,
      discount: doc.discount,
      taxMode: 'line',
      taxCalc: 1,
    };
    const model = toEn16931(
      invoice,
      settings,
      derived({
        totals,
        amountPaid: 0,
      })
    );
    expect(model.totals.discount).toBe(18);
    expect(model.allowances.map(a => a.amount).sort((a, b) => a - b)).toEqual([
      3, 5, 10,
    ]);
    expect(model.totals.grandTotal).toBe(182.25);
  });

  it('reverse charge maps AE exemption and buyer VAT', () => {
    const invoice = {
      invoiceID: 'AE1',
      currency: { code: 'EUR' },
      recipient: {
        company: 'AT Co',
        fullname: 'X',
        email: 'x@at.co',
        taxId: 'ATU12345678',
      },
      rows: [
        {
          price: 100,
          quantity: 1,
          taxRate: 0,
          taxCategory: 'AE',
          taxExemptionReason: 'Reverse charge',
        },
      ],
    };
    const model = toEn16931(
      invoice,
      settings,
      derived({
        totals: {
          mode: 'line',
          subtotal: 100,
          discount: 0,
          taxTotal: 0,
          grandTotal: 100,
          lines: [{ net: 100 }],
          taxBreakdown: [
            {
              category: 'AE',
              rate: 0,
              base: 100,
              amount: 0,
              exemptionReason: 'Reverse charge',
            },
          ],
        },
      })
    );
    expect(model.buyer.vatId).toBe('ATU12345678');
    expect(model.vatBreakdown[0].vatexCode).toBe('VATEX-EU-AE');
  });

  it('§19 exempt seller uses tax number only in model', () => {
    const invoice = {
      invoiceID: 'E1',
      currency: { code: 'EUR' },
      recipient: { fullname: 'B', email: 'b@de.de' },
      seller: { taxId: '27/1/1', vatId: '' },
      rows: [
        {
          price: 100,
          quantity: 1,
          taxRate: 0,
          taxCategory: 'E',
          taxExemptionReason: 'Steuerbefreit gemäß § 19 UStG',
        },
      ],
    };
    const model = toEn16931(
      invoice,
      settings,
      derived({
        seller: { taxId: '27/1/1', vatId: '' },
        totals: {
          mode: 'line',
          subtotal: 100,
          discount: 0,
          taxTotal: 0,
          grandTotal: 100,
          lines: [{ net: 100 }],
          taxBreakdown: [
            {
              category: 'E',
              rate: 0,
              base: 100,
              amount: 0,
              exemptionReason: 'Steuerbefreit gemäß § 19 UStG',
            },
          ],
        },
      })
    );
    expect(model.seller.vatId).toBe('');
    expect(model.seller.taxNumber).toBe('27/1/1');
  });

  it('category O drops VAT ids', () => {
    const invoice = {
      invoiceID: 'O1',
      currency: { code: 'EUR' },
      recipient: { fullname: 'B', email: 'b@x.de', taxId: 'DE999' },
      rows: [
        {
          price: 10,
          quantity: 1,
          taxRate: 0,
          taxCategory: 'O',
          taxExemptionReason: 'Out',
        },
      ],
    };
    const model = toEn16931(
      invoice,
      settings,
      derived({
        totals: {
          mode: 'line',
          subtotal: 10,
          discount: 0,
          taxTotal: 0,
          grandTotal: 10,
          lines: [{ net: 10 }],
          taxBreakdown: [
            {
              category: 'O',
              rate: 0,
              base: 10,
              amount: 0,
              exemptionReason: 'Out',
            },
          ],
        },
      })
    );
    expect(model.seller.vatId).toBe('');
    expect(model.buyer.vatId).toBe('');
  });

  it('credit note drops due date and sets preceding', () => {
    const invoice = {
      invoiceID: 'CN-1',
      docType: 'creditNote',
      currency: { code: 'EUR' },
      recipient: { fullname: 'B', email: 'b@x.de' },
      rows: [{ price: 50, quantity: 1, taxRate: 19, taxCategory: 'S' }],
    };
    const model = toEn16931(
      invoice,
      settings,
      derived({
        docType: 'creditNote',
        dueAt: Date.parse('2026-04-10'),
        preceding: { number: 'INV-7', issuedAt: Date.parse('2025-12-01') },
        totals: {
          mode: 'line',
          subtotal: 50,
          discount: 0,
          taxTotal: 9.5,
          grandTotal: 59.5,
          lines: [{ net: 50 }],
          taxBreakdown: [
            {
              category: 'S',
              rate: 19,
              base: 50,
              amount: 9.5,
              exemptionReason: '',
            },
          ],
        },
      })
    );
    expect(model.typeCode).toBe('381');
    expect(model.dueDate).toBeUndefined();
    expect(model.preceding.number).toBe('INV-7');
  });

  it('buyer contact name only when company set', () => {
    const invoice = {
      invoiceID: 'B1',
      currency: { code: 'EUR' },
      recipient: { company: 'Co', fullname: 'Person', email: 'p@co.de' },
      rows: [{ price: 1, quantity: 1, taxRate: 19, taxCategory: 'S' }],
    };
    const model = toEn16931(invoice, settings, derived());
    expect(model.buyer.contactName).toBe('Person');
  });
});

describe('toEn16931 buyer reference setting', () => {
  const invoice = {
    invoiceID: 'X',
    currency: { code: 'EUR' },
    recipient: { fullname: 'B', buyerReference: '04011000-1234512345-06' },
    rows: [{ price: 100, quantity: 1, taxCategory: 'S', taxRate: 19 }],
  };

  it('keeps the buyer reference when the switch is missing', () => {
    const model = toEn16931(
      invoice,
      { profile, invoice: { eInvoice: { enabled: true } } },
      derived()
    );
    expect(model.buyerReference).toBe('04011000-1234512345-06');
    expect(model.buyerReferenceOff).toBe(false);
  });

  it('drops the buyer reference when the switch is off', () => {
    const model = toEn16931(
      invoice,
      {
        profile,
        invoice: { eInvoice: { enabled: true }, useBuyerReference: false },
      },
      derived()
    );
    expect(model.buyerReference).toBe('');
    expect(model.buyerReferenceOff).toBe(true);
  });
});
