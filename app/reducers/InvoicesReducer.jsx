import { handleActions, combineActions } from 'redux-actions';
import * as Actions from '../actions/invoices';
import { getDisplayStatus } from '../helpers/invoice';

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

export const getInvoices = state => state.invoices;

export const getOverdueCount = (state, now = Date.now()) =>
  state.invoices.filter(inv => getDisplayStatus(inv, now) === 'overdue').length;
