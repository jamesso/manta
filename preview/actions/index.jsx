import * as ACTION_TYPES from '../constants/actions.jsx';
import { createAction } from 'redux-actions';

export const updateInvoice = createAction(
  ACTION_TYPES.INVOICE_UPDATE,
  invoiceData => invoiceData
);

export const updateCoordinatedPreview = createAction(
  ACTION_TYPES.PREVIEW_COORDINATED_UPDATE,
  payload => payload
);
