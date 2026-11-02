import { describe, it, expect, vi } from 'vitest';
import {
  updateRowField,
  parseNumberInput,
  getFormErrors,
  getInvoiceData,
  resolveSaveStatus,
  validateCurrency,
  validateTax,
  pickInvoiceFields,
  resolveSellerForSave,
  isBlankRow,
} from '../form';
import { getAmountPaid, getInvoiceTotals } from '../invoice';
vi.mock('@/lib/dialog', () => ({ alert: vi.fn() }));
const currency = { code: 'USD', fraction: 2, separator: 'commaDot' };
const form = () => ({
  invoiceID: 'INV-0001',
  issuedAt: null,
  recipient: {
    newRecipient: true,
    new: { fullname: 'Jane', email: 'jane@example.com' },
    select: {},
  },
  rows: [
    { id: '1', description: 'Work', price: 10, quantity: 2, subtotal: 20 },
  ],
  dueDate: { useCustom: true, selectedDate: null },
  currency,
  discount: {},
  tax: {},
  note: {},
  settings: { editMode: { active: false }, required_fields: {} },
});
describe('form helpers', () => {
  it('updates row totals and handles empty values', () => {
    expect(
      updateRowField({ price: 3, quantity: 2 }, 'price', '4').subtotal
    ).toBe(8);
    expect(
      updateRowField({ price: 3, quantity: 2 }, 'price', '').subtotal
    ).toBe('');
  });
  it('parses finite numbers and integers', () => {
    expect(parseNumberInput('2.5')).toBe(2.5);
    expect(parseNumberInput('2.5', { integer: true })).toBe('');
    expect(parseNumberInput('Infinity')).toBe('');
  });
  it('keeps unitCode when saving invoice rows', () => {
    const f = form();
    f.rows[0].unitCode = 'HUR';
    const data = pickInvoiceFields(f, currency);
    expect(data.rows[0].unitCode).toBe('HUR');
  });
  it('treats unit-only rows as blank', () => {
    expect(isBlankRow({ id: 'x', unitCode: 'HUR' })).toBe(true);
    expect(
      pickInvoiceFields(
        {
          ...form(),
          rows: [{ id: 'x', unitCode: 'HUR' }],
        },
        currency
      ).rows
    ).toEqual([]);
  });
  it('validates final invoices and ignores blank rows', () => {
    const f = form();
    f.rows.push({ id: 'blank', description: '', price: '', quantity: '' });
    expect(getFormErrors(f, 'final')).toEqual({});
    f.invoiceID = '';
    f.rows = [];
    expect(getFormErrors(f, 'final')).toMatchObject({
      invoiceID: expect.any(String),
      rows: expect.any(String),
    });
    f.settings.editMode = { active: true, data: {} };
    expect(getFormErrors(f, 'final')).not.toHaveProperty('invoiceID');
  });
  it('template mode ignores invoiceID and validates offsetDays', () => {
    const f = form();
    f.templateTarget = { profileId: 'prof' };
    f.invoiceID = '';
    f.settings.required_fields = {
      ...f.settings.required_fields,
      dueDate: true,
    };
    expect(getFormErrors(f, 'template')).not.toHaveProperty('invoiceID');
    f.dueDate = { useCustom: true, selectedDate: null, offsetDays: 400 };
    expect(getFormErrors(f, 'template')).toMatchObject({
      offsetDays: expect.any(String),
    });
  });
  it('allows drafts with recipient or item but rejects empty drafts', () => {
    const f = form();
    f.rows = [];
    f.recipient.new.email = 'bad';
    expect(getFormErrors(f, 'draft')).toEqual({});
    f.recipient.new = {};
    expect(getFormErrors(f, 'draft')).toHaveProperty('draftEmpty');
    f.rows = [{ id: 'a', description: 'Work' }];
    expect(getFormErrors(f, 'draft')).toEqual({});
  });
  it('saves issue date, invoice number, numeric totals and omits blank rows', () => {
    const f = form();
    f.rows.push({ id: 'b', description: '', price: '', quantity: '' });
    const data = getInvoiceData(f, { now: 123, defaultCurrency: currency });
    expect(data).toMatchObject({
      invoiceID: 'INV-0001',
      issuedAt: 123,
      subtotal: 20,
      grandTotal: 20,
    });
    expect(data.rows).toHaveLength(1);
    f.issuedAt = 100;
    expect(
      getInvoiceData(f, { now: 123, defaultCurrency: currency }).issuedAt
    ).toBe(100);
  });
  it('preserves an old edit date and resolves statuses', () => {
    const f = form();
    f.settings.editMode = {
      active: true,
      data: { created_at: 42, status: 'paid' },
    };
    expect(getInvoiceData(f, { defaultCurrency: currency }).issuedAt).toBe(42);
    expect(resolveSaveStatus('draft')).toBe('draft');
    expect(resolveSaveStatus('final')).toBe('pending');
    expect(resolveSaveStatus('final', { status: 'draft' })).toBe('pending');
    expect(resolveSaveStatus('final', { status: 'paid' })).toBe('paid');
    expect(resolveSaveStatus('draft', null, 'creditNote')).toBe('draft');
    expect(resolveSaveStatus('final', null, 'creditNote')).toBe('issued');
  });
  it('pickInvoiceFields keeps credit link and drops due date', () => {
    const f = form();
    f.docType = 'creditNote';
    f.creditedInvoiceId = 'inv-1';
    f.creditedInvoice = { invoiceID: 'INV-1', issuedAt: 1 };
    f.settings.required_fields.dueDate = true;
    const picked = pickInvoiceFields(f, currency);
    expect(picked.creditedInvoiceId).toBe('inv-1');
    expect(picked.creditedInvoice).toEqual(f.creditedInvoice);
    expect(picked.dueDate).toBeUndefined();
  });
  it('unchanged invoice edit stays paid when issued credits cover balance', () => {
    const linked = [
      {
        _id: 'cn-1',
        docType: 'creditNote',
        status: 'issued',
        creditedInvoiceId: 'inv-paid',
        grandTotal: 60,
        currency,
      },
    ];
    const f = form();
    f.settings.editMode = {
      active: true,
      data: {
        _id: 'inv-paid',
        status: 'paid',
        grandTotal: 100,
        currency,
        payments: [{ id: 'p1', date: 1, amount: 40, method: 'cash', note: '' }],
        rows: f.rows,
        recipient: { fullname: 'Jane', email: 'jane@example.com' },
      },
    };
    const doc = getInvoiceData(f, {
      defaultCurrency: currency,
      linkedCreditNotes: linked,
    });
    expect(doc.status).toBe('paid');
    expect(getAmountPaid(doc)).toBe(40);
  });
  it('resolveSellerForSave keeps credit note seller snapshot on draft edit', () => {
    const seller = { taxId: 'SNAP-1', vatId: 'VAT-1' };
    const f = form();
    f.docType = 'creditNote';
    f.seller = seller;
    f.settings.editMode = {
      active: true,
      data: { status: 'draft', seller },
    };
    expect(resolveSellerForSave(f, { taxId: 'NEW' }, { taxRates: [] })).toEqual(
      seller
    );
  });
  it('resolveSellerForSave snapshots profile on final credit note without seller', () => {
    const f = form();
    f.docType = 'creditNote';
    f.settings.editMode = { active: true, data: { status: 'draft' } };
    const profile = { fullname: 'Seller', taxId: 'T-1', address: 'Street' };
    const settings = { tax: { tin: '' } };
    expect(resolveSellerForSave(f, profile, settings, 'final')).toMatchObject({
      taxId: 'T-1',
      address: 'Street',
      version: 1,
    });
    expect(resolveSellerForSave(f, profile, settings, 'draft')).toBeUndefined();
  });
  it('keeps settings validators boolean', () => {
    expect(validateTax(false, {})).toBe(true);
    expect(validateCurrency(true, currency)).toBe(true);
    expect(validateCurrency(true, { fraction: -1 })).toBe(false);
    expect(validateCurrency(true, { fraction: 101 })).toBe(false);
  });
  it('draft omits incomplete discount and keeps totals finite', () => {
    const f = form();
    f.settings.required_fields.discount = true;
    expect(getFormErrors(f, 'draft')).toEqual({});
    expect(
      Number.isFinite(
        getInvoiceData(f, { mode: 'draft', defaultCurrency: currency })
          .grandTotal
      )
    ).toBe(true);
  });
  it('draft rejects invalid currency fraction and issue date', () => {
    const f = form();
    f.settings.required_fields.currency = true;
    f.currency = { ...currency, fraction: 101 };
    expect(getFormErrors(f, 'draft')).toHaveProperty('currency.fraction');
    f.currency = currency;
    f.issuedAt = Infinity;
    expect(getFormErrors(f, 'draft')).toHaveProperty('issuedAt');
  });
  it('final rejects row multiplication overflow', () => {
    const f = form();
    f.rows = [
      updateRowField(
        { id: '1', description: 'Work', quantity: 2 },
        'price',
        '1e308'
      ),
    ];
    expect(Object.keys(getFormErrors(f, 'final')).length).toBeGreaterThan(0);
  });
  it('reuses saved recipient ids in edit mode for new clients', () => {
    const f = form();
    const recipientId = 'contact-abc';
    f.settings.editMode = {
      active: true,
      data: {
        _id: 'inv-1',
        recipient: {
          _id: recipientId,
          created_at: 99,
          fullname: 'Jane',
          email: 'jane@example.com',
        },
      },
    };
    const first = getInvoiceData(f, { defaultCurrency: currency });
    const second = getInvoiceData(f, { defaultCurrency: currency });
    expect(first.recipient._id).toBe(recipientId);
    expect(second.recipient._id).toBe(recipientId);
    expect(first.recipient.created_at).toBe(99);
  });
  it('keeps paidAt from edit data when editing', () => {
    const f = form();
    f.settings.editMode = {
      active: true,
      data: {
        _id: 'old',
        _rev: '1-x',
        status: 'paid',
        paidAt: 12345,
        rows: [{ description: 'x', price: 1, quantity: 1, subtotal: 1 }],
      },
    };
    const doc = getInvoiceData(f, { defaultCurrency: currency });
    expect(doc.paidAt).toBe(12345);
  });
  it('keeps payments from edit data when editing', () => {
    const f = form();
    f.settings.editMode = {
      active: true,
      data: {
        _id: 'old',
        _rev: '1-x',
        status: 'pending',
        payments: [{ id: 'p', date: 1, amount: 10, method: 'cash' }],
        rows: [{ description: 'x', price: 1, quantity: 1, subtotal: 1 }],
      },
    };
    const doc = getInvoiceData(f, { defaultCurrency: currency });
    expect(doc.payments).toHaveLength(1);
  });
  it('reopens a paid invoice with payments when the total rises', () => {
    const f = form();
    f.settings.editMode = {
      active: true,
      data: {
        _id: 'old',
        _rev: '1-x',
        status: 'paid',
        paidAt: 999,
        grandTotal: 100,
        currency,
        payments: [{ id: 'p', date: 1, amount: 100, method: 'cash', note: '' }],
        rows: [{ description: 'x', price: 100, quantity: 1, subtotal: 100 }],
      },
    };
    f.rows = [
      { id: '1', description: 'Work', price: 15, quantity: 10, subtotal: 150 },
    ];
    const doc = getInvoiceData(f, { defaultCurrency: currency });
    expect(doc.status).toBe('pending');
    expect(doc.paidAt).toBeUndefined();
  });
  it('new invoice omits payments key', () => {
    const doc = getInvoiceData(form(), { defaultCurrency: currency });
    expect(doc).not.toHaveProperty('payments');
  });
  it('omits cleared draft adjustments when editing', () => {
    const f = form();
    f.settings.required_fields = { currency: true, discount: true, tax: true };
    f.settings.editMode = {
      active: true,
      data: {
        _id: 'old',
        _rev: '1-x',
        status: 'draft',
        discount: { type: 'flat', amount: 5 },
        tax: { method: 'default', amount: 10 },
      },
    };
    f.discount = { type: 'flat', amount: '' };
    f.tax = { method: 'default', amount: '' };
    const doc = getInvoiceData(f, { mode: 'draft', defaultCurrency: currency });
    expect(doc).not.toHaveProperty('discount');
    expect(doc).not.toHaveProperty('tax');
  });
  it('validates the live default currency when the field is off', () => {
    const f = form();
    f.settings.required_fields.currency = false;
    window.manta.settings.get.mockImplementation(key =>
      key === 'invoice.currency' ? { ...currency, fraction: 101 } : {}
    );
    expect(getFormErrors(f, 'draft')).toHaveProperty('currency.fraction');
    window.manta.settings.get.mockReset();
  });
  it.each([
    [
      'recipient.fullname',
      f => {
        f.recipient.new.fullname = '';
      },
    ],
    [
      'recipient.email',
      f => {
        f.recipient.new.email = 'bad';
      },
    ],
    [
      'recipient',
      f => {
        f.recipient.newRecipient = false;
      },
    ],
    [
      'rows.1.description',
      f => {
        f.rows[0].description = '';
      },
    ],
    [
      'rows.1.price',
      f => {
        f.rows[0].price = 0;
      },
    ],
    [
      'rows.1.quantity',
      f => {
        f.rows[0].quantity = 0;
      },
    ],
    [
      'dueDate',
      f => {
        f.settings.required_fields.dueDate = true;
      },
    ],
    [
      'currency.fraction',
      f => {
        f.settings.required_fields.currency = true;
        f.currency = { fraction: -1 };
      },
    ],
    [
      'discount',
      f => {
        f.settings.required_fields.discount = true;
      },
    ],
    [
      'tax',
      f => {
        f.settings.required_fields.tax = true;
      },
    ],
    [
      'note',
      f => {
        f.settings.required_fields.note = true;
      },
    ],
    [
      'issuedAt',
      f => {
        f.issuedAt = NaN;
      },
    ],
  ])('reports final validation error at %s', (path, mutate) => {
    const f = form();
    mutate(f);
    expect(getFormErrors(f, 'final')[path]).toEqual(expect.any(String));
  });

  const lineRow = {
    id: 'r1',
    description: 'Work',
    price: 100,
    quantity: 1,
    subtotal: 100,
    taxRateId: 'vat19',
    taxRate: 19,
    taxCategory: 'S',
    taxExemptionReason: '',
  };

  it('preserves line tax snapshots when saving an edited line invoice', () => {
    const f = form();
    f.taxMode = 'line';
    f.settings.required_fields.tax = true;
    f.rows = [{ ...lineRow }];
    f.settings.editMode = {
      active: true,
      data: {
        _id: 'inv-line',
        status: 'pending',
        taxMode: 'line',
        taxCalc: 1,
        rows: [{ ...lineRow }],
      },
    };
    const doc = getInvoiceData(f, { defaultCurrency: currency });
    expect(doc.rows[0].taxRate).toBe(19);
    expect(doc.rows[0].taxCategory).toBe('S');
    expect(getInvoiceTotals(doc).grandTotal).toBe(119);
  });

  it('clears line tax snapshots when tax is off on save', () => {
    const f = form();
    f.taxMode = 'line';
    f.settings.required_fields.tax = false;
    f.rows = [{ ...lineRow }];
    const doc = getInvoiceData(f, { defaultCurrency: currency });
    expect(doc.rows[0].taxRateId).toBeUndefined();
    expect(doc.rows[0].taxRate).toBeUndefined();
  });

  it('line mode rejects missing tax category on final save', () => {
    const f = form();
    f.taxMode = 'line';
    f.settings.required_fields.tax = true;
    f.rows = [
      {
        id: '1',
        description: 'Work',
        price: 10,
        quantity: 1,
        subtotal: 10,
        taxRate: 0,
      },
    ];
    expect(getFormErrors(f, 'final')['rows.1.taxCategory']).toEqual(
      expect.any(String)
    );
    expect(getFormErrors(f, 'draft')).not.toHaveProperty('rows.1.taxCategory');
  });

  it('line mode rejects invalid tax category on final save', () => {
    const f = form();
    f.taxMode = 'line';
    f.settings.required_fields.tax = true;
    f.rows = [
      {
        id: '1',
        description: 'Work',
        price: 10,
        quantity: 1,
        subtotal: 10,
        taxRate: 0,
        taxCategory: 'INVALID',
      },
    ];
    expect(getFormErrors(f, 'final')['rows.1.taxCategory']).toEqual(
      expect.any(String)
    );
  });
});
