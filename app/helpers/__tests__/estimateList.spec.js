import { describe, expect, it } from 'vitest';

import { buildLinkIndex } from '../estimate';
import {
  countByEstimateTab,
  matchesEstimateTab,
  matchesSearch,
  toEstimateRow,
} from '../estimateList';

describe('estimateList', () => {
  const now = Date.UTC(2026, 0, 15);

  it('matchesEstimateTab for every tab', () => {
    for (const tab of [
      'all',
      'draft',
      'sent',
      'accepted',
      'declined',
      'expired',
      'converted',
    ]) {
      expect(matchesEstimateTab('sent', tab)).toBe(
        tab === 'all' || tab === 'sent'
      );
    }
  });

  it('countByEstimateTab sums', () => {
    const rows = [
      { displayStatus: 'draft' },
      { displayStatus: 'sent' },
      { displayStatus: 'sent' },
    ];
    const counts = countByEstimateTab(rows);
    expect(counts.all).toBe(3);
    expect(counts.sent).toBe(2);
    expect(counts.draft).toBe(1);
  });

  it('toEstimateRow sets conversion fields', () => {
    const est = {
      _id: 'e1',
      docType: 'estimate',
      status: 'accepted',
      invoiceID: 'EST-1',
      recipient: { fullname: 'Ada' },
      grandTotal: 10,
      currency: {
        code: 'USD',
        fraction: 2,
        placement: 'before',
        separator: 'commaDot',
      },
    };
    const inv = {
      _id: 'i1',
      docType: 'invoice',
      sourceEstimateId: 'e1',
    };
    const index = buildLinkIndex([est, inv]);
    const row = toEstimateRow(est, now, index);
    expect(row.convertedInvoice).toEqual(inv);
    expect(row.canConvert).toBe(false);
  });

  it('matchesSearch finds estimate by client and amount', () => {
    const row = {
      invoice: { recipient: { fullname: 'Zara' }, grandTotal: 42 },
      number: 'EST-9',
      amountText: 'USD 42.00',
    };
    expect(matchesSearch(row, 'zara')).toBe(true);
    expect(matchesSearch(row, '42')).toBe(true);
  });
});
