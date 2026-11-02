import * as ACTION_TYPES from '../constants/actions.jsx';
import { handleActions } from 'redux-actions';
import { createSelector } from 'reselect';

const SettingsReducer = handleActions(
  {
    [ACTION_TYPES.SETTINGS_GET_INITIAL]: (state, action) => action.payload,
    [ACTION_TYPES.SETTINGS_UPDATE]: (state, action) =>
      Object.assign({}, state, {
        current: Object.assign({}, state.current, {
          [action.payload.setting]: action.payload.data,
        }),
      }),
    [ACTION_TYPES.SETTINGS_SAVE]: (state, action) =>
      Object.assign({}, state, {
        saved: action.payload,
      }),
    [ACTION_TYPES.SETTINGS_THEME_SET]: (state, action) => {
      if (!state.current || !state.saved) return state;
      const theme = action.payload;
      return Object.assign({}, state, {
        current: Object.assign({}, state.current, {
          general: Object.assign({}, state.current.general, { theme }),
        }),
        saved: Object.assign({}, state.saved, {
          general: Object.assign({}, state.saved.general, { theme }),
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
