import { describe, expect, it } from 'vitest';
import { getFormNavSection } from '../navSection';

describe('getFormNavSection', () => {
  it('marks a new invoice as New invoice', () => {
    expect(getFormNavSection({ docType: 'invoice', editActive: false })).toBe(
      'newInvoice'
    );
  });

  it('marks a recurring template as Recurring, for any doc type', () => {
    expect(
      getFormNavSection({ docType: 'invoice', templateTarget: 'new' })
    ).toBe('recurring');
    expect(
      getFormNavSection({
        docType: 'invoice',
        templateTarget: 'rec-1',
        editActive: true,
      })
    ).toBe('recurring');
  });

  it('marks estimates as Estimates', () => {
    expect(getFormNavSection({ docType: 'estimate', editActive: true })).toBe(
      'estimates'
    );
  });

  it('marks credit notes and edited invoices as Invoices', () => {
    expect(getFormNavSection({ docType: 'creditNote' })).toBe('invoices');
    expect(getFormNavSection({ docType: 'invoice', editActive: true })).toBe(
      'invoices'
    );
  });
});
