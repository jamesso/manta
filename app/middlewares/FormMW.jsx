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
  applyTaxRate,
  getDefaultTaxRate,
  getTaxRates,
  matchLegacyTaxRate,
} from '../helpers/tax';
import { getPaymentEditErrors } from '../helpers/payments';
import { formatNumber } from '../../helpers/formatNumber';
import { toast } from '@/components/ui/toast';
import {
  isImportWriteLocked,
  importWriteLockReason,
  trackImportWriteStart,
} from '../helpers/importWriteLock';
import {
  advanceNumbering,
  resolveStoredNumbering,
  suggestedInvoiceNumberFromReconciled,
} from '../helpers/numbering';

function suggestedInvoiceNumberForForm(form) {
  return suggestedInvoiceNumberFromReconciled(
    form.reconciledNumbering,
    appConfig.get('invoice.numbering')
  );
}

function syncLineTaxRows(dispatch, getState, { overwriteAll = false } = {}) {
  const form = getState().form;
  if (form.taxMode !== 'line' || !form.settings.required_fields.tax) {
    return;
  }
  const rates = getTaxRates(appConfig.get('invoice'));
  const defaultRate = getDefaultTaxRate(rates);
  if (!defaultRate) {
    return;
  }
  const legacyRate = overwriteAll
    ? matchLegacyTaxRate(form.tax, rates)
    : null;
  for (const row of form.rows) {
    if (overwriteAll) {
      dispatch(
        FormActions.updateItem(applyTaxRate(row, legacyRate ?? defaultRate))
      );
      continue;
    }
    if (row.taxRateId == null || row.taxRateId === '') {
      dispatch(FormActions.updateItem(applyTaxRate(row, defaultRate)));
    }
  }
}

function invoiceDataOptions(mode) {
  return {
    mode,
    defaultCurrency: appConfig.get('invoice.currency'),
    profile: appConfig.get('profile') ?? {},
    invoiceSettings: appConfig.get('invoice') ?? {},
  };
}

let saveInFlight = null;

async function handleSave({ dispatch, getState }, mode) {
  if (saveInFlight) {
    return saveInFlight;
  }

  const endWrite = trackImportWriteStart();
  if (!endWrite) {
    dispatch({
      type: ACTION_TYPES.UI_NOTIFICATION_NEW,
      payload: {
        type: 'warning',
        message: i18n.t(importWriteLockReason()),
      },
    });
    return false;
  }

  const run = (async () => {
    try {
      const formSnapshot = getState().form;
      const startRevision = formSnapshot.formRevision;
      const startGeneration = formSnapshot.formGeneration ?? 0;
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

      const data = getInvoiceData(formSnapshot, invoiceDataOptions(mode));
      const { editMode } = formSnapshot.settings;
      if (editMode.active) {
        const paymentErrors = getPaymentEditErrors(data, editMode.data);
        if (paymentErrors.length) {
          for (const err of paymentErrors) {
            const currency =
              data.currency ?? appConfig.get('invoice.currency');
            const values = err.values
              ? {
                  ...err.values,
                  total: formatNumber(
                    err.values.total,
                    currency.fraction ?? 2,
                    currency.separator
                  ),
                  paid: formatNumber(
                    err.values.paid,
                    currency.fraction ?? 2,
                    currency.separator
                  ),
                }
              : undefined;
            toast.add({
              title: i18n.t(err.key, values),
              type: 'warning',
            });
          }
          return false;
        }
      }
      let ok;
      if (editMode.active) {
        ok = await dispatch(InvoicesActions.updateInvoice(data));
      } else {
        ok = await dispatch(InvoicesActions.saveInvoice(data));
      }
      if (ok === false) {
        return;
      }

      const persisted =
        typeof ok === 'object' && ok !== null && ok._id ? ok : null;
      const savedBase = persisted ?? data;

      if (!editMode.active) {
        const numberingBase = resolveStoredNumbering(
          getState().form.reconciledNumbering,
          appConfig.get('invoice.numbering')
        );
        const advancedNumbering = advanceNumbering(
          numberingBase,
          data.invoiceID
        );
        try {
          appConfig.set('invoice.numbering', advancedNumbering);
          dispatch({ type: ACTION_TYPES.FORM_CLEAR_RECONCILED_NUMBERING });
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
        const contactAlreadyOnInvoice =
          editMode.active && editMode.data?.recipient?._id;
        if (!contactAlreadyOnInvoice) {
          const contactErrors = getRecipientErrors(
            formSnapshot.recipient,
            'final'
          );
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
      }

      if (
        editMode.active &&
        editMode.data.status === 'draft' &&
        mode === 'final'
      ) {
        ipc.send('preview-invoice', data);
      }

      const afterSave = getState().form;
      const sameForm = (afterSave.formGeneration ?? 0) === startGeneration;

      if (editMode.active && sameForm) {
        dispatch(UIActions.changeActiveTab('invoices'));
      }

      if (!sameForm) {
        return;
      }

      if (
        formSnapshot.settings.editMode.active &&
        !afterSave.settings.editMode.active
      ) {
        return;
      }

      if (afterSave.formRevision !== startRevision) {
        if (
          formSnapshot.settings.editMode.active &&
          !afterSave.settings.editMode.active
        ) {
          return;
        }
        const merged = getInvoiceData(
          {
            ...afterSave,
            settings: {
              ...afterSave.settings,
              editMode: { active: true, data: savedBase },
            },
          },
          { mode, ...invoiceDataOptions(mode) }
        );
        dispatch({
          type: ACTION_TYPES.FORM_ATTACH_SAVED_INVOICE,
          payload: merged,
        });
        return;
      }

      if (
        editMode.active &&
        afterSave.settings.editMode.active &&
        persisted &&
        afterSave.formRevision === startRevision
      ) {
        dispatch({
          type: ACTION_TYPES.FORM_ATTACH_SAVED_INVOICE,
          payload: getInvoiceData(
            {
              ...afterSave,
              settings: {
                ...afterSave.settings,
                editMode: { active: true, data: persisted },
              },
            },
            { mode, ...invoiceDataOptions(mode) }
          ),
        });
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
    } finally {
      endWrite();
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
  if (
    !form.errors ||
    !Object.keys(form.errors).length ||
    form.errorMode == null
  ) {
    return action;
  }
  dispatch(
    FormActions.setFormErrors(
      getFormErrors(form, form.errorMode),
      form.errorMode
    )
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
        const result = next(
          Object.assign({}, action, {
            payload: { id: crypto.randomUUID() },
          })
        );
        syncLineTaxRows(dispatch, getState);
        return result;
      }

      case ACTION_TYPES.FORM_TAX_MODE_SET: {
        const result = next(action);
        if (action.payload === 'line') {
          syncLineTaxRows(dispatch, getState, { overwriteAll: true });
        }
        refreshErrorsIfNeeded({ dispatch, getState }, action);
        return result;
      }

      case ACTION_TYPES.FORM_FIELD_TOGGLE: {
        const result = next(action);
        if (action.payload === 'tax') {
          syncLineTaxRows(dispatch, getState);
        }
        refreshErrorsIfNeeded({ dispatch, getState }, action);
        return result;
      }

      case ACTION_TYPES.FORM_CLEAR: {
        dispatch(FormActions.closeFormSettings());
        next(action);
        dispatch(FormActions.addItem());
        dispatch(
          FormActions.updateFieldData(
            'invoiceID',
            suggestedInvoiceNumberForForm(getState().form)
          )
        );
        syncLineTaxRows(dispatch, getState);
        break;
      }

      case ACTION_TYPES.FORM_LOAD_DUPLICATE: {
        const result = next(action);
        dispatch(
          FormActions.updateFieldData(
            'invoiceID',
            suggestedInvoiceNumberForForm(getState().form)
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
        if (isImportWriteLocked()) {
          dispatch({
            type: ACTION_TYPES.UI_NOTIFICATION_NEW,
            payload: {
              type: 'warning',
              message: i18n.t(importWriteLockReason()),
            },
          });
          return;
        }
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
