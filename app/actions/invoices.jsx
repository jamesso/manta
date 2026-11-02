import * as ACTION_TYPES from '../constants/actions.jsx';
import { createAction } from 'redux-actions';

export const getInvoices = createAction(ACTION_TYPES.INVOICE_GET_ALL);

export const saveInvoice = createAction(
  ACTION_TYPES.INVOICE_SAVE,
  invoiceData => invoiceData
);

export const duplicateInvoice = createAction(
  ACTION_TYPES.INVOICE_DUPLICATE,
  invoiceData => invoiceData
);

export const newInvoiceFromContact = createAction(
  ACTION_TYPES.INVOICE_NEW_FROM_CONTACT,
  contact => contact
);

export const deleteInvoice = createAction(
  ACTION_TYPES.INVOICE_DELETE,
  /** @param {string|string[]} invoiceID */
  invoiceID => invoiceID
);

export const editInvoice = createAction(
  ACTION_TYPES.INVOICE_EDIT,
  invoiceData => invoiceData
);

export const updateInvoice = createAction(
  ACTION_TYPES.INVOICE_UPDATE,
  updatedInvoice => updatedInvoice
);

export const setInvoiceStatus = createAction(
  ACTION_TYPES.INVOICE_SET_STATUS,
  (invoiceID, status) => ({ invoiceID, status })
);

export const saveInvoiceConfigs = createAction(
  ACTION_TYPES.INVOICE_CONFIGS_SAVE,
  (invoiceID, configs) => ({ invoiceID, configs })
);

export const restoreInvoices = createAction(
  ACTION_TYPES.INVOICE_RESTORE,
  docs => docs
);

export const recordPayment = createAction(
  ACTION_TYPES.INVOICE_PAYMENT_ADD,
  (invoiceID, payment) => ({ invoiceID, payment, fullBalance: false })
);

export const recordFullPayment = createAction(
  ACTION_TYPES.INVOICE_PAYMENT_ADD,
  (invoiceIDOrIDs, payment = {}) => ({
    invoiceID: invoiceIDOrIDs,
    payment,
    fullBalance: true,
  })
);

export const removePayment = createAction(
  ACTION_TYPES.INVOICE_PAYMENT_REMOVE,
  (invoiceID, paymentId) => ({ invoiceID, paymentId })
);
