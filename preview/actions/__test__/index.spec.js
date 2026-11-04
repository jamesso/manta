import * as ACTION_TYPES from '../../constants/actions.jsx';
import * as actions from '../index.jsx';

it('updateInvoice should create INVOICE_UPDATE action', () => {
  const invoiceData = { test: 'test' };
  expect(actions.updateInvoice(invoiceData)).toEqual({
    type: ACTION_TYPES.INVOICE_UPDATE,
    payload: invoiceData,
  });
});

it('updateCoordinatedPreview should create PREVIEW_COORDINATED_UPDATE action', () => {
  const payload = { requestId: 'r1', invoice: { _id: 'x' } };
  expect(actions.updateCoordinatedPreview(payload)).toEqual({
    type: ACTION_TYPES.PREVIEW_COORDINATED_UPDATE,
    payload,
  });
});
