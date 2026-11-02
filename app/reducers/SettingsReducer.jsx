import * as ACTION_TYPES from '../constants/actions.jsx';
import { handleActions } from 'redux-actions';
import { createSelector } from 'reselect';

const SettingsReducer = handleActions(
  {
    [ACTION_TYPES.SETTINGS_GET_INITIAL]: (state, action) => action.payload,
    [ACTION_TYPES.SETTINGS_UPDATE]: (state, action) => {
      const { setting, data } = action.payload;
      return Object.assign({}, state, {
        current: Object.assign({}, state.current, {
          [setting]: data,
        }),
        saved: Object.assign({}, state.saved, {
          [setting]: data,
        }),
      });
    },
  },
  {}
);

export default SettingsReducer;

// Selectors
const getSettingsState = state => state.settings;
export const getCurrentSettings = createSelector(
  getSettingsState,
  settings => settings.current
);

export const getSavedSettings = createSelector(
  getSettingsState,
  settings => settings.saved
);

export const getDateFormat = createSelector(
  getSettingsState,
  settings => settings.saved.invoice.dateFormat
);
