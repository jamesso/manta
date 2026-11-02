import { describe, it, expect, vi } from 'vitest';
import { formToPreviewInvoice } from '../preview';
const currency = { code: 'USD', fraction: 2 };
const input = () => ({
  invoiceID: 'INV-0001',
  issuedAt: null,
  recipient: {
    newRecipient: true,
    new: { fullname: 'Jane' },
    select: { _id: 'c', fullname: 'Jo' },
  },
  rows: [
    { id: 'a', description: 'Work', price: '', quantity: '', subtotal: '' },
  ],
  dueDate: {},
  currency: { code: 'EUR' },
  discount: {},
  tax: {},
  note: {},
  settings: { editMode: { active: false }, required_fields: {} },
});
const context = {
  invoiceSettings: { currency, template: 'default' },
  generalSettings: {},
  profile: {},
  now: 123,
};
describe('formToPreviewInvoice', () => {
  it('is deterministic and does not generate IDs', () => {
    const spy = vi.spyOn(crypto, 'randomUUID');
    const f = input();
    expect(formToPreviewInvoice(f, context)).toEqual(
      formToPreviewInvoice(f, context)
    );
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
  it('uses default currency, issue date and numeric totals', () => {
    const result = formToPreviewInvoice(input(), context);
    expect(result.invoice).toMatchObject({
      currency,
      issuedAt: 123,
      grandTotal: 0,
      recipient: { fullname: 'Jane' },
    });
  });
  it('materializes offset due date in template mode', () => {
    const f = input();
    f.templateTarget = { profileId: 'prof' };
    f.settings.required_fields.dueDate = true;
    f.dueDate = {
      useCustom: true,
      selectedDate: null,
      offsetDays: 14,
      paymentTerm: null,
    };
    const { invoice } = formToPreviewInvoice(f, { ...context, now: 1_000_000 });
    expect(invoice.dueDate.useCustom).toBe(true);
    expect(invoice.dueDate.selectedDate).toBeDefined();
    expect(invoice.dueDate.paymentTerm).toBeNull();
  });
  it('uses selected recipient and edited configs', () => {
    const f = input();
    f.recipient.newRecipient = false;
    f.settings.editMode = {
      active: true,
      data: { created_at: 42, configs: { template: 'business' } },
    };
    const result = formToPreviewInvoice(f, context);
    expect(result.invoice.recipient.fullname).toBe('Jo');
    expect(result.invoice.issuedAt).toBe(42);
    expect(result.configs).toEqual({ template: 'business' });
  });
  it('passes payments in edit mode', () => {
    const f = input();
    f.settings.editMode = {
      active: true,
      data: {
        payments: [{ id: 'p', date: 1, amount: 5, method: 'cash' }],
      },
    };
    expect(formToPreviewInvoice(f, context).invoice.payments).toHaveLength(1);
  });

  it('does not invent seller on issued invoice-level edit without seller', () => {
    const f = input();
    f.settings.editMode = {
      active: true,
      data: {
        status: 'pending',
        created_at: 1000,
        tax: { tin: 'OLD-ID', amount: 19, method: 'default' },
      },
    };
    f.tax = { tin: 'OLD-ID', amount: 19, method: 'default' };
    f.taxMode = 'invoice';
    f.settings.required_fields.tax = true;
    const result = formToPreviewInvoice(f, {
      ...context,
      profile: { taxId: 'NEW-ID', vatId: 'NEW-VAT' },
    });
    expect(result.invoice.seller).toBeUndefined();
  });

  it('keeps saved seller on issued edit', () => {
    const f = input();
    f.settings.editMode = {
      active: true,
      data: {
        status: 'pending',
        seller: { taxId: 'SAVED', vatId: 'SAVED-VAT' },
      },
    };
    const result = formToPreviewInvoice(f, {
      ...context,
      profile: { taxId: 'NEW-ID', vatId: 'NEW-VAT' },
    });
    expect(result.invoice.seller).toEqual({
      taxId: 'SAVED',
      vatId: 'SAVED-VAT',
    });
  });

  it('uses profile seller ids for draft edit', () => {
    const f = input();
    f.settings.editMode = {
      active: true,
      data: { status: 'draft' },
    };
    const result = formToPreviewInvoice(f, {
      ...context,
      profile: { taxId: 'DRAFT-TAX', vatId: 'DRAFT-VAT' },
    });
    expect(result.invoice.seller).toEqual({
      taxId: 'DRAFT-TAX',
      vatId: 'DRAFT-VAT',
    });
  });

  it('uses profile seller ids for new documents', () => {
    const result = formToPreviewInvoice(input(), {
      ...context,
      profile: { taxId: 'NEW-TAX', vatId: 'NEW-VAT' },
      invoiceSettings: {
        ...context.invoiceSettings,
        tax: { tin: 'legacy', amount: 19, method: 'default' },
      },
    });
    expect(result.invoice.seller).toEqual({
      taxId: 'NEW-TAX',
      vatId: 'NEW-VAT',
    });
  });
});
