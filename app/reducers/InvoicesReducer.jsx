import { handleActions, combineActions } from 'redux-actions';
import * as Actions from '../actions/invoices';

const InvoicesReducer = handleActions(
  {
    [combineActions(
      Actions.getInvoices,
      Actions.saveInvoice,
      Actions.saveInvoiceConfigs,
      Actions.updateInvoice,
      Actions.deleteInvoice,
      Actions.setInvoiceStatus
    )]: (state, action) => action.payload,
  },
  []
);

export default InvoicesReducer;

// Selector
export const getInvoices = state => state.invoices;
