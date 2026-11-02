import * as ACTION_TYPES from '../constants/actions.jsx';
import { handleActions } from 'redux-actions';

const initialState = {
  activeTab: 'dashboard',
  checkUpdatesMessage: {},
  sidebarCollapsed: window.manta.settings.get('ui.sidebarCollapsed') === true,
  commandPaletteOpen: false,
  shortcutsOpen: false,
  pendingSettingsSection: null,
  recurringSheet: null,
  invoicesTabRequest: null,
};

const UIReducer = handleActions(
  {
    [ACTION_TYPES.UI_CHECK_UPDATES_MESSAGE]: (state, action) =>
      Object.assign({}, state, {
        checkUpdatesMessage: action.payload,
      }),

    [ACTION_TYPES.UI_TAB_CHANGE]: (state, action) =>
      Object.assign({}, state, {
        activeTab: action.payload,
      }),

    [ACTION_TYPES.UI_SIDEBAR_COLLAPSED_SET]: (state, action) =>
      Object.assign({}, state, {
        sidebarCollapsed: Boolean(action.payload),
      }),

    [ACTION_TYPES.UI_COMMAND_PALETTE_SET]: (state, action) =>
      Object.assign({}, state, {
        commandPaletteOpen: Boolean(action.payload),
        shortcutsOpen: action.payload ? false : state.shortcutsOpen,
      }),

    [ACTION_TYPES.UI_SHORTCUTS_SET]: (state, action) =>
      Object.assign({}, state, {
        shortcutsOpen: Boolean(action.payload),
        commandPaletteOpen: action.payload ? false : state.commandPaletteOpen,
      }),

    [ACTION_TYPES.UI_SETTINGS_SECTION_REQUEST]: (state, action) =>
      Object.assign({}, state, {
        pendingSettingsSection: action.payload,
      }),

    [ACTION_TYPES.UI_SETTINGS_SECTION_CLEAR]: (state, action) =>
      Object.assign({}, state, {
        pendingSettingsSection: null,
      }),

    [ACTION_TYPES.UI_RECURRING_SHEET_SET]: (state, action) =>
      Object.assign({}, state, {
        recurringSheet: action.payload,
      }),

    [ACTION_TYPES.UI_INVOICES_TAB_REQUEST]: (state, action) => {
      if (action.payload == null) {
        return Object.assign({}, state, { invoicesTabRequest: null });
      }
      return Object.assign({}, state, {
        activeTab: 'invoices',
        invoicesTabRequest: action.payload,
      });
    },
  },
  initialState
);

export default UIReducer;
