import * as ACTION_TYPES from '../constants/actions.jsx';
import { createAction } from 'redux-actions';

// Get Initial Settings
export const getInitalSettings = createAction(
  ACTION_TYPES.SETTINGS_GET_INITIAL
);

// Update Settings
export const updateSettings = createAction(
  ACTION_TYPES.SETTINGS_UPDATE,
  (setting, data, imported = false) => ({ setting, data, imported })
);

export const updateOnboarding = createAction(
  ACTION_TYPES.SETTINGS_ONBOARDING_UPDATE,
  patch => patch
);
