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
import * as EstimateActions from '../actions/estimates';

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
import { isCreditNote, listTabFor } from '../helpers/docType';
import { validateCreditTotal } from '../helpers/creditNotes';
import { getStoredStatus } from '../helpers/invoice';
import { runInvoiceMutationQueued } from '../helpers/invoiceMutations';
import {
  buildLinkIndex,
  canConvert,
  normalizeValidDays,
} from '../helpers/estimate';
import { getAllDocs, saveDoc, updateDoc } from '../helpers/pouchDB';
import { settleCreditedInvoiceInDb } from '../helpers/creditNoteSettlement';
import { formatNumber } from '../../helpers/formatNumber';
import { toast } from '@/components/ui/toast';
import {
  isImportWriteLocked,
  importWriteLockReason,
  trackImportWriteStart,
} from '../helpers/importWriteLock';
import {
  advanceNumbering,
  defaultNumberingFor,
  normalizeNumbering,
  numberingKeyFor,
  resolveStoredNumbering,
  suggestedInvoiceNumberFromReconciled,
} from '../helpers/numbering';

function suggestedInvoiceNumberForForm(form) {
  const docType = form.docType || 'invoice';
  const key = numberingKeyFor(docType);
  return suggestedInvoiceNumberFromReconciled(
    form.reconciledNumbering,
    appConfig.get(`invoice.${key}`)
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
  const legacyRate = overwriteAll ? matchLegacyTaxRate(form.tax, rates) : null;
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
    estimateValidDays: normalizeValidDays(
      appConfig.get('invoice.estimateValidDays')
    ),
  };
}

let saveInFlight = null;
const conversionSaveQueues = new Map();

function runConversionQueued(estimateId, fn) {
  const prev = conversionSaveQueues.get(estimateId) || Promise.resolve();
  const next = prev.then(fn, fn).finally(() => {
    if (conversionSaveQueues.get(estimateId) === next) {
      conversionSaveQueues.delete(estimateId);
    }
  });
  conversionSaveQueues.set(estimateId, next);
  return next;
}

function persistedFromDocs(docs, payload) {
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

      const { editMode } = formSnapshot.settings;
      const docType = formSnapshot.docType || 'invoice';
      let ok;
      let savedBase;
      let data;
      let creditSyncFailed = false;

      if (docType === 'creditNote') {
        const writeResult = await runInvoiceMutationQueued(
          formSnapshot.creditedInvoiceId,
          async () => {
            const salesDocs = await getAllDocs('invoices');
            if (editMode.active) {
              const saved = salesDocs.find(d => d._id === editMode.data?._id);
              if (saved && getStoredStatus(saved) !== 'draft') {
                if (getStoredStatus(saved) === 'issued') {
                  try {
                    const fresh = await settleCreditedInvoiceInDb(
                      saved.creditedInvoiceId
                    );
                    dispatch({
                      type: ACTION_TYPES.INVOICE_UPDATE,
                      payload: fresh,
                    });
                    const persisted =
                      fresh.find(d => d._id === saved._id) ?? saved;
                    return { ok: true, persisted, payload: saved };
                  } catch {
                    return {
                      ok: 'partial',
                      persisted: saved,
                      payload: saved,
                      syncFailed: true,
                    };
                  }
                }
                return { ok: false, code: 'issuedCreditNote' };
              }
            }
            const original = salesDocs.find(
              d => d._id === formSnapshot.creditedInvoiceId
            );
            const linked = salesDocs.filter(
              cn =>
                cn.docType === 'creditNote' &&
                cn.creditedInvoiceId === formSnapshot.creditedInvoiceId
            );
            const payload = getInvoiceData(
              formSnapshot,
              invoiceDataOptions(mode)
            );
            const draftPayload = {
              ...payload,
              _id: editMode.active ? editMode.data._id : payload._id,
              _rev: editMode.active ? editMode.data._rev : undefined,
            };
            const code = validateCreditTotal(draftPayload, original, linked);
            if (code) {
              return { ok: false, code };
            }
            const newDocs = editMode.active
              ? await updateDoc('invoices', draftPayload)
              : await saveDoc('invoices', draftPayload);
            let fresh = await getAllDocs('invoices');
            dispatch({ type: ACTION_TYPES.INVOICE_UPDATE, payload: fresh });
            let persisted = persistedFromDocs(newDocs, draftPayload);
            if (draftPayload.status === 'issued') {
              try {
                fresh = await settleCreditedInvoiceInDb(
                  formSnapshot.creditedInvoiceId
                );
                dispatch({ type: ACTION_TYPES.INVOICE_UPDATE, payload: fresh });
                persisted =
                  fresh.find(d => d._id === persisted._id) ?? persisted;
              } catch {
                return {
                  ok: 'partial',
                  persisted,
                  payload: draftPayload,
                  syncFailed: true,
                };
              }
            }
            return { ok: true, persisted, payload: draftPayload };
          }
        );
        if (writeResult?.ok === false) {
          if (writeResult.code === 'issuedCreditNote') {
            toast.add({
              title: i18n.t('invoices:creditNotes:toast:issuedCreditNote', {
                count: 1,
              }),
              type: 'warning',
            });
          } else {
            dispatch(
              FormActions.setFormErrors(
                { creditTotal: `form:errors:${writeResult.code}` },
                mode
              )
            );
            toast.add({
              title: i18n.t(`form:errors:${writeResult.code}`),
              type: 'warning',
            });
          }
          return false;
        }
        if (!writeResult?.persisted) {
          return false;
        }
        ok = writeResult.persisted;
        savedBase = writeResult.persisted;
        data = writeResult.payload;
        creditSyncFailed = writeResult.syncFailed === true;
        if (creditSyncFailed) {
          toast.add({
            title: i18n.t('invoices:creditNotes:errors:syncFailed', {
              defaultValue:
                'Credit note saved, but the invoice could not be updated.',
            }),
            type: 'warning',
          });
        }
      } else {
        let linkedCreditNotes = [];
        if (editMode.active && docType === 'invoice') {
          const salesDocs = await getAllDocs('invoices');
          linkedCreditNotes = salesDocs.filter(
            cn =>
              cn.docType === 'creditNote' &&
              cn.creditedInvoiceId === editMode.data._id
          );
        }
        data = getInvoiceData(formSnapshot, {
          ...invoiceDataOptions(mode),
          linkedCreditNotes,
        });

        if (!editMode.active && data.sourceEstimateId) {
          const allowed = await runConversionQueued(
            data.sourceEstimateId,
            async () => {
              const docs = await getAllDocs('invoices');
              const est = docs.find(d => d._id === data.sourceEstimateId);
              if (est && !canConvert(est, buildLinkIndex(docs))) {
                toast.add({
                  title: i18n.t('estimates:toast:alreadyConverted'),
                  type: 'warning',
                });
                return false;
              }
              return true;
            }
          );
          if (allowed === false) {
            return false;
          }
        }

        if (editMode.active) {
          const salesDocs = await getAllDocs('invoices');
          const linkedCredits = salesDocs.filter(
            cn =>
              cn.docType === 'creditNote' &&
              cn.creditedInvoiceId === editMode.data._id
          );
          const paymentErrors = getPaymentEditErrors(
            data,
            editMode.data,
            linkedCredits
          );
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
        ok = editMode.active
          ? await dispatch(InvoicesActions.updateInvoice(data))
          : await dispatch(InvoicesActions.saveInvoice(data));
        if (ok === false) {
          return;
        }
        savedBase = typeof ok === 'object' && ok !== null && ok._id ? ok : data;
      }

      if (savedBase === undefined) {
        return;
      }

      if (!editMode.active) {
        const docTypeForNumbering = formSnapshot.docType || 'invoice';
        const key = numberingKeyFor(docTypeForNumbering);
        const numberingBase = resolveStoredNumbering(
          getState().form.reconciledNumbering,
          appConfig.get(`invoice.${key}`)
        );
        const advancedNumbering = advanceNumbering(
          normalizeNumbering(
            numberingBase,
            defaultNumberingFor(docTypeForNumbering)
          ),
          data.invoiceID
        );
        try {
          appConfig.set(`invoice.${key}`, advancedNumbering);
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

      if (!editMode.active && data.sourceEstimateId) {
        const docs = await getAllDocs('invoices');
        const est = docs.find(d => d._id === data.sourceEstimateId);
        if (est) {
          const invoiceId = savedBase?._id ?? data._id;
          await dispatch(
            EstimateActions.markEstimateConverted({
              estimateId: data.sourceEstimateId,
              invoiceId,
            })
          );
        }
      }

      if (formSnapshot.recipient.newRecipient && docType !== 'creditNote') {
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
        ipc.send('preview-invoice', savedBase);
      } else if (mode === 'final' && formSnapshot.docType === 'estimate') {
        ipc.send('preview-invoice', savedBase);
      } else if (
        mode === 'final' &&
        formSnapshot.docType === 'creditNote' &&
        savedBase.status === 'issued' &&
        !creditSyncFailed
      ) {
        ipc.send('preview-invoice', savedBase);
      }

      if (creditSyncFailed && savedBase) {
        dispatch({
          type: ACTION_TYPES.FORM_ATTACH_SAVED_INVOICE,
          payload: savedBase,
        });
        return;
      }

      const afterSave = getState().form;
      const sameForm = (afterSave.formGeneration ?? 0) === startGeneration;

      if (editMode.active && sameForm) {
        dispatch(
          UIActions.changeActiveTab(listTabFor(data.docType || 'invoice'))
        );
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
        savedBase &&
        afterSave.formRevision === startRevision
      ) {
        dispatch({
          type: ACTION_TYPES.FORM_ATTACH_SAVED_INVOICE,
          payload: getInvoiceData(
            {
              ...afterSave,
              settings: {
                ...afterSave.settings,
                editMode: { active: true, data: savedBase },
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
        if (!getState().form.settings.editMode.active) {
          dispatch(
            FormActions.updateFieldData(
              'invoiceID',
              suggestedInvoiceNumberForForm(getState().form)
            )
          );
        }
        return result;
      }

      case ACTION_TYPES.FORM_SET_DOC_TYPE: {
        const result = next(action);
        if (!getState().form.settings.editMode.active) {
          dispatch(
            FormActions.updateFieldData(
              'invoiceID',
              suggestedInvoiceNumberForForm(getState().form)
            )
          );
        }
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
