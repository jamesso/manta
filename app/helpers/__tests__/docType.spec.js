import { describe, expect, it } from 'vitest';

import {
  DOC_TYPES,
  getDocTitleKey,
  getDocType,
  isEstimate,
  isInvoice,
  listTabFor,
  onlyEstimates,
  onlyInvoices,
} from '../docType';

describe('docType', () => {
  it('getDocType treats missing, null and empty as invoice', () => {
    expect(getDocType({})).toBe('invoice');
    expect(getDocType({ docType: null })).toBe('invoice');
    expect(getDocType({ docType: '' })).toBe('invoice');
  });

  it('getDocType returns estimate and creditNote unchanged', () => {
    expect(getDocType({ docType: 'estimate' })).toBe('estimate');
    expect(getDocType({ docType: 'creditNote' })).toBe('creditNote');
  });

  it('getDocType returns unsupported values unchanged', () => {
    expect(getDocType({ docType: 'foo' })).toBe('foo');
    expect(getDocType({ docType: 0 })).toBe(0);
    expect(getDocType({ docType: false })).toBe(false);
    expect(getDocType({ docType: [] })).toEqual([]);
    expect(getDocType({ docType: {} })).toEqual({});
  });

  it('isInvoice and isEstimate', () => {
    expect(isInvoice({})).toBe(true);
    expect(isInvoice({ docType: 'estimate' })).toBe(false);
    expect(isInvoice({ docType: 0 })).toBe(false);
    expect(isEstimate({ docType: 'estimate' })).toBe(true);
  });

  it('onlyInvoices filters mixed list', () => {
    const docs = [
      { _id: '1' },
      { _id: '2', docType: 'estimate' },
      { _id: '3', docType: 'foo' },
    ];
    expect(onlyInvoices(docs).map(d => d._id)).toEqual(['1']);
  });

  it('onlyEstimates', () => {
    const docs = [{ _id: '1' }, { _id: '2', docType: 'estimate' }];
    expect(onlyEstimates(docs).map(d => d._id)).toEqual(['2']);
  });

  it('getDocTitleKey and listTabFor', () => {
    expect(getDocTitleKey({ docType: 'estimate' })).toBe(
      'preview:common:estimate'
    );
    expect(getDocTitleKey({ docType: 'creditNote' })).toBe(
      'preview:common:creditNote'
    );
    expect(getDocTitleKey({})).toBe('preview:common:invoice');
    expect(getDocTitleKey({ docType: 'foo' })).toBe(null);
    expect(listTabFor('estimate')).toBe('estimates');
    expect(listTabFor('invoice')).toBe('invoices');
  });

  it('DOC_TYPES includes creditNote', () => {
    expect(DOC_TYPES).toContain('creditNote');
  });
});
