// Node Libs
import currencies from '../../libs/currencies.json';
import i18n from '../../i18n/i18n';
import { omit } from 'lodash';

// Actions & Verbs
import * as ACTION_TYPES from '../constants/actions.jsx';
import * as UIActions from '../actions/ui';
import * as FormActions from '../actions/form';
import * as Actions from '../actions/invoices';

// Helpers
import { INVOICE_STATUSES, UNDO_TIMEOUT_MS } from '../constants/invoices';
import { ESTIMATE_SETTABLE_STATUSES } from '../constants/estimates';
import {
  buildLinkIndex,
  canConvert,
  estimateToInvoiceDraft,
  isSettableStatus,
  withConversion,
  markInvoiceDeletedForUndo,
  clearInvoiceDeletedForUndo,
} from '../helpers/estimate';
import { isEstimate, isInvoice, isCreditNote } from '../helpers/docType';
import {
  getInvoiceNumber,
  getStoredStatus,
  withStatus,
} from '../helpers/invoice';
import { withSentMark } from '../helpers/emailDraft';
import {
  assignNumberIfMissing,
  normalizeNumbering,
} from '../helpers/numbering';
import {
  numberingCountersEqual,
  persistInvoiceNumberingCounter,
  resolveInvoiceNumberingForAllocation,
  runInvoiceNumberingWrite,
} from '../helpers/invoiceNumberingWrites';
import { buildSellerSnapshot } from '../helpers/tax';
import { buildRecurringTombstone } from '../helpers/recurring';
import { runInvoiceMutationQueued } from '../helpers/invoiceMutations';
import {
  buildCreditNoteDraft,
  canCreateCreditNote,
  groupCreditNotesByInvoice,
  partitionDeletable,
  resolveStatusAfterCredit,
  validateCreditTotal,
} from '../helpers/creditNotes';
import { settleCreditedInvoiceInDb } from '../helpers/creditNoteSettlement';
import {
  getPaymentEditErrors,
  reconcilePaymentStatus,
} from '../helpers/payments';
import {
  addPaymentToDoc,
  markDocPaidInFull,
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
  bulkSaveDocs,
  restoreDocs,
  updateDocs,
  deleteDoc,
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

let invoiceListRefresh = Promise.resolve();

function runPaymentQueued(invoiceId, fn) {
  return runInvoiceMutationQueued(invoiceId, fn);
}

function linkedCreditNotes(allDocs, invoiceId) {
  return allDocs.filter(
    d => isCreditNote(d) && d.creditedInvoiceId === invoiceId
  );
}

function repairInvoicesWithCredits(allDocs, now) {
  const byInvoice = groupCreditNotesByInvoice(allDocs);
  const updates = [];
  for (const inv of allDocs) {
    if (!isInvoice(inv)) {
      continue;
    }
    const linked = byInvoice.get(inv._id) ?? [];
    if (!linked.length) {
      continue;
    }
    const next = resolveStatusAfterCredit(inv, linked, now);
    if (next !== inv) {
      updates.push(next);
    }
  }
  return updates;
}

async function handleSyncCreditedInvoice(
  invoiceId,
  { next, dispatch, getState }
) {
  const allDocs = await getAllDocs('invoices');
  const invoice = allDocs.find(d => d._id === invoiceId);
  if (!invoice) {
    publishInvoiceDocs(next, allDocs);
    return allDocs;
  }
  const linked = linkedCreditNotes(allDocs, invoiceId);
  const updated = resolveStatusAfterCredit(invoice, linked, Date.now());
  if (updated === invoice) {
    publishInvoiceDocs(next, allDocs);
    return allDocs;
  }
  try {
    await updateDocs('invoices', [updated]);
    const fresh = await getAllDocs('invoices');
    publishInvoiceDocs(next, fresh);
    syncEditMode(dispatch, getState, fresh, invoiceId);
    return fresh;
  } catch (err) {
    publishInvoiceDocs(next, allDocs);
    toast.add({
      title: i18n.t('invoices:creditNotes:errors:updateFailed'),
      type: 'warning',
    });
    throw err;
  }
}

function docWithPartialRev(original, err) {
  const saved = Array.isArray(err?.docs)
    ? err.docs.find(doc => doc?._id === original._id)
    : null;
  if (!saved?._rev) {
    return original;
  }
  return { ...original, _rev: saved._rev };
}

function originalsToRestore(err, originals) {
  if (!err || err.message !== 'partial-update') {
    return [];
  }
  const succeeded = Array.isArray(err.succeeded) ? err.succeeded : [];
  const failed = Array.isArray(err.failed) ? err.failed : [];
  if (!succeeded.length || !failed.length) {
    return [];
  }
  const failedIds = new Set(failed.map(item => item?.id ?? item));
  return succeeded
    .filter(id => !failedIds.has(id))
    .map(id => originals.find(doc => doc?._id === id))
    .filter(Boolean)
    .map(doc => docWithPartialRev(doc, err));
}

async function commitCreditNoteWithInvoice(
  ctx,
  originalNote,
  nextNote,
  invoice,
  nextInvoice
) {
  const wroteInvoice = Boolean(invoice && nextInvoice !== invoice);
  const batch = wroteInvoice ? [nextNote, nextInvoice] : [nextNote];
  const originals = wroteInvoice ? [originalNote, invoice] : [originalNote];
  try {
    await updateDocs('invoices', batch);
  } catch (err) {
    const restore = originalsToRestore(err, originals);
    if (restore.length) {
      try {
        await updateDocs('invoices', restore);
      } catch {
        /* do not loop */
      }
    }
    publishInvoiceDocs(ctx.next, await getAllDocs('invoices'));
    toast.add({
      title: i18n.t('invoices:creditNotes:errors:updateFailed'),
      type: 'warning',
    });
    return;
  }
  const fresh = await getAllDocs('invoices');
  publishInvoiceDocs(ctx.next, fresh);
  syncEditMode(ctx.dispatch, ctx.getState, fresh, originalNote._id);
}

async function mutateCreditNoteOnInvoice(creditedInvoiceId, fn) {
  return runInvoiceMutationQueued(creditedInvoiceId, fn);
}

const appConfig = window.manta.settings;

function applySettableInvoiceStatus(doc, status, now, creditNotes, numbering) {
  const { doc: numbered, numbering: nextNumbering } = assignNumberIfMissing(
    doc,
    status,
    numbering
  );
  if (getStoredStatus(numbered) === 'draft' && status === 'paid') {
    const pending = withStatus(numbered, 'pending', now);
    const paid = markDocPaidInFull(pending, now, creditNotes);
    return { ...paid, numbering: nextNumbering };
  }
  const result = setDocStatus(numbered, status, now, creditNotes);
  return { ...result, numbering: nextNumbering };
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

function publishInvoiceDocs(next, allDocs) {
  if (allDocs) {
    next({
      type: ACTION_TYPES.INVOICE_UPDATE,
      payload: allDocs,
    });
  }
}

function finalizeQueuedWrites({ results, next, dispatch, getState }) {
  const committed = results.filter(r => r.committed);
  const failed = results.filter(r => !r.ok);
  const needsListRefresh = results.some(r => r.committed || r.allDocs);

  if (!needsListRefresh) {
    return Promise.resolve({ committed, failed, allDocs: null });
  }

  const refresh = () =>
    getAllDocs('invoices')
      .then(allDocs => {
        publishInvoiceDocs(next, allDocs);
        if (committed.length) {
          syncEditMode(
            dispatch,
            getState,
            allDocs,
            committed.map(r => r.id)
          );
        }
        return { committed, failed, allDocs };
      })
      .catch(err => {
        toast.add({
          title: err.message,
          type: 'warning',
        });
        return { committed, failed, allDocs: null };
      });

  const chained = invoiceListRefresh.then(refresh, refresh);
  invoiceListRefresh = chained;
  return chained;
}

function queuedInvoiceWrite(invoiceId, mutate) {
  return runPaymentQueued(invoiceId, () =>
    Promise.all([getSingleDoc('invoices', invoiceId), getAllDocs('invoices')])
      .then(([doc, allDocs]) => {
        if (!doc) {
          return {
            id: invoiceId,
            ok: false,
            committed: false,
            error: 'notFound',
          };
        }
        const creditNotes = linkedCreditNotes(allDocs, invoiceId);
        const result = mutate(doc, creditNotes);
        if (!result.ok) {
          return {
            id: invoiceId,
            ok: false,
            committed: false,
            error: result.error,
            payment: result.payment,
            stillPaid: result.stillPaid,
          };
        }
        return updateDocs('invoices', [result.doc])
          .then(allDocsAfter => ({
            id: invoiceId,
            ok: true,
            committed: true,
            allDocs: allDocsAfter,
            doc: result.doc,
            payment: result.payment,
            stillPaid: result.stillPaid,
          }))
          .catch(err => ({
            id: invoiceId,
            ok: false,
            committed: false,
            error: 'writeFailed',
            allDocs: err.docs,
            writeErr: err,
          }));
      })
      .catch(() => ({
        id: invoiceId,
        ok: false,
        committed: false,
        error: 'notFound',
      }))
  );
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
          .then(async allDocs => {
            const now = Date.now();
            const repairs = repairInvoicesWithCredits(allDocs, now);
            let payload = allDocs;
            if (repairs.length) {
              try {
                await updateDocs('invoices', repairs);
                payload = await getAllDocs('invoices');
              } catch {
                toast.add({
                  title: i18n.t('invoices:creditNotes:errors:repairFailed'),
                  type: 'warning',
                });
              }
            }
            next(
              Object.assign({}, action, {
                payload,
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
                  message: i18n.t(
                    isEstimate(action.payload)
                      ? 'messages:estimate:draftSaved'
                      : 'messages:invoice:draftSaved'
                  ),
                },
              });
            } else {
              dispatch({
                type: ACTION_TYPES.UI_NOTIFICATION_NEW,
                payload: {
                  type: 'success',
                  message: i18n.t(
                    isEstimate(action.payload)
                      ? 'messages:estimate:saved'
                      : 'messages:invoice:saved'
                  ),
                },
              });
              dispatch(UIActions.previewInvoice(action.payload));
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
        return getSingleDoc('invoices', action.payload._id)
          .then(doc => {
            if (isCreditNote(doc) && getStoredStatus(doc) !== 'draft') {
              toast.add({
                title: i18n.t('invoices:creditNotes:toast:issuedCreditNote', {
                  count: 1,
                }),
                type: 'warning',
              });
              return;
            }
            return getAllDocs('contacts').then(allDocs => {
              next(
                Object.assign({}, action, {
                  payload: Object.assign({}, action.payload, {
                    contacts: allDocs,
                  }),
                })
              );
              dispatch(UIActions.changeActiveTab('form'));
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

      case ACTION_TYPES.INVOICE_DELETE: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return undefined;
        }
        const ids = [...new Set([].concat(action.payload))];
        return runInvoiceMutationQueued('delete-batch', () =>
          getAllDocs('invoices').then(allDocs => {
            const { deletable, blocked } = partitionDeletable(ids, allDocs);
            if (blocked.length) {
              const byReason = blocked.reduce((acc, b) => {
                acc[b.reason] = (acc[b.reason] ?? 0) + 1;
                return acc;
              }, {});
              for (const [reason, count] of Object.entries(byReason)) {
                toast.add({
                  title: i18n.t(`invoices:creditNotes:toast:${reason}`, {
                    count,
                    defaultValue: reason,
                  }),
                  type: 'warning',
                });
              }
            }
            if (!deletable.length) {
              return null;
            }
            return removeDocs('invoices', deletable).then(async result => {
              const tombstones = result.removed
                .filter(doc => doc.recurringId && doc.periodKey)
                .map(doc =>
                  buildRecurringTombstone(doc.recurringId, doc.periodKey)
                );
              if (tombstones.length) {
                try {
                  const { failed, allDocs } = await bulkSaveDocs(
                    'invoices',
                    tombstones
                  );
                  if (failed.length) {
                    throw new Error(failed[0].message || failed[0].name);
                  }
                  return { ...result, docs: allDocs };
                } catch (err) {
                  next({
                    type: ACTION_TYPES.UI_NOTIFICATION_NEW,
                    payload: {
                      type: 'warning',
                      message: err.message,
                    },
                  });
                }
              }
              const docs = await getAllDocs('invoices');
              return { ...result, docs };
            });
          })
        )
          .then(result => {
            if (!result) {
              return;
            }
            const { removed, failed, docs } = result;
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
              for (const doc of removed) {
                if (isInvoice(doc)) {
                  markInvoiceDeletedForUndo(doc);
                }
              }
              const allEstimates = removed.every(isEstimate);
              const toastId = toast.add({
                title: i18n.t(
                  allEstimates
                    ? 'estimates:toast:deleted'
                    : 'invoices:toast:deleted',
                  { count: removed.length }
                ),
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
        return runInvoiceNumberingWrite(async () => {
          for (const doc of action.payload) {
            if (doc.recurringId && doc.periodKey) {
              try {
                await deleteDoc(
                  'invoices',
                  `rec-${doc.recurringId}-${doc.periodKey}`
                );
              } catch {
                /* tombstone may be absent */
              }
            }
          }
          return restoreDocs('invoices', action.payload);
        })
          .then(docs => {
            for (const doc of action.payload) {
              if (isInvoice(doc)) {
                clearInvoiceDeletedForUndo(doc);
              }
            }
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
          getSingleDoc('invoices', action.payload._id).then(doc => {
            if (isCreditNote(doc) && getStoredStatus(doc) !== 'draft') {
              toast.add({
                title: i18n.t('invoices:creditNotes:toast:issuedCreditNote', {
                  count: 1,
                }),
                type: 'warning',
              });
              return;
            }
            return getAllDocs('contacts').then(allDocs => {
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
                    'convertedInvoiceId',
                    'convertedAt',
                    'sourceEstimateId',
                    'validUntil',
                    'sentAt',
                    'remindedAt',
                  ]),
                  { contacts: allDocs }
                ),
              });
              dispatch(UIActions.changeActiveTab('form'));
            });
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
        // List refreshes use the same action type as a single-document save.
        // A list must reach the reducer and must not be written again.
        if (Array.isArray(action.payload)) {
          return next(action);
        }
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return false;
        }
        return getSingleDoc('invoices', action.payload._id)
          .then(existing => {
            if (
              isCreditNote(existing) &&
              getStoredStatus(existing) !== 'draft'
            ) {
              toast.add({
                title: i18n.t('invoices:creditNotes:toast:issuedCreditNote', {
                  count: 1,
                }),
                type: 'warning',
              });
              return false;
            }
            if (!isInvoice(existing)) {
              return updateDoc('invoices', action.payload).then(docs => {
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
              });
            }
            return runInvoiceMutationQueued(existing._id, async () => {
              const allDocs = await getAllDocs('invoices');
              const current =
                allDocs.find(d => d._id === existing._id) ?? existing;
              const linked = linkedCreditNotes(allDocs, existing._id);
              const paymentErrors = getPaymentEditErrors(
                action.payload,
                current,
                linked
              );
              if (paymentErrors.length) {
                for (const err of paymentErrors) {
                  toast.add({
                    title: i18n.t(err.key, err.values),
                    type: 'warning',
                  });
                }
                return false;
              }
              const merged = reconcilePaymentStatus(
                action.payload,
                Date.now(),
                linked
              );
              const docs = await updateDoc('invoices', merged);
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
              return persistedInvoice(docs, merged);
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
            return false;
          })
          .finally(endWrite);
      }

      case ACTION_TYPES.INVOICE_MARK_SENT: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return undefined;
        }
        const { invoiceID, kind } = action.payload;
        return getSingleDoc('invoices', invoiceID)
          .then(doc =>
            updateDoc('invoices', withSentMark(doc, kind, Date.now()))
          )
          .then(docs => {
            next({
              type: ACTION_TYPES.INVOICE_UPDATE,
              payload: docs,
            });
            toast.add({ title: i18n.t('email:toast:markedSent') });
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

      case ACTION_TYPES.INVOICE_CONFIGS_SAVE: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return undefined;
        }
        const { invoiceID, configs } = action.payload;
        return getSingleDoc('invoices', invoiceID)
          .then(doc => {
            if (isCreditNote(doc) && getStoredStatus(doc) !== 'draft') {
              toast.add({
                title: i18n.t('invoices:creditNotes:toast:issuedCreditNote', {
                  count: 1,
                }),
                type: 'warning',
              });
              return;
            }
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

        return Promise.all(
          ids.map(id =>
            queuedInvoiceWrite(id, (doc, creditNotes) => {
              if (!isInvoice(doc)) {
                return { ok: false, error: 'notInvoice' };
              }
              return addPaymentToDoc(doc, paymentInput, {
                fullBalance,
                now,
                creditNotes,
              });
            })
          )
        )
          .then(results =>
            finalizeQueuedWrites({
              results,
              next,
              dispatch,
              getState,
            }).then(({ committed, failed }) => {
              if (!committed.length) {
                toast.add({
                  title: paymentErrorMessage(failed[0]?.error ?? 'notFound'),
                  type: 'warning',
                });
                return false;
              }
              toast.add({
                title: i18n.t('invoices:payments:toast:recorded', {
                  count: committed.length,
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
          )
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
        return queuedInvoiceWrite(invoiceID, (doc, creditNotes) => {
          if (!isInvoice(doc)) {
            return { ok: false, error: 'notInvoice' };
          }
          return removePaymentFromDoc(doc, paymentId, now, creditNotes);
        })
          .then(result =>
            finalizeQueuedWrites({
              results: [result],
              next,
              dispatch,
              getState,
            }).then(({ committed }) => {
              if (!result.ok) {
                toast.add({
                  title: paymentErrorMessage(result.error ?? 'notFound'),
                  type: 'warning',
                });
                return false;
              }
              if (!committed.length) {
                toast.add({
                  title: paymentErrorMessage('writeFailed'),
                  type: 'warning',
                });
                return false;
              }
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
          )
          .finally(endWrite);
      }

      case ACTION_TYPES.INVOICE_SET_STATUS: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return undefined;
        }
        const { invoiceID, status } = action.payload;
        const allowedStatuses = [
          ...INVOICE_STATUSES,
          ...ESTIMATE_SETTABLE_STATUSES,
        ];
        if (!allowedStatuses.includes(status)) {
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

        return getAllDocs('invoices')
          .then(async allDocs => {
            const byId = new Map(allDocs.map(d => [d._id, d]));
            const estimateIds = ids.filter(id => isEstimate(byId.get(id)));
            const invoiceIds = ids.filter(
              id => byId.get(id) && !isEstimate(byId.get(id))
            );
            let results = [];

            for (const id of estimateIds) {
              const result = await queuedInvoiceWrite(id, doc => {
                if (!isSettableStatus(doc, status)) {
                  return { ok: false, error: 'invalidStatus' };
                }
                return { ok: true, doc: { ...doc, status } };
              });
              results.push(result);
            }

            if (invoiceIds.length) {
              const invoiceResults = await runInvoiceNumberingWrite(
                async () => {
                  const initialNumbering =
                    await resolveInvoiceNumberingForAllocation(
                      appConfig,
                      getState().form.reconciledNumbering
                    );
                  let numbering = initialNumbering;
                  const invoiceWriteResults = [];
                  for (const id of invoiceIds) {
                    let numberingAfterAssign = numbering;
                    const result = await queuedInvoiceWrite(
                      id,
                      (doc, creditNotes) => {
                        if (!isSettableStatus(doc, status)) {
                          return { ok: false, error: 'invalidStatus' };
                        }
                        const statusResult = applySettableInvoiceStatus(
                          doc,
                          status,
                          now,
                          creditNotes,
                          numberingAfterAssign
                        );
                        numberingAfterAssign =
                          statusResult.numbering ?? numberingAfterAssign;
                        if (!statusResult.ok) {
                          return statusResult;
                        }
                        let docOut = statusResult.doc;
                        if (
                          isInvoice(doc) &&
                          !isCreditNote(doc) &&
                          getStoredStatus(doc) === 'draft' &&
                          status !== 'draft'
                        ) {
                          docOut = {
                            ...docOut,
                            seller: buildSellerSnapshot(
                              appConfig.get('profile'),
                              appConfig.get('invoice')
                            ),
                          };
                        }
                        return {
                          ok: true,
                          doc: docOut,
                          stillPaid: statusResult.stillPaid,
                          numbering: numberingAfterAssign,
                        };
                      }
                    );
                    if (result.ok && result.committed) {
                      numbering = numberingAfterAssign;
                    }
                    invoiceWriteResults.push(result);
                  }
                  if (
                    invoiceWriteResults.some(r => r.ok && r.committed) &&
                    !numberingCountersEqual(numbering, initialNumbering)
                  ) {
                    await persistInvoiceNumberingCounter(appConfig, numbering, {
                      dispatch,
                      actionTypes: ACTION_TYPES,
                      i18n,
                    });
                  }
                  return invoiceWriteResults;
                }
              );
              results = results.concat(invoiceResults);
            }

            return results;
          })
          .then(results =>
            finalizeQueuedWrites({
              results,
              next,
              dispatch,
              getState,
            }).then(async ({ committed }) => {
              const okResults = results.filter(r => r.ok);
              const failed = results.filter(r => !r.ok);
              if (!committed.length) {
                toast.add({
                  title: paymentErrorMessage(failed[0]?.error ?? 'notFound'),
                  type: 'warning',
                });
                return;
              }
              if (okResults.some(r => r.stillPaid)) {
                toast.add({
                  title: i18n.t('invoices:payments:toast:stillPaid'),
                });
              } else if (ids.length > 1 || committed.length > 1) {
                toast.add({
                  title: i18n.t('invoices:toast:updated', {
                    count: committed.length,
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
          )
          .catch(err => {
            toast.add({
              title: err.message,
              type: 'warning',
            });
          })
          .finally(endWrite);
      }

      case ACTION_TYPES.ESTIMATE_CONVERT: {
        if (warnImportBlocked(dispatch)) {
          return false;
        }
        const runConvert = () =>
          getAllDocs('invoices').then(docs => {
            const est = docs.find(d => d._id === action.payload._id);
            if (!est) {
              toast.add({
                title: i18n.t('estimates:toast:notFound'),
                type: 'warning',
              });
              return false;
            }
            if (!canConvert(est, buildLinkIndex(docs))) {
              toast.add({
                title: i18n.t('estimates:toast:alreadyConverted'),
                type: 'warning',
              });
              return false;
            }
            return getAllDocs('contacts').then(contacts => {
              dispatch({
                type: ACTION_TYPES.FORM_LOAD_DUPLICATE,
                payload: {
                  ...estimateToInvoiceDraft(est),
                  contacts,
                },
              });
              dispatch(UIActions.changeActiveTab('form'));
              return true;
            });
          });

        if (!hasUnsavedFormChanges(getState().form)) {
          return runConvert().catch(err => {
            next({
              type: ACTION_TYPES.UI_NOTIFICATION_NEW,
              payload: { type: 'warning', message: err.message },
            });
            return false;
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
            if (!ok) return false;
            return runConvert();
          })
          .catch(err => {
            next({
              type: ACTION_TYPES.UI_NOTIFICATION_NEW,
              payload: { type: 'warning', message: err.message },
            });
            return false;
          });
      }

      case ACTION_TYPES.ESTIMATE_MARK_CONVERTED: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return false;
        }
        const { estimateId, invoiceId } = action.payload;
        return getSingleDoc('invoices', estimateId)
          .then(doc =>
            updateDoc('invoices', withConversion(doc, invoiceId, Date.now()))
          )
          .then(docs => {
            next({
              type: ACTION_TYPES.INVOICE_UPDATE,
              payload: docs,
            });
            toast.add({
              title: i18n.t('estimates:toast:converted', {
                number: getInvoiceNumber(
                  docs.find(d => d._id === estimateId) ?? { _id: estimateId }
                ),
              }),
            });
            return true;
          })
          .catch(() => {
            toast.add({
              title: i18n.t('estimates:toast:linkFailed'),
              type: 'warning',
            });
            return false;
          })
          .finally(endWrite);
      }

      case ACTION_TYPES.CREDIT_NOTE_NEW_FROM_INVOICE: {
        if (warnImportBlocked(dispatch)) {
          return undefined;
        }
        const loadCreditForm = () =>
          getAllDocs('invoices').then(docs => {
            const invoice = docs.find(d => d._id === action.payload._id);
            if (!invoice) {
              toast.add({
                title: i18n.t('invoices:toast:notFound'),
                type: 'warning',
              });
              return;
            }
            const linked = linkedCreditNotes(docs, invoice._id);
            if (!canCreateCreditNote(invoice, linked)) {
              toast.add({
                title: i18n.t('invoices:creditNotes:errors:notAllowed'),
                type: 'warning',
              });
              return;
            }
            return getAllDocs('contacts').then(contacts => {
              dispatch({
                type: ACTION_TYPES.FORM_LOAD_DUPLICATE,
                payload: {
                  ...buildCreditNoteDraft(invoice, {
                    idFn: () => crypto.randomUUID(),
                  }),
                  contacts,
                },
              });
              dispatch(UIActions.changeActiveTab('form'));
            });
          });

        if (!hasUnsavedFormChanges(getState().form)) {
          return loadCreditForm().catch(err => {
            next({
              type: ACTION_TYPES.UI_NOTIFICATION_NEW,
              payload: { type: 'warning', message: err.message },
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
            return loadCreditForm();
          })
          .catch(err => {
            next({
              type: ACTION_TYPES.UI_NOTIFICATION_NEW,
              payload: { type: 'warning', message: err.message },
            });
          });
      }

      case ACTION_TYPES.CREDIT_NOTE_ISSUE: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return undefined;
        }
        const id = action.payload;
        const ctx = { next, dispatch, getState };
        return getSingleDoc('invoices', id)
          .then(cnPeek => {
            if (!cnPeek?.creditedInvoiceId) {
              toast.add({ title: 'Credit note not found', type: 'warning' });
              return;
            }
            return mutateCreditNoteOnInvoice(
              cnPeek.creditedInvoiceId,
              async () => {
                const docs = await getAllDocs('invoices');
                const cn = docs.find(d => d._id === id);
                if (!cn || !isCreditNote(cn)) {
                  toast.add({
                    title: 'Credit note not found',
                    type: 'warning',
                  });
                  return;
                }
                const stored = cn.status ?? 'draft';
                if (stored === 'issued') {
                  try {
                    await handleSyncCreditedInvoice(cn.creditedInvoiceId, ctx);
                  } catch {
                    /* warned */
                  }
                  return;
                }
                if (stored === 'void') {
                  toast.add({
                    title: i18n.t('invoices:creditNotes:errors:void'),
                    type: 'warning',
                  });
                  return;
                }
                const invoice = docs.find(d => d._id === cn.creditedInvoiceId);
                const linked = linkedCreditNotes(docs, cn.creditedInvoiceId);
                const code = validateCreditTotal(cn, invoice, linked);
                if (code) {
                  toast.add({
                    title: i18n.t(`invoices:creditNotes:errors:${code}`, {
                      defaultValue: i18n.t(`form:errors:${code}`, {
                        defaultValue: code,
                      }),
                    }),
                    type: 'warning',
                  });
                  return;
                }
                const now = Date.now();
                const nextNote = { ...cn, status: 'issued' };
                const nextInvoice = resolveStatusAfterCredit(
                  invoice,
                  linked.map(note => (note._id === cn._id ? nextNote : note)),
                  now
                );
                await commitCreditNoteWithInvoice(
                  ctx,
                  cn,
                  nextNote,
                  invoice,
                  nextInvoice
                );
              }
            );
          })
          .finally(endWrite);
      }

      case ACTION_TYPES.CREDIT_NOTE_VOID: {
        const endWrite = protectWrite(dispatch);
        if (!endWrite) {
          return undefined;
        }
        const id = action.payload;
        const ctx = { next, dispatch, getState };
        return getSingleDoc('invoices', id)
          .then(cnPeek => {
            if (!cnPeek?.creditedInvoiceId) {
              toast.add({ title: 'Credit note not found', type: 'warning' });
              return;
            }
            return mutateCreditNoteOnInvoice(
              cnPeek.creditedInvoiceId,
              async () => {
                const docs = await getAllDocs('invoices');
                const cn = docs.find(d => d._id === id);
                if (!cn || !isCreditNote(cn)) {
                  toast.add({
                    title: 'Credit note not found',
                    type: 'warning',
                  });
                  return;
                }
                const stored = cn.status ?? 'draft';
                if (stored === 'draft') {
                  toast.add({
                    title: i18n.t('invoices:creditNotes:errors:draftVoid'),
                    type: 'warning',
                  });
                  return;
                }
                if (stored === 'void') {
                  try {
                    await handleSyncCreditedInvoice(cn.creditedInvoiceId, ctx);
                  } catch {
                    /* warned */
                  }
                  return;
                }
                const now = Date.now();
                const nextNote = { ...cn, status: 'void', voidedAt: now };
                const invoice = docs.find(d => d._id === cn.creditedInvoiceId);
                const linked = linkedCreditNotes(docs, cn.creditedInvoiceId).map(
                  note => (note._id === cn._id ? nextNote : note)
                );
                const nextInvoice = invoice
                  ? resolveStatusAfterCredit(invoice, linked, now)
                  : invoice;
                await commitCreditNoteWithInvoice(
                  ctx,
                  cn,
                  nextNote,
                  invoice,
                  nextInvoice
                );
              }
            );
          })
          .finally(endWrite);
      }

      case ACTION_TYPES.CREDIT_NOTE_SYNC_INVOICE: {
        return handleSyncCreditedInvoice(action.payload, {
          next,
          dispatch,
          getState,
        });
      }

      default: {
        return next(action);
      }
    }
  };

export default InvoicesMW;
