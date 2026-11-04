import * as ACTION_TYPES from '../constants/actions.jsx';
import { createAction } from 'redux-actions';

export const changeActiveTab = createAction(
  ACTION_TYPES.UI_TAB_CHANGE,
  tabName => tabName
);

export const checkUpdatesMessage = createAction(
  ACTION_TYPES.UI_CHECK_UPDATES_MESSAGE,
  (content, type) => ({
    content,
    type,
  })
);

export const newNoti = createAction(
  ACTION_TYPES.UI_NOTIFICATION_NEW,
  (messageType, messageContent) => ({
    type: messageType,
    message: messageContent,
  })
);

export const newInvoice = createAction(ACTION_TYPES.UI_NEW_INVOICE);

export const newEstimate = createAction(ACTION_TYPES.UI_NEW_ESTIMATE);

// Leave the editor without saving: asks first when changes would be lost.
export const closeForm = createAction(ACTION_TYPES.UI_FORM_CLOSE);

export const setSidebarCollapsed = createAction(
  ACTION_TYPES.UI_SIDEBAR_COLLAPSED_SET,
  v => v
);

export const setCommandPalette = createAction(
  ACTION_TYPES.UI_COMMAND_PALETTE_SET,
  v => v
);

export const setShortcutsDialog = createAction(
  ACTION_TYPES.UI_SHORTCUTS_SET,
  v => v
);

export const requestSettingsSection = createAction(
  ACTION_TYPES.UI_SETTINGS_SECTION_REQUEST,
  section => section
);

export const clearSettingsSectionRequest = createAction(
  ACTION_TYPES.UI_SETTINGS_SECTION_CLEAR
);

export const setRecurringSheet = createAction(
  ACTION_TYPES.UI_RECURRING_SHEET_SET,
  v => v
);

// Open the preview drawer for a saved document, or close it with null.
export const previewInvoice = createAction(
  ACTION_TYPES.UI_PREVIEW_SHEET_SET,
  doc => doc ?? null
);

// Opens a list page and asks it to apply filters or open a record.
// request: { status?, query?, openId? }
export const openList = createAction(
  ACTION_TYPES.UI_LIST_REQUEST,
  (page, request = {}) => ({ page, ...request })
);

export const clearListRequest = createAction(
  ACTION_TYPES.UI_LIST_REQUEST_CLEAR
);
