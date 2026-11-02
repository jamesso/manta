import { handleActions, combineActions } from 'redux-actions';
import { createSelector } from 'reselect';
import * as Actions from '../actions/invoices';
import {
  getDisplayStatus,
  onlyEstimates,
  onlyInvoices,
} from '../helpers/invoice';
import { onlyCreditNotes } from '../helpers/creditNotes';

const InvoicesReducer = handleActions(
  {
    [combineActions(
      Actions.getInvoices,
      Actions.saveInvoice,
      Actions.saveInvoiceConfigs,
      Actions.updateInvoice,
      Actions.deleteInvoice,
      Actions.setInvoiceStatus,
      Actions.restoreInvoices
    )]: (state, action) => action.payload,
  },
  []
);

export default InvoicesReducer;

export const getAllSalesDocs = state => state.invoices;

export const getInvoices = createSelector([getAllSalesDocs], onlyInvoices);

export const getEstimates = createSelector([getAllSalesDocs], onlyEstimates);

export const getCreditNotes = createSelector(
  [getAllSalesDocs],
  onlyCreditNotes
);

export const getInvoicesPageDocs = createSelector([getAllSalesDocs], docs =>
  docs.filter(d => onlyInvoices([d]).length || onlyCreditNotes([d]).length)
);

export const getOverdueCount = (state, now = Date.now()) =>
  getInvoices(state).filter(inv => {
    const credits = getCreditNotes(state).filter(
      cn => cn.creditedInvoiceId === inv._id
    );
    return getDisplayStatus(inv, now, credits) === 'overdue';
  }).length;
