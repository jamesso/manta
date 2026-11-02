import * as ACTION_TYPES from '../constants/actions.jsx';
import * as Actions from '../actions/items';
import {
  getAllDocs,
  saveDoc,
  updateDoc,
  removeDocs,
  restoreDocs,
} from '../helpers/pouchDB';
import { getItemErrors } from '../helpers/items';
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

function itemValuesFromDoc(doc) {
  return {
    name: doc.name ?? '',
    description: doc.description ?? '',
    unitPrice: String(doc.unitPrice ?? ''),
    unitCode: doc.unitCode,
  };
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
        return saveDoc('items', action.payload)
          .then(newDocs => {
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

      case ACTION_TYPES.ITEM_UPDATE: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return false;
        }
        return getAllDocs('items')
          .then(allDocs => {
            const errors = getItemErrors(
              itemValuesFromDoc(action.payload),
              allDocs,
              action.payload._id
            );
            if (Object.keys(errors).length) {
              dispatch({
                type: ACTION_TYPES.UI_NOTIFICATION_NEW,
                payload: {
                  type: 'warning',
                  message: i18n.t(
                    errors.name ?? errors.unitPrice ?? errors.unitCode
                  ),
                },
              });
              return false;
            }
            return updateDoc('items', action.payload)
              .then(newDocs => {
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
          })
          .finally(endWrite);
      }

      case ACTION_TYPES.ITEM_DELETE: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return undefined;
        }
        const ids = [...new Set([].concat(action.payload))];
        return removeDocs('items', ids)
          .then(({ removed, failed, docs }) => {
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
          .finally(endWrite);
      }

      case ACTION_TYPES.ITEM_RESTORE: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return undefined;
        }
        return restoreDocs('items', action.payload)
          .then(docs => {
            next({
              type: ACTION_TYPES.ITEM_RESTORE,
              payload: docs,
            });
            toast.add({
              title: i18n.t('messages:item:restored'),
            });
          })
          .catch(err => {
            if (err.docs) {
              next({
                type: ACTION_TYPES.ITEM_RESTORE,
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

      default: {
        return next(action);
      }
    }
  };

export default ItemsMW;
