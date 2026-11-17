// Node Libs
// Actions Verbs
import * as ACTION_TYPES from '../constants/actions.jsx';
import * as Actions from '../actions/contacts';

// Helpers
import {
  getAllDocs,
  saveDoc,
  updateDoc,
  removeDocs,
  restoreDocs,
} from '../helpers/pouchDB';
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

const ContactsMW =
  ({ dispatch }) =>
  next =>
  action => {
    switch (action.type) {
      case ACTION_TYPES.CONTACT_GET_ALL: {
        return getAllDocs('contacts')
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

      case ACTION_TYPES.CONTACT_SAVE: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return false;
        }
        return saveDoc('contacts', action.payload)
          .then(() => getAllDocs('contacts'))
          .then(newDocs => {
            next({
              type: ACTION_TYPES.CONTACT_SAVE,
              payload: newDocs,
            });
            dispatch({
              type: ACTION_TYPES.UI_NOTIFICATION_NEW,
              payload: {
                type: 'success',
                message: i18n.t('messages:contact:saved'),
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

      case ACTION_TYPES.CONTACT_UPDATE: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return false;
        }
        return updateDoc('contacts', action.payload)
          .then(() => getAllDocs('contacts'))
          .then(newDocs => {
            next({
              type: ACTION_TYPES.CONTACT_UPDATE,
              payload: newDocs,
            });
            dispatch({
              type: ACTION_TYPES.UI_NOTIFICATION_NEW,
              payload: {
                type: 'success',
                message: i18n.t('messages:contact:updated'),
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

      case ACTION_TYPES.CONTACT_DELETE: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return undefined;
        }
        const ids = [...new Set([].concat(action.payload))];
        return removeDocs('contacts', ids)
          .then(async ({ removed, failed }) => {
            const docs = await getAllDocs('contacts');
            next({
              type: ACTION_TYPES.CONTACT_DELETE,
              payload: docs,
            });
            if (failed.length) {
              dispatch({
                type: ACTION_TYPES.UI_NOTIFICATION_NEW,
                payload: {
                  type: 'warning',
                  message: i18n.t('contacts:toast:deleteFailed', {
                    count: failed.length,
                  }),
                },
              });
            }
            if (removed.length) {
              const toastId = toast.add({
                title: i18n.t('contacts:toast:deleted', {
                  count: removed.length,
                }),
                timeout: UNDO_TIMEOUT_MS,
                actionProps: {
                  children: i18n.t('contacts:toast:undo'),
                  onClick: () => {
                    toast.close(toastId);
                    dispatch(Actions.restoreContacts(removed));
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

      case ACTION_TYPES.CONTACT_RESTORE: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return undefined;
        }
        return restoreDocs('contacts', action.payload)
          .then(() => getAllDocs('contacts'))
          .then(docs => {
            next({
              type: ACTION_TYPES.CONTACT_RESTORE,
              payload: docs,
            });
            toast.add({
              title: i18n.t('contacts:toast:restored', {
                count: action.payload.length,
              }),
            });
          })
          .catch(async err => {
            let failure = err;
            if (err.message === 'partial-restore') {
              try {
                const docs = await getAllDocs('contacts');
                next({
                  type: ACTION_TYPES.CONTACT_RESTORE,
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
          })
          .finally(endWrite);
      }

      default: {
        return next(action);
      }
    }
  };

export default ContactsMW;
