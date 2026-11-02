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
});
