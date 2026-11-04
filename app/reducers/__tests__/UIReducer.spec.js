import UIReducer from '../UIReducer';
import * as ACTION_TYPES from '../../constants/actions.jsx';

const baseState = {
  activeTab: 'dashboard',
  checkUpdatesMessage: {},
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  shortcutsOpen: false,
  pendingSettingsSection: null,
  recurringSheet: null,
  previewSheet: null,
  listRequest: null,
};

describe('UI Reducer', () => {
  it('should handle initial state', () => {
    expect(UIReducer(undefined, {})).toEqual(baseState);
  });

  it('should handle UI_TAB_CHANGE action', () => {
    const newState = UIReducer(baseState, {
      type: ACTION_TYPES.UI_TAB_CHANGE,
      payload: 'invoices',
    });
    expect(newState.activeTab).toEqual('invoices');
    const dash = UIReducer(baseState, {
      type: ACTION_TYPES.UI_TAB_CHANGE,
      payload: 'dashboard',
    });
    expect(dash.activeTab).toEqual('dashboard');
  });

  it('should handle UI_SIDEBAR_COLLAPSED_SET', () => {
    const newState = UIReducer(baseState, {
      type: ACTION_TYPES.UI_SIDEBAR_COLLAPSED_SET,
      payload: true,
    });
    expect(newState.sidebarCollapsed).toBe(true);
  });

  it('opening command palette closes shortcuts', () => {
    const state = { ...baseState, shortcutsOpen: true };
    const newState = UIReducer(state, {
      type: ACTION_TYPES.UI_COMMAND_PALETTE_SET,
      payload: true,
    });
    expect(newState.commandPaletteOpen).toBe(true);
    expect(newState.shortcutsOpen).toBe(false);
  });

  it('opening shortcuts closes command palette', () => {
    const state = { ...baseState, commandPaletteOpen: true };
    const newState = UIReducer(state, {
      type: ACTION_TYPES.UI_SHORTCUTS_SET,
      payload: true,
    });
    expect(newState.shortcutsOpen).toBe(true);
    expect(newState.commandPaletteOpen).toBe(false);
  });

  it('loads sidebarCollapsed from settings on init', async () => {
    vi.resetModules();
    window.manta.settings.get.mockReturnValueOnce(true);
    const { default: reducer } = await import('../UIReducer.jsx');
    expect(reducer(undefined, {})).toMatchObject({ sidebarCollapsed: true });
  });

  it('UI_LIST_REQUEST opens the page and stores the request', () => {
    const newState = UIReducer(baseState, {
      type: ACTION_TYPES.UI_LIST_REQUEST,
      payload: { page: 'invoices', status: 'draft' },
    });
    expect(newState.activeTab).toBe('invoices');
    expect(newState.listRequest).toEqual({ page: 'invoices', status: 'draft' });
  });

  it('UI_LIST_REQUEST_CLEAR clears the request only', () => {
    const withRequest = {
      ...baseState,
      activeTab: 'contacts',
      listRequest: { page: 'contacts', openId: 'c1' },
    };
    const newState = UIReducer(withRequest, {
      type: ACTION_TYPES.UI_LIST_REQUEST_CLEAR,
    });
    expect(newState.activeTab).toBe('contacts');
    expect(newState.listRequest).toBeNull();
  });

  it('UI_PREVIEW_SHEET_SET opens and closes the preview drawer', () => {
    const doc = { _id: 'inv-1' };
    const opened = UIReducer(baseState, {
      type: ACTION_TYPES.UI_PREVIEW_SHEET_SET,
      payload: doc,
    });
    expect(opened.previewSheet).toBe(doc);
    const closed = UIReducer(opened, {
      type: ACTION_TYPES.UI_PREVIEW_SHEET_SET,
      payload: null,
    });
    expect(closed.previewSheet).toBeNull();
  });
});
