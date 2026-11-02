import * as Actions from '../../actions/settings';
import * as ACTION_TYPES from '../../constants/actions.jsx';
import SettingsMW from '../SettingsMW';
import i18n from '../../../i18n/i18n';
import sounds from '../../../libs/sounds';

vi.mock('../../../libs/sounds');
vi.mock('@/components/ui/toast', () => ({
  toast: { add: vi.fn() },
}));

describe('Settings Middleware', () => {
  let next, dispatch, middleware;

  beforeEach(() => {
    next = vi.fn();
    dispatch = vi.fn();
    middleware = SettingsMW({
      dispatch,
      getState: () => ({
        settings: {
          saved: {
            invoice: { numbering: { prefix: 'INV-', next: 1, padding: 4 } },
          },
        },
      }),
    })(next);
    window.manta.settings.get.mockImplementation(() => 'someSettings');
    window.manta.settings.set.mockImplementation(() => {});
  });

  it('handles SETTINGS_GET_INITIAL', () => {
    const action = Actions.getInitalSettings();
    middleware(action);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ current: expect.any(Object) }),
      })
    );
  });

  it('persists valid general update', async () => {
    const data = {
      language: 'en',
      sound: 'default',
      muted: false,
      previewPDF: true,
      theme: 'system',
    };
    window.manta.settings.get.mockImplementation(key =>
      key === 'general'
        ? { language: 'en', theme: 'system', sound: 'default' }
        : data
    );
    const action = Actions.updateSettings('general', data);
    const result = await middleware(action);
    expect(result).toEqual({ ok: true });
    expect(window.manta.settings.set).toHaveBeenCalledWith('general', data);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ type: ACTION_TYPES.SETTINGS_UPDATE })
    );
  });

  it('rejects invalid invoice update', async () => {
    const action = Actions.updateSettings('invoice', {
      tax: { amount: -1, method: 'default', tin: '' },
      currency: {
        code: 'USD',
        fraction: 2,
        separator: 'commaDot',
        placement: 'before',
      },
    });
    const result = await middleware(action);
    expect(result.ok).toBe(false);
    expect(result.errors['tax.amount']).toBeDefined();
    expect(window.manta.settings.set).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('changes language side effects', async () => {
    window.manta.settings.get.mockImplementation(key =>
      key === 'general'
        ? { language: 'en', theme: 'system', sound: 'default' }
        : 'x'
    );
    await middleware(
      Actions.updateSettings('general', {
        language: 'fr',
        theme: 'system',
        sound: 'default',
        muted: false,
        previewPDF: true,
      })
    );
    expect(window.manta.ipc.send).toHaveBeenCalledWith(
      'change-preview-window-language',
      'fr'
    );
  });

  it('reloads sounds when sound changes', async () => {
    window.manta.settings.get.mockImplementation(key =>
      key === 'general'
        ? { language: 'en', theme: 'system', sound: 'default' }
        : 'x'
    );
    await middleware(
      Actions.updateSettings('general', {
        language: 'en',
        theme: 'system',
        sound: 'cs',
        muted: false,
        previewPDF: true,
      })
    );
    expect(sounds.preload).toHaveBeenCalled();
  });
});
