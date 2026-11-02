import { handleActions, combineActions } from 'redux-actions';
import { createSelector } from 'reselect';
import * as Actions from '../actions/invoices';
import {
  getDisplayStatus,
  onlyEstimates,
  onlyInvoices,
} from '../helpers/invoice';

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

export const getOverdueCount = (state, now = Date.now()) =>
  getInvoices(state).filter(inv => getDisplayStatus(inv, now) === 'overdue')
    .length;
