import moment from 'moment';
import omit from 'lodash/omit';

import { INVOICE_STATUSES } from '../constants/invoices';
import {
  DEFAULT_ESTIMATE_VALID_DAYS,
  ESTIMATE_SETTABLE_STATUSES,
  ESTIMATE_STATUSES,
} from '../constants/estimates';
import { UNDO_TIMEOUT_MS } from '../constants/invoices';
import { getDocType, isEstimate, isInvoice } from './docType';

const undoDeletedInvoiceIds = new Map();
const undoInvoiceMeta = new Map();
const undoSourceEstimateRefCount = new Map();

function decrementSourceUndo(estimateId) {
  if (typeof estimateId !== 'string' || estimateId === '') {
    return;
  }
  const next = (undoSourceEstimateRefCount.get(estimateId) || 0) - 1;
  if (next <= 0) {
    undoSourceEstimateRefCount.delete(estimateId);
  } else {
    undoSourceEstimateRefCount.set(estimateId, next);
  }
}

function incrementSourceUndo(estimateId) {
  undoSourceEstimateRefCount.set(
    estimateId,
    (undoSourceEstimateRefCount.get(estimateId) || 0) + 1
  );
}

export function isSourceEstimateDeleteUndoable(estimateId) {
  return (undoSourceEstimateRefCount.get(estimateId) || 0) > 0;
}

export function markInvoiceDeletedForUndo(invoiceOrId) {
  const doc =
    invoiceOrId != null && typeof invoiceOrId === 'object' ? invoiceOrId : null;
  const invoiceId = doc ? doc._id : invoiceOrId;
  if (typeof invoiceId !== 'string' || invoiceId === '') {
    return;
  }
  clearInvoiceDeletedForUndo(invoiceId);
  const sourceEstimateId =
    doc && typeof doc.sourceEstimateId === 'string'
      ? doc.sourceEstimateId
      : null;
  if (sourceEstimateId) {
    incrementSourceUndo(sourceEstimateId);
  }
  const timer = setTimeout(() => {
    clearInvoiceDeletedForUndo(invoiceId);
  }, UNDO_TIMEOUT_MS);
  undoDeletedInvoiceIds.set(invoiceId, timer);
  undoInvoiceMeta.set(invoiceId, { timer, sourceEstimateId });
}

export function clearInvoiceDeletedForUndo(invoiceOrId) {
  const invoiceId =
    invoiceOrId != null && typeof invoiceOrId === 'object'
      ? invoiceOrId._id
      : invoiceOrId;
  if (typeof invoiceId !== 'string' || invoiceId === '') {
    return;
  }
  const meta = undoInvoiceMeta.get(invoiceId);
  if (!meta) {
    return;
  }
  clearTimeout(meta.timer);
  undoInvoiceMeta.delete(invoiceId);
  undoDeletedInvoiceIds.delete(invoiceId);
  if (meta.sourceEstimateId) {
    decrementSourceUndo(meta.sourceEstimateId);
  }
}

export function isInvoiceDeleteUndoable(invoiceId) {
  return undoDeletedInvoiceIds.has(invoiceId);
}

export function getEstimateStoredStatus(e) {
  const status = e?.status;
  if (ESTIMATE_STATUSES.includes(status)) {
    return status;
  }
  return 'draft';
}

export function getEstimateDisplayStatus(e, now = Date.now()) {
  const stored = getEstimateStoredStatus(e);
  if (stored !== 'draft' && stored !== 'sent') {
    return stored;
  }
  if (e.validUntil == null) {
    return stored;
  }
  const startToday = moment(now).startOf('day').valueOf();
  if (e.validUntil < startToday) {
    return 'expired';
  }
  return stored;
}

export function normalizeValidDays(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 365) {
    return DEFAULT_ESTIMATE_VALID_DAYS;
  }
  return n;
}

export function getDefaultValidUntil(issuedAt, days) {
  return moment(issuedAt)
    .startOf('day')
    .add(normalizeValidDays(days), 'days')
    .valueOf();
}

export function getValidInDays(e, now = Date.now()) {
  if (e.validUntil == null) {
    return null;
  }
  return moment(e.validUntil)
    .startOf('day')
    .diff(moment(now).startOf('day'), 'days');
}

export function buildLinkIndex(docs) {
  const byId = new Map();
  const bySource = new Map();
  for (const doc of docs) {
    if (doc?._id) {
      byId.set(doc._id, doc);
    }
    if (isInvoice(doc) && doc.sourceEstimateId) {
      bySource.set(doc.sourceEstimateId, doc);
    }
  }
  return { byId, bySource };
}

export function findConvertedInvoice(e, index) {
  if (!isEstimate(e)) {
    return null;
  }
  const linked = e.convertedInvoiceId
    ? index.byId.get(e.convertedInvoiceId)
    : null;
  if (linked && isInvoice(linked) && linked.sourceEstimateId === e._id) {
    return linked;
  }
  const bySource = index.bySource.get(e._id);
  if (bySource && isInvoice(bySource)) {
    return bySource;
  }
  return null;
}

export function canConvert(e, index) {
  if (!isEstimate(e)) {
    return false;
  }
  if (getEstimateStoredStatus(e) === 'declined') {
    return false;
  }
  const linked = findConvertedInvoice(e, index);
  if (linked) {
    return false;
  }
  if (
    getEstimateStoredStatus(e) === 'converted' &&
    e.convertedInvoiceId &&
    isInvoiceDeleteUndoable(e.convertedInvoiceId)
  ) {
    return false;
  }
  if (isSourceEstimateDeleteUndoable(e._id)) {
    return false;
  }
  if (index.bySource.has(e._id) && isInvoice(index.bySource.get(e._id))) {
    return false;
  }
  return true;
}

export const ESTIMATE_DRAFT_OMIT = [
  '_id',
  '_rev',
  'docType',
  'status',
  'validUntil',
  'invoiceID',
  'issuedAt',
  'created_at',
  'convertedInvoiceId',
  'convertedAt',
  'sourceEstimateId',
  'payments',
  'paidAt',
  'dueDate',
  'sentAt',
  'remindedAt',
  'cancelledByCredit',
  'recurringTemplateId',
  'recurringOccurrence',
];

export function estimateToInvoiceDraft(e) {
  return {
    ...omit(e, ESTIMATE_DRAFT_OMIT),
    docType: 'invoice',
    sourceEstimateId: e._id,
  };
}

export function withConversion(e, invoiceId, now) {
  return {
    ...e,
    status: 'converted',
    convertedInvoiceId: invoiceId,
    convertedAt: now,
  };
}

export function isSettableStatus(doc, status) {
  const docType = getDocType(doc);
  if (docType === 'estimate') {
    if (getEstimateStoredStatus(doc) === 'converted') {
      return false;
    }
    return ESTIMATE_SETTABLE_STATUSES.includes(status);
  }
  if (docType === 'invoice') {
    return INVOICE_STATUSES.includes(status);
  }
  return false;
}
