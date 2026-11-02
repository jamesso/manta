import { describe, it, expect, vi } from 'vitest';
import {
  updateRowField,
  parseNumberInput,
  getFormErrors,
  getInvoiceData,
  resolveSaveStatus,
  validateCurrency,
  validateTax,
} from '../form';
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
  });
  it('keeps settings validators boolean', () => {
    expect(validateTax(false, {})).toBe(true);
    expect(validateCurrency(true, currency)).toBe(true);
    expect(validateCurrency(true, { fraction: -1 })).toBe(false);
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
});
