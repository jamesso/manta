import { getAllDocs } from './pouchDB';
import {
  DEFAULT_NUMBERING,
  normalizeNumbering,
  reconcileNumberingWithPersistedInvoices,
  resolveStoredNumbering,
} from './numbering';

let writeChain = Promise.resolve();

export function runInvoiceNumberingWrite(task) {
  const next = writeChain.then(task, task);
  writeChain = next.catch(() => {});
  return next;
}

export function clearInvoiceNumberingWriteChainForTests() {
  writeChain = Promise.resolve();
}

const reconciledOverlay = new WeakMap();

export function readInvoiceNumberingCounter(
  settingsStore,
  reconciledNumbering
) {
  const overlay = reconciledOverlay.get(settingsStore);
  return normalizeNumbering(
    resolveStoredNumbering(
      reconciledNumbering ?? overlay,
      settingsStore.get('invoice.numbering')
    ),
    DEFAULT_NUMBERING
  );
}

export async function resolveInvoiceNumberingForAllocation(
  settingsStore,
  reconciledNumbering,
  invoices = null
) {
  const docs = invoices ?? (await getAllDocs('invoices'));
  const base = readInvoiceNumberingCounter(settingsStore, reconciledNumbering);
  return reconcileNumberingWithPersistedInvoices(base, docs);
}

export function numberingCountersEqual(a, b) {
  const left = normalizeNumbering(a, DEFAULT_NUMBERING);
  const right = normalizeNumbering(b, DEFAULT_NUMBERING);
  return (
    left.next === right.next &&
    left.prefix === right.prefix &&
    left.padding === right.padding
  );
}

export async function persistInvoiceNumberingCounter(
  settingsStore,
  numbering,
  { dispatch, actionTypes, i18n }
) {
  const normalized = normalizeNumbering(numbering, DEFAULT_NUMBERING);
  try {
    settingsStore.set('invoice.numbering', normalized);
    reconciledOverlay.delete(settingsStore);
    if (dispatch && actionTypes?.FORM_CLEAR_RECONCILED_NUMBERING) {
      dispatch({ type: actionTypes.FORM_CLEAR_RECONCILED_NUMBERING });
    }
    return { ok: true };
  } catch {
    reconciledOverlay.set(settingsStore, normalized);
    if (dispatch && actionTypes?.FORM_RECONCILE_NUMBERING) {
      dispatch({
        type: actionTypes.FORM_RECONCILE_NUMBERING,
        payload: normalized,
      });
    }
    if (dispatch && actionTypes?.UI_NOTIFICATION_NEW && i18n) {
      dispatch({
        type: actionTypes.UI_NOTIFICATION_NEW,
        payload: {
          type: 'warning',
          message: i18n.t('form:errors:partialNumberingSave'),
        },
      });
    }
    return { ok: false, reconciled: normalized };
  }
}
