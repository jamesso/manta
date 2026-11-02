// Node Libs
import currencies from '../../libs/currencies.json';
const ipc = window.manta.ipc;
import i18n from '../../i18n/i18n';
import { omit } from 'lodash';

// Actions & Verbs
import * as ACTION_TYPES from '../constants/actions.jsx';
import * as UIActions from '../actions/ui';
import * as FormActions from '../actions/form';
import * as Actions from '../actions/invoices';

// Helpers
import { INVOICE_STATUSES, UNDO_TIMEOUT_MS } from '../constants/invoices';
import { ESTIMATE_SETTABLE_STATUSES } from '../constants/estimates';
import {
  buildLinkIndex,
  canConvert,
  estimateToInvoiceDraft,
  isSettableStatus,
  withConversion,
  markInvoiceDeletedForUndo,
  clearInvoiceDeletedForUndo,
} from '../helpers/estimate';
import { isEstimate, isInvoice } from '../helpers/docType';
import { getInvoiceNumber } from '../helpers/invoice';
import {
  addPaymentToDoc,
  removePaymentFromDoc,
  setDocStatus,
  startOfDay,
} from '../helpers/payments';
import { hasUnsavedFormChanges } from '../helpers/form';
import * as dialog from '@/lib/dialog';
import {
  getAllDocs,
  getSingleDoc,
  saveDoc,
  updateDoc,
  removeDocs,
  restoreDocs,
  updateDocs,
} from '../helpers/pouchDB';
import { toast } from '@/components/ui/toast';
import {
  isImportWriteLocked,
  importWriteLockReason,
  trackImportWriteStart,
} from '../helpers/importWriteLock';

function warnImportBlocked(dispatch) {
  if (!isImportWriteLocked()) {
    return false;
  }
  dispatch({
    type: ACTION_TYPES.UI_NOTIFICATION_NEW,
    payload: {
      type: 'warning',
      message: i18n.t(importWriteLockReason()),
    },
  });
  return true;
}

function protectWrite(dispatch) {
  const endWrite = trackImportWriteStart();
  if (endWrite) {
    return endWrite;
  }
  warnImportBlocked(dispatch);
  return null;
}

function persistedInvoice(docs, payload) {
  if (!Array.isArray(docs) || !docs.length) {
    return payload;
  }
  if (payload?._id) {
    const match = docs.find(doc => doc._id === payload._id);
    if (match) {
      return match;
    }
  }
  return payload;
}

const paymentQueues = new Map();
let invoiceListRefresh = Promise.resolve();

function runPaymentQueued(invoiceId, fn) {
  const prev = paymentQueues.get(invoiceId) || Promise.resolve();
  const next = prev.then(fn, fn).finally(() => {
    if (paymentQueues.get(invoiceId) === next) {
      paymentQueues.delete(invoiceId);
    }
  });
  paymentQueues.set(invoiceId, next);
  return next;
}

function paymentErrorMessage(errorKey) {
  return i18n.t(`invoices:payments:errors:${errorKey}`, {
    defaultValue: errorKey,
  });
}

function syncEditMode(dispatch, getState, allDocs, ids) {
  const { editMode } = getState().form.settings;
  if (!editMode.active) {
    return;
  }
  const idSet = new Set([].concat(ids));
  if (!idSet.has(editMode.data._id)) {
    return;
  }
  const fresh = allDocs.find(d => d._id === editMode.data._id);
  if (fresh) {
    dispatch({
      type: ACTION_TYPES.FORM_EDIT_DATA_SYNC,
      payload: fresh,
    });
  }
}

function publishInvoiceDocs(next, allDocs) {
  if (allDocs) {
    next({
      type: ACTION_TYPES.INVOICE_UPDATE,
      payload: allDocs,
    });
  }
}

function finalizeQueuedWrites({ results, next, dispatch, getState }) {
  const committed = results.filter(r => r.committed);
  const failed = results.filter(r => !r.ok);
  const needsListRefresh = results.some(r => r.committed || r.allDocs);

  if (!needsListRefresh) {
    return Promise.resolve({ committed, failed, allDocs: null });
  }

  const refresh = () =>
    getAllDocs('invoices')
      .then(allDocs => {
        publishInvoiceDocs(next, allDocs);
        if (committed.length) {
          syncEditMode(
            dispatch,
            getState,
            allDocs,
            committed.map(r => r.id)
          );
        }
        return { committed, failed, allDocs };
      })
      .catch(err => {
        toast.add({
          title: err.message,
          type: 'warning',
        });
        return { committed, failed, allDocs: null };
      });

  const chained = invoiceListRefresh.then(refresh, refresh);
  invoiceListRefresh = chained;
  return chained;
}

function queuedInvoiceWrite(invoiceId, mutate) {
  return runPaymentQueued(invoiceId, () =>
    getSingleDoc('invoices', invoiceId)
      .then(doc => {
        const result = mutate(doc);
        if (!result.ok) {
          return {
            id: invoiceId,
            ok: false,
            committed: false,
            error: result.error,
            payment: result.payment,
            stillPaid: result.stillPaid,
          };
        }
        return updateDocs('invoices', [result.doc])
          .then(allDocs => ({
            id: invoiceId,
            ok: true,
            committed: true,
            allDocs,
            doc: result.doc,
            payment: result.payment,
            stillPaid: result.stillPaid,
          }))
          .catch(err => ({
            id: invoiceId,
            ok: false,
            committed: false,
            error: 'writeFailed',
            allDocs: err.docs,
            writeErr: err,
          }));
      })
      .catch(() => ({
        id: invoiceId,
        ok: false,
        committed: false,
        error: 'notFound',
      }))
  );
}

const InvoicesMW =
  ({ dispatch, getState }) =>
  next =>
  action => {
    switch (action.type) {
      case ACTION_TYPES.INVOICE_NEW_FROM_CONTACT: {
        if (warnImportBlocked(dispatch)) {
          break;
        }
        const apply = () => {
          if (getState().form.settings.editMode.active) {
            dispatch(FormActions.clearForm(null, true));
          }
          next(UIActions.changeActiveTab('form'));
          dispatch(
            FormActions.updateRecipient({
              new: {},
              select: action.payload,
              newRecipient: false,
            })
          );
        };

        if (!hasUnsavedFormChanges(getState().form)) {
          apply();
          break;
        }

        return dialog
          .confirm({
            title: i18n.t('app:newInvoice:confirmTitle'),
            message: i18n.t('app:newInvoice:confirmMessage'),
            confirmLabel: i18n.t('app:newInvoice:confirm'),
            cancelLabel: i18n.t('app:newInvoice:cancel'),
          })
          .then(ok => {
            if (!ok) return;
            dispatch(FormActions.clearForm(null, true));
            next(UIActions.changeActiveTab('form'));
            dispatch(
              FormActions.updateRecipient({
                new: {},
                select: action.payload,
                newRecipient: false,
              })
            );
          })
          .catch(err => {
            next({
              type: ACTION_TYPES.UI_NOTIFICATION_NEW,
              payload: {
                type: 'warning',
                message: err.message,
              },
            });
          });
      }

      case ACTION_TYPES.INVOICE_GET_ALL: {
        return getAllDocs('invoices')
          .then(allDocs => {
            next(
              Object.assign({}, action, {
                payload: allDocs,
              })
            );
          })
          .catch(err => {
            next({
              type: ACTION_TYPES.UI_NOTIFICATION_NEW,
              payload: {
                type: 'warning',
                message: err.message,
              },
            });
          });
      }

      case ACTION_TYPES.INVOICE_SAVE: {
        return saveDoc('invoices', action.payload)
          .then(newDocs => {
            next({
              type: ACTION_TYPES.INVOICE_SAVE,
              payload: newDocs,
            });
            if (action.payload.status === 'draft') {
              dispatch({
                type: ACTION_TYPES.UI_NOTIFICATION_NEW,
                payload: {
                  type: 'success',
                  message: i18n.t(
                    isEstimate(action.payload)
                      ? 'messages:estimate:draftSaved'
                      : 'messages:invoice:draftSaved'
                  ),
                },
              });
            } else {
              dispatch({
                type: ACTION_TYPES.UI_NOTIFICATION_NEW,
                payload: {
                  type: 'success',
                  message: i18n.t(
                    isEstimate(action.payload)
                      ? 'messages:estimate:saved'
                      : 'messages:invoice:saved'
                  ),
                },
              });
              ipc.send('preview-invoice', action.payload);
            }
            return persistedInvoice(newDocs, action.payload);
          })
          .catch(err => {
            next({
              type: ACTION_TYPES.UI_NOTIFICATION_NEW,
              payload: {
                type: 'warning',
                message: err.message,
              },
            });
            return false;
          });
      }

      case ACTION_TYPES.INVOICE_EDIT: {
        return getAllDocs('contacts')
          .then(allDocs => {
            next(
              Object.assign({}, action, {
                payload: Object.assign({}, action.payload, {
                  contacts: allDocs,
                }),
              })
            );
            dispatch(UIActions.changeActiveTab('form'));
          })
          .catch(err => {
            next({
              type: ACTION_TYPES.UI_NOTIFICATION_NEW,
              payload: {
                type: 'warning',
                message: err.message,
              },
            });
          });
      }

      case ACTION_TYPES.INVOICE_DELETE: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return undefined;
        }
        const ids = [...new Set([].concat(action.payload))];
        return removeDocs('invoices', ids)
          .then(({ removed, failed, docs }) => {
            next({
              type: ACTION_TYPES.INVOICE_DELETE,
              payload: docs,
            });
            const { editMode } = getState().form.settings;
            if (
              editMode.active &&
              removed.some(doc => doc._id === editMode.data._id)
            ) {
              dispatch({ type: ACTION_TYPES.FORM_CLEAR });
            }
            if (failed.length) {
              dispatch({
                type: ACTION_TYPES.UI_NOTIFICATION_NEW,
                payload: {
                  type: 'warning',
                  message: i18n.t('invoices:toast:deleteFailed', {
                    count: failed.length,
                  }),
                },
              });
            }
            if (removed.length) {
              for (const doc of removed) {
                if (isInvoice(doc)) {
                  markInvoiceDeletedForUndo(doc);
                }
              }
              const allEstimates = removed.every(isEstimate);
              const toastId = toast.add({
                title: i18n.t(
                  allEstimates
                    ? removed.length === 1
                      ? 'estimates:toast:deleted_one'
                      : 'estimates:toast:deleted_other'
                    : 'invoices:toast:deleted',
                  { count: removed.length }
                ),
                timeout: UNDO_TIMEOUT_MS,
                actionProps: {
                  children: i18n.t('invoices:toast:undo'),
                  onClick: () => {
                    toast.close(toastId);
                    dispatch(Actions.restoreInvoices(removed));
                  },
                },
              });
            }
          })
          .catch(err => {
            next({
              type: ACTION_TYPES.UI_NOTIFICATION_NEW,
              payload: {
                type: 'warning',
                message: err.message,
              },
            });
          })
          .finally(endWrite);
      }

      case ACTION_TYPES.INVOICE_RESTORE: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return undefined;
        }
        return restoreDocs('invoices', action.payload)
          .then(docs => {
            for (const doc of action.payload) {
              if (isInvoice(doc)) {
                clearInvoiceDeletedForUndo(doc);
              }
            }
            next({
              type: ACTION_TYPES.INVOICE_RESTORE,
              payload: docs,
            });
            toast.add({
              title: i18n.t('invoices:toast:restored', {
                count: action.payload.length,
              }),
            });
          })
          .catch(err => {
            if (err.docs) {
              next({
                type: ACTION_TYPES.INVOICE_RESTORE,
                payload: err.docs,
              });
            }
            next({
              type: ACTION_TYPES.UI_NOTIFICATION_NEW,
              payload: {
                type: 'warning',
                message: err.message,
              },
            });
          })
          .finally(endWrite);
      }

      case ACTION_TYPES.INVOICE_DUPLICATE: {
        if (warnImportBlocked(dispatch)) {
          return undefined;
        }
        const proceed = () =>
          getAllDocs('contacts').then(allDocs => {
            dispatch({
              type: ACTION_TYPES.FORM_LOAD_DUPLICATE,
              payload: Object.assign(
                {},
                omit(action.payload, [
                  '_id',
                  '_rev',
                  'status',
                  'paidAt',
                  'issuedAt',
                  'created_at',
                  'payments',
                  'convertedInvoiceId',
                  'convertedAt',
                  'sourceEstimateId',
                  'validUntil',
                  'sentAt',
                ]),
                { contacts: allDocs }
              ),
            });
            dispatch(UIActions.changeActiveTab('form'));
          });

        if (!hasUnsavedFormChanges(getState().form)) {
          return proceed().catch(err => {
            next({
              type: ACTION_TYPES.UI_NOTIFICATION_NEW,
              payload: {
                type: 'warning',
                message: err.message,
              },
            });
          });
        }
        return dialog
          .confirm({
            title: i18n.t('app:newInvoice:confirmTitle'),
            message: i18n.t('app:newInvoice:confirmMessage'),
            confirmLabel: i18n.t('app:newInvoice:confirm'),
            cancelLabel: i18n.t('app:newInvoice:cancel'),
          })
          .then(ok => {
            if (!ok) return;
            return proceed();
          })
          .catch(err => {
            next({
              type: ACTION_TYPES.UI_NOTIFICATION_NEW,
              payload: {
                type: 'warning',
                message: err.message,
              },
            });
          });
      }

      case ACTION_TYPES.INVOICE_UPDATE: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return false;
        }
        return updateDoc('invoices', action.payload)
          .then(docs => {
            next({
              type: ACTION_TYPES.INVOICE_UPDATE,
              payload: docs,
            });
            dispatch({
              type: ACTION_TYPES.UI_NOTIFICATION_NEW,
              payload: {
                type: 'success',
                message: i18n.t('messages:invoice:updated'),
              },
            });
            return persistedInvoice(docs, action.payload);
          })
          .catch(err => {
            next({
              type: ACTION_TYPES.UI_NOTIFICATION_NEW,
              payload: {
                type: 'warning',
                message: err.message,
              },
            });
            return false;
          })
          .finally(endWrite);
      }

      case ACTION_TYPES.INVOICE_CONFIGS_SAVE: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return undefined;
        }
        const { invoiceID, configs } = action.payload;
        return getSingleDoc('invoices', invoiceID)
          .then(doc => {
            dispatch({
              type: ACTION_TYPES.INVOICE_UPDATE,
              payload: Object.assign({}, doc, { configs }),
            });
          })
          .catch(err => {
            next({
              type: ACTION_TYPES.UI_NOTIFICATION_NEW,
              payload: {
                type: 'warning',
                message: err.message,
              },
            });
          })
          .finally(endWrite);
      }

      case ACTION_TYPES.INVOICE_PAYMENT_ADD: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return false;
        }
        const { invoiceID, payment, fullBalance } = action.payload;
        const ids = [...new Set([].concat(invoiceID))];
        const now = Date.now();
        const paymentInput = {
          ...payment,
          date: payment.date ?? startOfDay(now),
          method: payment.method ?? 'other',
        };

        return Promise.all(
          ids.map(id =>
            queuedInvoiceWrite(id, doc => {
              if (!isInvoice(doc)) {
                return { ok: false, error: 'notInvoice' };
              }
              return addPaymentToDoc(doc, paymentInput, { fullBalance, now });
            })
          )
        )
          .then(results =>
            finalizeQueuedWrites({
              results,
              next,
              dispatch,
              getState,
            }).then(({ committed, failed }) => {
              if (!committed.length) {
                toast.add({
                  title: paymentErrorMessage(failed[0]?.error ?? 'notFound'),
                  type: 'warning',
                });
                return false;
              }
              toast.add({
                title: i18n.t('invoices:payments:toast:recorded', {
                  count: committed.length,
                }),
              });
              if (failed.length) {
                toast.add({
                  title: i18n.t('invoices:payments:toast:skipped', {
                    count: failed.length,
                    reason: paymentErrorMessage(failed[0].error),
                  }),
                  type: 'warning',
                });
              }
              return true;
            })
          )
          .catch(err => {
            toast.add({
              title: err.message,
              type: 'warning',
            });
            return false;
          })
          .finally(endWrite);
      }

      case ACTION_TYPES.INVOICE_PAYMENT_REMOVE: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return false;
        }
        const { invoiceID, paymentId } = action.payload;
        const now = Date.now();
        return queuedInvoiceWrite(invoiceID, doc => {
          if (!isInvoice(doc)) {
            return { ok: false, error: 'notInvoice' };
          }
          return removePaymentFromDoc(doc, paymentId, now);
        })
          .then(result =>
            finalizeQueuedWrites({
              results: [result],
              next,
              dispatch,
              getState,
            }).then(({ committed }) => {
              if (!result.ok) {
                toast.add({
                  title: paymentErrorMessage(result.error ?? 'notFound'),
                  type: 'warning',
                });
                return false;
              }
              if (!committed.length) {
                toast.add({
                  title: paymentErrorMessage('writeFailed'),
                  type: 'warning',
                });
                return false;
              }
              const removed = result.payment;
              const toastId = toast.add({
                title: i18n.t('invoices:payments:toast:removed'),
                timeout: UNDO_TIMEOUT_MS,
                actionProps: {
                  children: i18n.t('invoices:payments:toast:undo'),
                  onClick: () => {
                    toast.close(toastId);
                    dispatch(Actions.recordPayment(invoiceID, removed));
                  },
                },
              });
              return true;
            })
          )
          .finally(endWrite);
      }

      case ACTION_TYPES.INVOICE_SET_STATUS: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return undefined;
        }
        const { invoiceID, status } = action.payload;
        const allowedStatuses = [
          ...INVOICE_STATUSES,
          ...ESTIMATE_SETTABLE_STATUSES,
        ];
        if (!allowedStatuses.includes(status)) {
          next({
            type: ACTION_TYPES.UI_NOTIFICATION_NEW,
            payload: {
              type: 'warning',
              message: `Unknown invoice status: ${status}`,
            },
          });
          endWrite();
          return Promise.resolve();
        }
        const ids = [...new Set([].concat(invoiceID))];
        const now = Date.now();

        return Promise.all(
          ids.map(id =>
            queuedInvoiceWrite(id, doc => {
              if (!isSettableStatus(doc, status)) {
                return { ok: false, error: 'invalidStatus' };
              }
              if (isEstimate(doc)) {
                return { ok: true, doc: { ...doc, status } };
              }
              return setDocStatus(doc, status, now);
            })
          )
        )
          .then(results =>
            finalizeQueuedWrites({
              results,
              next,
              dispatch,
              getState,
            }).then(({ committed }) => {
              const okResults = results.filter(r => r.ok);
              const failed = results.filter(r => !r.ok);
              if (!committed.length) {
                toast.add({
                  title: paymentErrorMessage(failed[0]?.error ?? 'notFound'),
                  type: 'warning',
                });
                return;
              }
              if (okResults.some(r => r.stillPaid)) {
                toast.add({
                  title: i18n.t('invoices:payments:toast:stillPaid'),
                });
              } else if (ids.length > 1 || committed.length > 1) {
                toast.add({
                  title: i18n.t('invoices:toast:updated', {
                    count: committed.length,
                  }),
                });
              }
              if (failed.length) {
                toast.add({
                  title: i18n.t('invoices:payments:toast:skipped', {
                    count: failed.length,
                    reason: paymentErrorMessage(failed[0].error),
                  }),
                  type: 'warning',
                });
              }
            })
          )
          .catch(err => {
            toast.add({
              title: err.message,
              type: 'warning',
            });
          })
          .finally(endWrite);
      }

      case ACTION_TYPES.ESTIMATE_CONVERT: {
        if (warnImportBlocked(dispatch)) {
          return false;
        }
        const runConvert = () =>
          getAllDocs('invoices').then(docs => {
            const est = docs.find(d => d._id === action.payload._id);
            if (!est) {
              toast.add({
                title: i18n.t('estimates:toast:notFound'),
                type: 'warning',
              });
              return false;
            }
            if (!canConvert(est, buildLinkIndex(docs))) {
              toast.add({
                title: i18n.t('estimates:toast:alreadyConverted'),
                type: 'warning',
              });
              return false;
            }
            return getAllDocs('contacts').then(contacts => {
              dispatch({
                type: ACTION_TYPES.FORM_LOAD_DUPLICATE,
                payload: {
                  ...estimateToInvoiceDraft(est),
                  contacts,
                },
              });
              dispatch(UIActions.changeActiveTab('form'));
              return true;
            });
          });

        if (!hasUnsavedFormChanges(getState().form)) {
          return runConvert().catch(err => {
            next({
              type: ACTION_TYPES.UI_NOTIFICATION_NEW,
              payload: { type: 'warning', message: err.message },
            });
            return false;
          });
        }
        return dialog
          .confirm({
            title: i18n.t('app:newInvoice:confirmTitle'),
            message: i18n.t('app:newInvoice:confirmMessage'),
            confirmLabel: i18n.t('app:newInvoice:confirm'),
            cancelLabel: i18n.t('app:newInvoice:cancel'),
          })
          .then(ok => {
            if (!ok) return false;
            return runConvert();
          })
          .catch(err => {
            next({
              type: ACTION_TYPES.UI_NOTIFICATION_NEW,
              payload: { type: 'warning', message: err.message },
            });
            return false;
          });
      }

      case ACTION_TYPES.ESTIMATE_MARK_CONVERTED: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return false;
        }
        const { estimateId, invoiceId } = action.payload;
        return getSingleDoc('invoices', estimateId)
          .then(doc =>
            updateDoc('invoices', withConversion(doc, invoiceId, Date.now()))
          )
          .then(docs => {
            next({
              type: ACTION_TYPES.INVOICE_UPDATE,
              payload: docs,
            });
            toast.add({
              title: i18n.t('estimates:toast:converted', {
                number: getInvoiceNumber(
                  docs.find(d => d._id === estimateId) ?? { _id: estimateId }
                ),
              }),
            });
            return true;
          })
          .catch(() => {
            toast.add({
              title: i18n.t('estimates:toast:linkFailed'),
              type: 'warning',
            });
            return false;
          })
          .finally(endWrite);
      }

      default: {
        return next(action);
      }
    }
  };

export default InvoicesMW;
