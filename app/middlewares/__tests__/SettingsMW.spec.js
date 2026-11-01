// Libs
import * as Actions from '../../actions/settings';
import * as ACTION_TYPES from '../../constants/actions.jsx';
import SettingsMW from '../SettingsMW';
import i18n from '../../../i18n/i18n';
import sounds from '../../../libs/sounds';
import openDialog from '../../renderers/dialog';
import { validateCurrency, validateTax } from '../../helpers/form.js';

// Mocking
vi.mock('../../../libs/sounds');
vi.mock('../../helpers/form');

describe('Settings Middleware', () => {
  let next, dispatch, middleware;
  beforeEach(() => {
    next = vi.fn();
    dispatch = vi.fn();
    middleware = SettingsMW({ dispatch })(next);
  });

  it('should handle SETTINGS_GET_INITIAL action', () => {
    const savedSettings = {
      profile: 'someSettings',
      invoice: 'someSettings',
      general: 'someSettings',
    };
    const action = Actions.getInitalSettings();
    middleware(action);
    expect(dispatch.mock.calls.length).toBe(0);
    expect(next.mock.calls.length).toBe(1);
    expect(next).toHaveBeenCalledWith(
      Object.assign({}, action, {
        payload: {
          current: savedSettings,
          saved: savedSettings,
        },
      })
    );
  });

  describe('should handle SETTINGS_SAVE action', () => {
    let action;
    beforeEach(() => {
      action = Actions.saveSettings({
        profile: 'New Profile',
        general: {
          language: 'fr',
        },
        invoice: {
          currency: {
            code: 'USD',
            fraction: 2,
            separator: 'commaDot',
            placement: 'before',
          },
          tax: {
            tin: '123-456-789',
            amount: 10,
            method: 'default',
          },
        },
      });
    });

    it('should validate currency and tax data', () => {
      middleware(action);
      expect(validateCurrency).toHaveBeenCalled();
      expect(validateCurrency).toHaveBeenCalledWith(
        true,
        action.payload.invoice.currency
      );
      expect(validateTax).toHaveBeenCalled();
      expect(validateTax).toHaveBeenCalledWith(
        true,
        action.payload.invoice.tax
      );
    });

    // TODO
    it('should save data', () => {});

    it('should reload sounds cache', () => {
      middleware(action);
      expect(sounds.preload).toHaveBeenCalled();
    });

    it('sends set-theme only when the theme changes', () => {
      window.manta.settings.get.mockImplementation(key =>
        key === 'general' ? { language: 'fr', theme: 'system' } : 'someSettings'
      );
      const save = theme =>
        middleware(
          Actions.saveSettings({
            ...action.payload,
            general: { language: 'fr', theme },
          })
        );
      window.manta.ipc.send.mockClear();
      save('dark');
      expect(window.manta.ipc.send).toHaveBeenCalledWith('set-theme', 'dark');
      window.manta.ipc.send.mockClear();
      save('system');
      expect(window.manta.ipc.send.mock.calls.map(c => c[0])).not.toContain(
        'set-theme'
      );
      window.manta.settings.get.mockImplementation(() => 'someSettings');
    });

    it('does not change the theme when validation rejects the save', () => {
      const general = { language: 'fr', theme: 'system' };
      window.manta.settings.get.mockImplementation(key =>
        key === 'general' ? general : 'saved'
      );
      validateTax.mockReturnValueOnce(false);
      window.manta.ipc.send.mockClear();
      window.manta.settings.set.mockClear();
      try {
        middleware(
          Actions.saveSettings({
            ...action.payload,
            general: { language: 'fr', theme: 'dark' },
          })
        );
        expect(general.theme).toBe('system');
        expect(window.manta.settings.set).not.toHaveBeenCalled();
        expect(
          window.manta.ipc.send.mock.calls.map(call => call[0])
        ).not.toContain('set-theme');
      } finally {
        window.manta.settings.get.mockImplementation(() => 'someSettings');
      }
    });

    it('does not change the theme when a settings write throws', () => {
      const general = { language: 'fr', theme: 'system' };
      window.manta.settings.get.mockImplementation(key =>
        key === 'general' ? general : 'saved'
      );
      window.manta.settings.set.mockImplementation(key => {
        if (key === 'general') throw new Error('disk full');
      });
      window.manta.ipc.send.mockClear();
      try {
        expect(() =>
          middleware(
            Actions.saveSettings({
              ...action.payload,
              general: { language: 'fr', theme: 'dark' },
            })
          )
        ).toThrow('disk full');
        expect(general.theme).toBe('system');
        expect(
          window.manta.ipc.send.mock.calls.map(call => call[0])
        ).not.toContain('set-theme');
      } finally {
        window.manta.settings.set.mockReset();
        window.manta.settings.get.mockImplementation(() => 'someSettings');
      }
    });

    it('should notify previewWindow of language & profile change', () => {
      // Clear calls count
      window.manta.ipc.send.mockClear();
      middleware(action);
      expect(window.manta.ipc.send).toHaveBeenCalled();
      expect(window.manta.ipc.send.mock.calls.length).toEqual(2);
      // Notify about profile change
      expect(window.manta.ipc.send.mock.calls[0][0]).toBe(
        'change-preview-window-profile'
      );
      expect(window.manta.ipc.send.mock.calls[0][1]).toBe('New Profile');
      // Notify about UI Lang change
      expect(window.manta.ipc.send.mock.calls[1][0]).toBe(
        'change-preview-window-language'
      );
      expect(window.manta.ipc.send.mock.calls[1][1]).toBe('fr');
    });

    it('should call next and dispatch notification', () => {
      middleware(action);
      // Call Next
      expect(next.mock.calls.length).toBe(1);
      expect(next).toHaveBeenCalledWith(action);
      // Send Notification
      expect(dispatch.mock.calls.length).toBe(1);
      expect(dispatch).toHaveBeenCalledWith({
        type: ACTION_TYPES.UI_NOTIFICATION_NEW,
        payload: {
          type: 'success',
          message: i18n.t('messages:settings:saved'),
        },
      });
    });
  });

  it('let other actions pass through', () => {
    const action = { type: 'TEST' };
    middleware(action);
    expect(next).toHaveBeenCalledWith(action);
  });
});
