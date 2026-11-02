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
