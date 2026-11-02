import * as ACTION_TYPES from '../../constants/actions';
import * as actions from '../ui';

it('changeActiveTab should create UI_TAB_CHANGE action', () => {
  expect(actions.changeActiveTab('form')).toEqual({
    type: ACTION_TYPES.UI_TAB_CHANGE,
    payload: 'form',
  });
});

it('newNoti should create UI_NOTIFICATION_NEW action', () => {
  expect(actions.newNoti('warning', 'Missing Doc')).toEqual({
    type: ACTION_TYPES.UI_NOTIFICATION_NEW,
    payload: { type: 'warning', message: 'Missing Doc' },
  });
});

it('newInvoice should create UI_NEW_INVOICE action', () => {
  expect(actions.newInvoice()).toEqual({
    type: ACTION_TYPES.UI_NEW_INVOICE,
    payload: undefined,
  });
});
