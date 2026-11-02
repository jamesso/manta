// Node Libs
import i18n from '../../i18n/i18n';
const appConfig = window.manta.settings;
const ipc = window.manta.ipc;

// Actions Verbs
import * as ACTION_TYPES from '../constants/actions.jsx';

// Actions
import * as FormActions from '../actions/form';
import * as InvoicesActions from '../actions/invoices';
import * as ContactsActions from '../actions/contacts';
import * as SettingsActions from '../actions/settings';
import * as UIActions from '../actions/ui';

// Helper
import {
  getInvoiceData,
  getFormErrors,
  getRecipientErrors,
  hasUnsavedFormChanges,
} from '../helpers/form';
import {
  advanceNumbering,
  formatInvoiceNumber,
  normalizeNumbering,
} from '../helpers/numbering';

let saveInFlight = null;

async function handleSave({ dispatch, getState }, mode) {
  if (saveInFlight) {
    return saveInFlight;
  }

  const run = (async () => {
    try {
    const formSnapshot = getState().form;
    const startRevision = formSnapshot.formRevision;
    dispatch(FormActions.setFormSavePending(true));
    const errors = getFormErrors(formSnapshot, mode);
    if (Object.keys(errors).length) {
      dispatch(FormActions.setFormErrors(errors, mode));
      dispatch({
        type: ACTION_TYPES.UI_NOTIFICATION_NEW,
        payload: {
          type: 'warning',
          message: i18n.t('form:errors:summary'),
        },
      });
      return;
    }

    const defaultCurrency = appConfig.get('invoice.currency');
    const data = getInvoiceData(formSnapshot, {
      mode,
      defaultCurrency,
    });
    const { editMode } = formSnapshot.settings;
    let ok;
    if (editMode.active) {
      ok = await dispatch(InvoicesActions.updateInvoice(data));
    } else {
      ok = await dispatch(InvoicesActions.saveInvoice(data));
    }
    if (ok === false) {
      return;
    }

    if (!editMode.active) {
      const advancedNumbering = advanceNumbering(
        normalizeNumbering(appConfig.get('invoice.numbering')),
        data.invoiceID
      );
      try {
        appConfig.set('invoice.numbering', advancedNumbering);
      } catch (err) {
        dispatch({
          type: ACTION_TYPES.FORM_RECONCILE_NUMBERING,
          payload: advancedNumbering,
        });
        dispatch({
          type: ACTION_TYPES.UI_NOTIFICATION_NEW,
          payload: {
            type: 'warning',
            message: i18n.t('form:errors:partialNumberingSave'),
          },
        });
      }
    }

    if (formSnapshot.recipient.newRecipient) {
      const contactErrors = getRecipientErrors(formSnapshot.recipient, 'final');
      if (Object.keys(contactErrors).length === 0) {
        const contactOk = await dispatch(
          ContactsActions.saveContact(data.recipient)
        );
        if (contactOk === false) {
          dispatch({
            type: ACTION_TYPES.UI_NOTIFICATION_NEW,
            payload: {
              type: 'warning',
              message: i18n.t('form:errors:partialContactSave'),
            },
          });
        }
      }
    }

    if (
      editMode.active &&
      editMode.data.status === 'draft' &&
      mode === 'final'
    ) {
      ipc.send('preview-invoice', data);
    }

    if (editMode.active) {
      dispatch(UIActions.changeActiveTab('invoices'));
    }

    const afterSave = getState().form;
    if (afterSave.formRevision !== startRevision) {
      const merged = getInvoiceData(
        {
          ...afterSave,
          settings: {
            ...afterSave.settings,
            editMode: { active: true, data },
          },
        },
        { mode, defaultCurrency }
      );
      dispatch({
        type: ACTION_TYPES.FORM_ATTACH_SAVED_INVOICE,
        payload: merged,
      });
      return;
    }

    if (afterSave.formRevision === startRevision) {
      dispatch(FormActions.clearForm(null, true));
    }
    } catch (err) {
      dispatch({
        type: ACTION_TYPES.UI_NOTIFICATION_NEW,
        payload: {
          type: 'warning',
          message: err.message,
        },
      });
    }
  })();

  saveInFlight = run.finally(() => {
    saveInFlight = null;
    dispatch(FormActions.setFormSavePending(false));
  });
  return saveInFlight;
}

function refreshErrorsIfNeeded({ dispatch, getState }, action) {
  const form = getState().form;
  if (!form.errors || !Object.keys(form.errors).length || form.errorMode == null) {
    return action;
  }
  dispatch(
    FormActions.setFormErrors(getFormErrors(form, form.errorMode), form.errorMode)
  );
  return action;
}

const FormMW =
  ({ dispatch, getState }) =>
  next =>
  action => {
    switch (action.type) {
      case ACTION_TYPES.FORM_SAVE: {
        return handleSave({ dispatch, getState }, action.payload);
      }

      case ACTION_TYPES.FORM_ITEM_ADD: {
        return next(
          Object.assign({}, action, {
            payload: { id: crypto.randomUUID() },
          })
        );
      }

      case ACTION_TYPES.FORM_CLEAR: {
        dispatch(FormActions.closeFormSettings());
        const reconciled = getState().form.reconciledNumbering;
        next(action);
        dispatch(FormActions.addItem());
        const numbering = reconciled
          ? normalizeNumbering(reconciled)
          : normalizeNumbering(appConfig.get('invoice.numbering'));
        dispatch(
          FormActions.updateFieldData(
            'invoiceID',
            formatInvoiceNumber(numbering)
          )
        );
        if (reconciled) {
          dispatch({ type: ACTION_TYPES.FORM_CLEAR_RECONCILED_NUMBERING });
        }
        break;
      }

      case ACTION_TYPES.FORM_LOAD_DUPLICATE: {
        const result = next(action);
        dispatch(
          FormActions.updateFieldData(
            'invoiceID',
            formatInvoiceNumber(
              normalizeNumbering(appConfig.get('invoice.numbering'))
            )
          )
        );
        return result;
      }

      case ACTION_TYPES.FORM_FIELD_UPDATE_DATA:
      case ACTION_TYPES.FORM_ITEM_REMOVE:
      case ACTION_TYPES.FORM_ITEM_UPDATE:
      case ACTION_TYPES.FORM_ITEM_MOVE:
      case ACTION_TYPES.FORM_RECIPIENT_UPDATE: {
        const result = next(action);
        refreshErrorsIfNeeded({ dispatch, getState }, action);
        return result;
      }

      case ACTION_TYPES.SAVED_FORM_SETTING_UPDATE: {
        const { setting, data } = action.payload;
        appConfig.set(`invoice.${setting}`, data);
        dispatch({
          type: ACTION_TYPES.UI_NOTIFICATION_NEW,
          payload: {
            type: 'success',
            message: i18n.t('messages:settings:saved'),
          },
        });
        next({
          type: ACTION_TYPES.SAVED_FORM_SETTING_UPDATE,
          payload: appConfig.get('invoice'),
        });
        dispatch(SettingsActions.getInitalSettings());
        break;
      }

      default: {
        return next(action);
      }
    }
  };

export default FormMW;
