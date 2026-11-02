import * as ACTION_TYPES from '../constants/actions.jsx';
import { handleActions } from 'redux-actions';

const initialState = {
  invoices: false,
  contacts: false,
  settings: false,
};

const BootstrapReducer = handleActions(
  {
    [ACTION_TYPES.BOOTSTRAP_INVOICES_READY]: state =>
      Object.assign({}, state, { invoices: true }),
    [ACTION_TYPES.BOOTSTRAP_CONTACTS_READY]: state =>
      Object.assign({}, state, { contacts: true }),
    [ACTION_TYPES.BOOTSTRAP_SETTINGS_READY]: state =>
      Object.assign({}, state, { settings: true }),
  },
  initialState
);

export default BootstrapReducer;

export const isBootstrapReady = state =>
  state.bootstrap.invoices &&
  state.bootstrap.contacts &&
  state.bootstrap.settings;
