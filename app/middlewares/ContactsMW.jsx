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
        return saveDoc('contacts', action.payload)
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
          });
      }

      case ACTION_TYPES.CONTACT_UPDATE: {
        return updateDoc('contacts', action.payload)
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
          });
      }

      case ACTION_TYPES.CONTACT_DELETE: {
        const ids = [...new Set([].concat(action.payload))];
        return removeDocs('contacts', ids)
          .then(({ removed, failed, docs }) => {
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
          });
      }

      case ACTION_TYPES.CONTACT_RESTORE: {
        return restoreDocs('contacts', action.payload)
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
          .catch(err => {
            if (err.docs) {
              next({
                type: ACTION_TYPES.CONTACT_RESTORE,
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

      default: {
        return next(action);
      }
    }
  };

export default ContactsMW;
