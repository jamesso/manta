import * as ACTION_TYPES from '../constants/actions.jsx';
import * as Actions from '../actions/items';
import {
  getAllDocs,
  saveDoc,
  updateDoc,
  removeDocs,
  restoreDocs,
} from '../helpers/pouchDB';
import {
  prepareItemsForRestore,
  runItemCatalogWrite,
  validateItemDocForWrite,
} from '../helpers/itemCatalogWrites';
import i18n from '../../i18n/i18n';
import { UNDO_TIMEOUT_MS } from '../constants/invoices';
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

function warnItemValidation(dispatch, errors) {
  dispatch({
    type: ACTION_TYPES.UI_NOTIFICATION_NEW,
    payload: {
      type: 'warning',
      message: i18n.t(errors.name ?? errors.unitPrice ?? errors.unitCode),
    },
  });
}

const ItemsMW =
  ({ dispatch }) =>
  next =>
  action => {
    switch (action.type) {
      case ACTION_TYPES.ITEM_GET_ALL: {
        return getAllDocs('items')
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

      case ACTION_TYPES.ITEM_SAVE: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return false;
        }
        return runItemCatalogWrite(async () => {
          const items = await getAllDocs('items');
          const errors = validateItemDocForWrite(action.payload, items);
          if (Object.keys(errors).length) {
            warnItemValidation(dispatch, errors);
            return false;
          }
          try {
            await saveDoc('items', action.payload);
            const newDocs = await getAllDocs('items');
            next({
              type: ACTION_TYPES.ITEM_SAVE,
              payload: newDocs,
            });
            dispatch({
              type: ACTION_TYPES.UI_NOTIFICATION_NEW,
              payload: {
                type: 'success',
                message: i18n.t('messages:item:saved'),
              },
            });
            return true;
          } catch (err) {
            next({
              type: ACTION_TYPES.UI_NOTIFICATION_NEW,
              payload: {
                type: 'warning',
                message: err.message,
              },
            });
            return false;
          }
        }).finally(endWrite);
      }

      case ACTION_TYPES.ITEM_UPDATE: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return false;
        }
        return runItemCatalogWrite(async () => {
          const items = await getAllDocs('items');
          const errors = validateItemDocForWrite(action.payload, items);
          if (Object.keys(errors).length) {
            warnItemValidation(dispatch, errors);
            return false;
          }
          try {
            await updateDoc('items', action.payload);
            const newDocs = await getAllDocs('items');
            next({
              type: ACTION_TYPES.ITEM_UPDATE,
              payload: newDocs,
            });
            dispatch({
              type: ACTION_TYPES.UI_NOTIFICATION_NEW,
              payload: {
                type: 'success',
                message: i18n.t(
                  action.meta?.messageKey ?? 'messages:item:updated'
                ),
              },
            });
            return true;
          } catch (err) {
            next({
              type: ACTION_TYPES.UI_NOTIFICATION_NEW,
              payload: {
                type: 'warning',
                message: err.message,
              },
            });
            return false;
          }
        }).finally(endWrite);
      }

      case ACTION_TYPES.ITEM_DELETE: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return undefined;
        }
        const ids = [...new Set([].concat(action.payload))];
        return runItemCatalogWrite(() =>
          removeDocs('items', ids)
            .then(async ({ removed, failed }) => {
              const docs = await getAllDocs('items');
              next({
                type: ACTION_TYPES.ITEM_DELETE,
                payload: docs,
              });
              if (failed.length) {
                dispatch({
                  type: ACTION_TYPES.UI_NOTIFICATION_NEW,
                  payload: {
                    type: 'warning',
                    message: i18n.t('messages:item:deleteFailed'),
                  },
                });
              }
              if (removed.length) {
                const toastId = toast.add({
                  title: i18n.t('messages:item:deleted', {
                    count: removed.length,
                  }),
                  timeout: UNDO_TIMEOUT_MS,
                  actionProps: {
                    children: i18n.t('messages:item:undo'),
                    onClick: () => {
                      toast.close(toastId);
                      dispatch(Actions.restoreItems(removed));
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
        ).finally(endWrite);
      }

      case ACTION_TYPES.ITEM_RESTORE: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return undefined;
        }
        return runItemCatalogWrite(async () => {
          const current = await getAllDocs('items');
          const { docs, archivedDueToConflict } = prepareItemsForRestore(
            action.payload,
            current
          );
          try {
            await restoreDocs('items', docs);
            const allDocs = await getAllDocs('items');
            next({
              type: ACTION_TYPES.ITEM_RESTORE,
              payload: allDocs,
            });
            if (archivedDueToConflict) {
              dispatch({
                type: ACTION_TYPES.UI_NOTIFICATION_NEW,
                payload: {
                  type: 'warning',
                  message: i18n.t('items:errors:nameTaken'),
                },
              });
            }
            toast.add({
              title: i18n.t('messages:item:restored'),
            });
          } catch (err) {
            let failure = err;
            if (err.message === 'partial-restore') {
              try {
                const docs = await getAllDocs('items');
                next({
                  type: ACTION_TYPES.ITEM_RESTORE,
                  payload: docs,
                });
              } catch (readErr) {
                failure = readErr;
              }
            }
            next({
              type: ACTION_TYPES.UI_NOTIFICATION_NEW,
              payload: {
                type: 'warning',
                message: failure.message,
              },
            });
          }
        }).finally(endWrite);
      }

      default: {
        return next(action);
      }
    }
  };

export default ItemsMW;
