import moment from 'moment';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildLinkIndex,
  canConvert,
  estimateToInvoiceDraft,
  findConvertedInvoice,
  getDefaultValidUntil,
  getEstimateDisplayStatus,
  getEstimateStoredStatus,
  getValidInDays,
  isInvoiceDeleteUndoable,
  isSettableStatus,
  markInvoiceDeletedForUndo,
  normalizeValidDays,
  withConversion,
} from '../estimate';

describe('estimate helpers', () => {
  describe('getEstimateDisplayStatus', () => {
    const past = Date.UTC(2026, 0, 1);
    const todayStart = moment(Date.UTC(2026, 0, 15))
      .startOf('day')
      .valueOf();
    const todayLate = Date.UTC(2026, 0, 15, 23, 59);

    it('expires draft and sent when validUntil is before today', () => {
      expect(
        getEstimateDisplayStatus(
          { status: 'draft', validUntil: past },
          todayStart
        )
      ).toBe('expired');
      expect(
        getEstimateDisplayStatus(
          { status: 'sent', validUntil: past },
          todayStart
        )
      ).toBe('expired');
    });

    it('valid until today is not expired', () => {
      expect(
        getEstimateDisplayStatus(
          { status: 'sent', validUntil: todayStart },
          todayLate
        )
      ).toBe('sent');
    });

    it('accepted, declined, converted ignore expiry', () => {
      expect(
        getEstimateDisplayStatus(
          { status: 'accepted', validUntil: past },
          todayStart
        )
      ).toBe('accepted');
    });

    it('no validUntil never expires', () => {
      expect(getEstimateDisplayStatus({ status: 'sent' }, todayStart)).toBe(
        'sent'
      );
    });

    it('unknown status becomes draft', () => {
      expect(getEstimateDisplayStatus({ status: 'weird' }, todayStart)).toBe(
        'draft'
      );
    });
  });

  it('getDefaultValidUntil and normalizeValidDays', () => {
    const issued = Date.UTC(2026, 0, 15, 10);
    expect(getDefaultValidUntil(issued, 30)).toBe(Date.UTC(2026, 1, 14));
    expect(normalizeValidDays(0)).toBe(30);
    expect(normalizeValidDays('x')).toBe(30);
    expect(normalizeValidDays(400)).toBe(30);
  });

  it('estimateToInvoiceDraft', () => {
    const e = {
      _id: 'est1',
      _rev: '1-a',
      docType: 'estimate',
      status: 'sent',
      validUntil: 1,
      invoiceID: 'EST-1',
      issuedAt: 2,
      created_at: 3,
      dueDate: {},
      payments: [],
      recipient: { fullname: 'A' },
      rows: [{ id: 'r', subtotal: 10 }],
      currency: { code: 'USD' },
      discount: { amount: 1 },
      tax: { amount: 1 },
      note: 'n',
      configs: { x: 1 },
      taxMode: 'line',
      taxCalc: 1,
    };
    const draft = estimateToInvoiceDraft(e);
    expect(draft.docType).toBe('invoice');
    expect(draft.sourceEstimateId).toBe('est1');
    expect(draft.recipient).toEqual(e.recipient);
    expect(draft.rows).toEqual(e.rows);
    expect(draft).not.toHaveProperty('_id');
    expect(draft).not.toHaveProperty('validUntil');
    expect(draft).not.toHaveProperty('dueDate');
    expect(e.status).toBe('sent');
  });

  it('canConvert', () => {
    const est = { _id: 'e1', docType: 'estimate', status: 'sent' };
    const empty = buildLinkIndex([]);
    expect(canConvert(est, empty)).toBe(true);
    expect(canConvert({ ...est, status: 'declined' }, empty)).toBe(false);
    const inv = {
      _id: 'i1',
      docType: 'invoice',
      sourceEstimateId: 'e1',
    };
    expect(canConvert(est, buildLinkIndex([est, inv]))).toBe(false);
    const converted = {
      ...est,
      status: 'converted',
      convertedInvoiceId: 'gone',
    };
    expect(canConvert(converted, buildLinkIndex([converted]))).toBe(true);
    expect(canConvert({ docType: 'invoice' }, empty)).toBe(false);
  });

  it('blocks reconversion while invoice delete is undoable', () => {
    const est = {
      _id: 'e1',
      docType: 'estimate',
      status: 'converted',
      convertedInvoiceId: 'i1',
    };
    markInvoiceDeletedForUndo('i1');
    expect(isInvoiceDeleteUndoable('i1')).toBe(true);
    expect(canConvert(est, buildLinkIndex([est]))).toBe(false);
  });

  it('withConversion and isSettableStatus', () => {
    const now = 100;
    const next = withConversion({ _id: 'e' }, 'i1', now);
    expect(next.status).toBe('converted');
    expect(next.convertedInvoiceId).toBe('i1');
    expect(next.convertedAt).toBe(now);
    expect(
      isSettableStatus({ docType: 'estimate', status: 'sent' }, 'accepted')
    ).toBe(true);
    expect(
      isSettableStatus({ docType: 'estimate', status: 'converted' }, 'draft')
    ).toBe(false);
    expect(
      isSettableStatus({ docType: 'invoice', status: 'pending' }, 'sent')
    ).toBe(false);
  });

  it('findConvertedInvoice prefers convertedInvoiceId link', () => {
    const est = {
      _id: 'e1',
      docType: 'estimate',
      convertedInvoiceId: 'i1',
    };
    const inv = { _id: 'i1', docType: 'invoice', sourceEstimateId: 'e1' };
    expect(findConvertedInvoice(est, buildLinkIndex([est, inv]))).toEqual(inv);
  });

  describe('America/New_York DST', () => {
    beforeEach(() => {
      vi.stubEnv('TZ', 'America/New_York');
    });
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('expires across DST boundary', () => {
      const validUntil = moment('2026-10-31').startOf('day').valueOf();
      const now = moment('2026-11-01').hour(0).minute(30).valueOf();
      expect(
        getEstimateDisplayStatus({ status: 'sent', validUntil }, now)
      ).toBe('expired');
      expect(getValidInDays({ validUntil }, now)).toBe(-1);
    });
  });
});

describe('getEstimateStoredStatus', () => {
  it('defaults to draft', () => {
    expect(getEstimateStoredStatus({})).toBe('draft');
  });
});
