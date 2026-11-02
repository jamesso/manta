import {
  DEFAULT_NUMBERING,
  normalizeNumbering,
  resolveStoredNumbering,
} from './numbering';

let writeChain = Promise.resolve();

export function runInvoiceNumberingWrite(task) {
  const next = writeChain.then(task, task);
  writeChain = next.catch(() => {});
  return next;
}

export function readInvoiceNumberingCounter(
  settingsStore,
  reconciledNumbering
) {
  return normalizeNumbering(
    resolveStoredNumbering(
      reconciledNumbering,
      settingsStore.get('invoice.numbering')
    ),
    DEFAULT_NUMBERING
  );
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
    if (dispatch && actionTypes?.FORM_CLEAR_RECONCILED_NUMBERING) {
      dispatch({ type: actionTypes.FORM_CLEAR_RECONCILED_NUMBERING });
    }
    return { ok: true };
  } catch {
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
