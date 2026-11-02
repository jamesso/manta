import * as ACTION_TYPES from '../constants/actions.jsx';
import { handleActions } from 'redux-actions';

const initialState = {
  activeTab: 'form',
  checkUpdatesMessage: {},
  sidebarCollapsed: window.manta.settings.get('ui.sidebarCollapsed') === true,
  commandPaletteOpen: false,
  shortcutsOpen: false,
  pendingSettingsSection: null,
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
  },
  initialState
);

export default UIReducer;
