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
import { withStatus } from '../helpers/invoice';
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

const InvoicesMW =
  ({ dispatch, getState }) =>
  next =>
  action => {
    switch (action.type) {
      case ACTION_TYPES.INVOICE_NEW_FROM_CONTACT: {
        const apply = () => {
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
            apply();
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
            return true;
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
          });
      }

      case ACTION_TYPES.INVOICE_RESTORE: {
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
          });
      }

      case ACTION_TYPES.INVOICE_DUPLICATE: {
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
            return true;
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

      case ACTION_TYPES.INVOICE_CONFIGS_SAVE: {
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
          });
      }

      case ACTION_TYPES.INVOICE_SET_STATUS: {
        const { invoiceID, status } = action.payload;
        if (!INVOICE_STATUSES.includes(status)) {
          next({
            type: ACTION_TYPES.UI_NOTIFICATION_NEW,
            payload: {
              type: 'warning',
              message: `Unknown invoice status: ${status}`,
            },
          });
          return Promise.resolve();
        }
        const ids = [...new Set([].concat(invoiceID))];
        if (ids.length === 1) {
          return getSingleDoc('invoices', ids[0])
            .then(doc => {
              dispatch({
                type: ACTION_TYPES.INVOICE_UPDATE,
                payload: withStatus(doc, status, Date.now()),
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
            });
        }
        return Promise.all(ids.map(id => getSingleDoc('invoices', id)))
          .then(docs =>
            updateDocs(
              'invoices',
              docs.map(doc => withStatus(doc, status, Date.now()))
            )
          )
          .then(allDocs => {
            next({
              type: ACTION_TYPES.INVOICE_UPDATE,
              payload: allDocs,
            });
            toast.add({
              title: i18n.t('invoices:toast:updated', { count: ids.length }),
            });
          })
          .catch(err => {
            if (err.docs) {
              next({
                type: ACTION_TYPES.INVOICE_UPDATE,
                payload: err.docs,
              });
              dispatch({
                type: ACTION_TYPES.UI_NOTIFICATION_NEW,
                payload: {
                  type: 'warning',
                  message: i18n.t('invoices:toast:updated', {
                    count: err.succeeded.length,
                  }),
                },
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
      }

      default: {
        return next(action);
      }
    }
  };

export default InvoicesMW;
