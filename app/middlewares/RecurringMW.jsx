import * as ACTION_TYPES from '../constants/actions.jsx';
import * as Actions from '../actions/recurring';
import * as InvoicesActions from '../actions/invoices';
import * as UIActions from '../actions/ui';
import {
  getAllDocs,
  saveDoc,
  updateDoc,
  getSingleDoc,
  removeDocs,
  restoreDocs,
} from '../helpers/pouchDB';
import { applyScheduleOnSave, getRecurringErrors } from '../helpers/recurring';
import { runRecurringOnce } from '../helpers/recurringRunner';
import { createSingleFlight } from '../helpers/singleFlight';
import { UNDO_TIMEOUT_MS } from '../constants/invoices';
import { toast } from '@/components/ui/toast';
import i18n from '../../i18n/i18n';
import {
  isImportWriteLocked,
  importWriteLockReason,
  trackImportWriteStart,
} from '../helpers/importWriteLock';

let writeChain = Promise.resolve();

function runRecurringWrite(task) {
  const next = writeChain.then(task);
  writeChain = next.catch(() => {});
  return next;
}

const runLocked = createSingleFlight(() =>
  runRecurringWrite(() =>
    runRecurringOnce({ now: Date.now() }).then(result => ({
      ...result,
      changed: true,
    }))
  )
);

function protectWrite(dispatch) {
  const endWrite = trackImportWriteStart();
  if (endWrite) {
    return endWrite;
  }
  if (isImportWriteLocked()) {
    dispatch({
      type: ACTION_TYPES.UI_NOTIFICATION_NEW,
      payload: {
        type: 'warning',
        message: i18n.t(importWriteLockReason()),
      },
    });
    return null;
  }
  return null;
}

const RecurringMW =
  ({ dispatch, getState }) =>
  next =>
  action => {
    switch (action.type) {
      case ACTION_TYPES.RECURRING_GET_ALL:
        return getAllDocs('recurring')
          .then(allDocs => {
            next(Object.assign({}, action, { payload: allDocs }));
          })
          .catch(err => {
            toast.add({ title: err.message, type: 'warning' });
          });

      case ACTION_TYPES.RECURRING_SAVE: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return undefined;
        }
        return runRecurringWrite(async () => {
          try {
            const now = Date.now();
            const previous = getState().recurring.find(
              p => p._id === action.payload._id
            );
            const schedule = applyScheduleOnSave(previous, action.payload, now);
            let doc = { ...action.payload, ...schedule };
            const errors = getRecurringErrors(doc);
            if (Object.keys(errors).length) {
              toast.add({
                title: i18n.t(Object.values(errors)[0]),
                type: 'warning',
              });
              return false;
            }
            if (!doc._id) {
              doc = {
                ...doc,
                _id: crypto.randomUUID(),
                created_at: now,
                lastRunAt: null,
              };
              const newDocs = await saveDoc('recurring', doc);
              next({ type: ACTION_TYPES.RECURRING_SAVE, payload: newDocs });
            } else {
              const newDocs = await updateDoc('recurring', doc);
              next({ type: ACTION_TYPES.RECURRING_SAVE, payload: newDocs });
            }
            dispatch(UIActions.setRecurringSheet(null));
            toast.add({ title: i18n.t('recurring:toast:saved') });
            dispatch(Actions.runRecurring());
            return true;
          } catch (err) {
            toast.add({ title: err.message, type: 'warning' });
            return false;
          } finally {
            endWrite();
          }
        });
      }

      case ACTION_TYPES.RECURRING_SET_ACTIVE: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return undefined;
        }
        const { id, active } = action.payload;
        return runRecurringWrite(async () => {
          try {
            const existing = getState().recurring.find(p => p._id === id);
            if (!existing) {
              return false;
            }
            const now = Date.now();
            const doc = {
              ...existing,
              active,
              ...applyScheduleOnSave(existing, { ...existing, active }, now),
            };
            const newDocs = await updateDoc('recurring', doc);
            next({ type: ACTION_TYPES.RECURRING_SET_ACTIVE, payload: newDocs });
            dispatch(Actions.runRecurring());
            return true;
          } catch (err) {
            toast.add({ title: err.message, type: 'warning' });
            return false;
          } finally {
            endWrite();
          }
        });
      }

      case ACTION_TYPES.RECURRING_TEMPLATE_UPDATE: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return undefined;
        }
        const { id, template } = action.payload;
        return runRecurringWrite(async () => {
          try {
            const doc = await getSingleDoc('recurring', id);
            const newDocs = await updateDoc('recurring', { ...doc, template });
            next({
              type: ACTION_TYPES.RECURRING_TEMPLATE_UPDATE,
              payload: newDocs,
            });
            return true;
          } catch (err) {
            toast.add({ title: err.message, type: 'warning' });
            return Promise.reject(err);
          } finally {
            endWrite();
          }
        });
      }

      case ACTION_TYPES.RECURRING_DELETE: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return undefined;
        }
        const ids = [...new Set([].concat(action.payload))];
        return runRecurringWrite(() =>
          removeDocs('recurring', ids).then(({ removed, failed, docs }) => {
            next({ type: ACTION_TYPES.RECURRING_DELETE, payload: docs });
            if (failed.length) {
              toast.add({
                title: i18n.t('recurring:toast:runFailed'),
                type: 'warning',
              });
            }
            if (removed.length) {
              const toastId = toast.add({
                title: i18n.t('recurring:toast:deleted', {
                  count: removed.length,
                }),
                timeout: UNDO_TIMEOUT_MS,
                actionProps: {
                  children: i18n.t('recurring:toast:undo'),
                  onClick: () => {
                    toast.close(toastId);
                    dispatch(Actions.restoreRecurring(removed));
                  },
                },
              });
            }
          })
        ).finally(endWrite);
      }

      case ACTION_TYPES.RECURRING_RESTORE:
        return runRecurringWrite(() =>
          restoreDocs('recurring', action.payload).then(docs => {
            next({ type: ACTION_TYPES.RECURRING_RESTORE, payload: docs });
            toast.add({ title: i18n.t('recurring:toast:restored') });
          })
        );

      case ACTION_TYPES.RECURRING_RUN: {
        const endWrite = trackImportWriteStart();
        if (!endWrite) {
          return undefined;
        }
        return runLocked()
          .then(result => {
            if (result.created > 0) {
              dispatch(InvoicesActions.getInvoices());
              toast.add({
                title: i18n.t('recurring:toast:created', {
                  count: result.created,
                }),
                actionProps: {
                  children: i18n.t('recurring:toast:viewDrafts'),
                  onClick: () =>
                    dispatch(
                      UIActions.openList('invoices', { status: 'draft' })
                    ),
                },
              });
            }
            if (result.capped?.length) {
              toast.add({
                title: i18n.t('recurring:toast:capped', {
                  names: result.capped.join(', '),
                }),
                type: 'warning',
              });
            }
            if (result.errors?.length) {
              toast.add({
                title:
                  result.errors[0].error ?? i18n.t('recurring:toast:runFailed'),
                type: 'warning',
              });
            }
            if (
              result.created > 0 ||
              result.skipped > 0 ||
              result.capped?.length ||
              result.errors?.length
            ) {
              dispatch(Actions.getRecurring());
            }
          })
          .catch(err => {
            toast.add({ title: err.message, type: 'warning' });
          })
          .finally(() => {
            endWrite();
            if (typeof window !== 'undefined') {
              window.__mantaRecurringRunDone =
                (window.__mantaRecurringRunDone ?? 0) + 1;
            }
          });
      }

      default:
        return next(action);
    }
  };

export default RecurringMW;
