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
                  message: i18n.t('messages:invoice:draftSaved'),
                },
              });
            } else {
              dispatch({
                type: ACTION_TYPES.UI_NOTIFICATION_NEW,
                payload: {
                  type: 'success',
                  message: i18n.t('messages:invoice:saved'),
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
              const toastId = toast.add({
                title: i18n.t('invoices:toast:deleted', {
                  count: removed.length,
                }),
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

        const processId = id =>
          runPaymentQueued(id, () =>
            getSingleDoc('invoices', id)
              .then(doc => {
                const result = addPaymentToDoc(doc, paymentInput, {
                  fullBalance,
                  now,
                });
                return { id, ...result };
              })
              .catch(() => ({ id, ok: false, error: 'notFound' }))
          );

        return Promise.all(ids.map(processId))
          .then(results => {
            const okDocs = results.filter(r => r.ok).map(r => r.doc);
            const failed = results.filter(r => !r.ok);
            if (!okDocs.length) {
              toast.add({
                title: paymentErrorMessage(failed[0]?.error ?? 'notFound'),
                type: 'warning',
              });
              return false;
            }
            return updateDocs('invoices', okDocs)
              .then(allDocs => {
                next({
                  type: ACTION_TYPES.INVOICE_UPDATE,
                  payload: allDocs,
                });
                syncEditMode(dispatch, getState, allDocs, ids);
                toast.add({
                  title: i18n.t('invoices:payments:toast:recorded', {
                    count: okDocs.length,
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
              .catch(err => {
                if (err.docs) {
                  next({
                    type: ACTION_TYPES.INVOICE_UPDATE,
                    payload: err.docs,
                  });
                  syncEditMode(dispatch, getState, err.docs, ids);
                }
                toast.add({
                  title: paymentErrorMessage(failed[0]?.error ?? err.message),
                  type: 'warning',
                });
                return false;
              });
          })
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
        return runPaymentQueued(invoiceID, () =>
          getSingleDoc('invoices', invoiceID)
            .then(doc => {
              const result = removePaymentFromDoc(doc, paymentId, now);
              if (!result.ok) {
                toast.add({
                  title: paymentErrorMessage(result.error),
                  type: 'warning',
                });
                return false;
              }
              return updateDocs('invoices', [result.doc])
                .then(allDocs => {
                  next({
                    type: ACTION_TYPES.INVOICE_UPDATE,
                    payload: allDocs,
                  });
                  syncEditMode(dispatch, getState, allDocs, [invoiceID]);
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
                .catch(err => {
                  if (err.docs) {
                    next({
                      type: ACTION_TYPES.INVOICE_UPDATE,
                      payload: err.docs,
                    });
                  }
                  toast.add({
                    title: err.message,
                    type: 'warning',
                  });
                  return false;
                });
            })
            .catch(() => {
              toast.add({
                title: paymentErrorMessage('notFound'),
                type: 'warning',
              });
              return false;
            })
        ).finally(endWrite);
      }

      case ACTION_TYPES.INVOICE_SET_STATUS: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return undefined;
        }
        const { invoiceID, status } = action.payload;
        if (!INVOICE_STATUSES.includes(status)) {
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

        const processId = id =>
          runPaymentQueued(id, () =>
            getSingleDoc('invoices', id)
              .then(doc => {
                const result = setDocStatus(doc, status, now);
                if (!result.ok) {
                  return { id, ok: false, error: result.error };
                }
                return {
                  id,
                  ok: true,
                  doc: result.doc,
                  stillPaid: result.stillPaid,
                };
              })
              .catch(() => ({ id, ok: false, error: 'notFound' }))
          );

        return Promise.all(ids.map(processId))
          .then(results => {
            const okResults = results.filter(r => r.ok);
            const okDocs = okResults.map(r => r.doc);
            const failed = results.filter(r => !r.ok);
            if (!okDocs.length) {
              toast.add({
                title: paymentErrorMessage(failed[0]?.error ?? 'notFound'),
                type: 'warning',
              });
              return;
            }
            return updateDocs('invoices', okDocs)
              .then(allDocs => {
                next({
                  type: ACTION_TYPES.INVOICE_UPDATE,
                  payload: allDocs,
                });
                syncEditMode(dispatch, getState, allDocs, ids);
                if (okResults.some(r => r.stillPaid)) {
                  toast.add({
                    title: i18n.t('invoices:payments:toast:stillPaid'),
                  });
                } else if (ids.length > 1 || okDocs.length > 1) {
                  toast.add({
                    title: i18n.t('invoices:toast:updated', {
                      count: okDocs.length,
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
              .catch(err => {
                if (err.docs) {
                  next({
                    type: ACTION_TYPES.INVOICE_UPDATE,
                    payload: err.docs,
                  });
                  syncEditMode(dispatch, getState, err.docs, ids);
                  toast.add({
                    title: i18n.t('invoices:toast:updated', {
                      count: err.succeeded?.length ?? 0,
                    }),
                    type: 'warning',
                  });
                  return;
                }
                return getAllDocs('invoices').then(docs => {
                  next({
                    type: ACTION_TYPES.INVOICE_UPDATE,
                    payload: docs,
                  });
                  next({
                    type: ACTION_TYPES.UI_NOTIFICATION_NEW,
                    payload: {
                      type: 'warning',
                      message: err.message,
                    },
                  });
                });
              });
          })
          .finally(endWrite);
      }

      default: {
        return next(action);
      }
    }
  };

export default InvoicesMW;
