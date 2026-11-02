import * as Actions from '../../actions/settings';
import * as ACTION_TYPES from '../../constants/actions.jsx';
import SettingsMW from '../SettingsMW';
import sounds from '../../../libs/sounds';

vi.mock('../../../libs/sounds');
vi.mock('@/components/ui/toast', () => ({
  toast: { add: vi.fn() },
}));

const invoiceBase = {
  template: 'minimal',
  tax: { amount: 0, method: 'default', tin: '' },
  currency: {
    code: 'USD',
    fraction: 2,
    separator: 'commaDot',
    placement: 'before',
  },
  required_fields: {
    invoiceID: false,
    dueDate: false,
    currency: false,
    discount: false,
    tax: false,
    note: false,
  },
  numbering: { prefix: 'INV-', next: 5, padding: 4 },
};

describe('Settings Middleware', () => {
  let next, dispatch, middleware;

  beforeEach(() => {
    next = vi.fn();
    dispatch = vi.fn();
    middleware = SettingsMW({
      dispatch,
      getState: () => ({
        settings: { saved: { invoice: { numbering: invoiceBase.numbering } } },
      }),
    })(next);
    window.manta.settings.get.mockImplementation(key => {
      if (key === 'invoice' || key === 'invoice.numbering') {
        return invoiceBase;
      }
      if (key === 'general') {
        return { language: 'en', theme: 'system', sound: 'default' };
      }
      return 'someSettings';
    });
    window.manta.settings.set.mockImplementation(() => {});
  });

  it('handles SETTINGS_GET_INITIAL', () => {
    middleware(Actions.getInitalSettings());
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ current: expect.any(Object) }),
      })
    );
  });

  it('rejects invalid raw numbering before mergeNumbering', async () => {
    const result = await middleware(
      Actions.updateSettings('invoice', {
        ...invoiceBase,
        numbering: { prefix: 'INV-', next: 'bad', padding: 4 },
      })
    );
    expect(result.ok).toBe(false);
    expect(result.errors['numbering.next']).toBeDefined();
    expect(window.manta.settings.set).not.toHaveBeenCalled();
  });

  it('persists imported invoice numbering without mergeNumbering rewind', async () => {
    const imported = {
      ...invoiceBase,
      numbering: { prefix: 'BILL-', next: 100, padding: 4 },
    };
    const result = await middleware(
      Actions.updateSettings('invoice', imported, true)
    );
    expect(result).toEqual({ ok: true });
    expect(window.manta.settings.set).toHaveBeenCalledWith('invoice', imported);
  });

  it('returns write errors without calling next', async () => {
    window.manta.settings.set.mockImplementation(() => {
      throw new Error('disk full');
    });
    const result = await middleware(
      Actions.updateSettings('general', {
        language: 'en',
        theme: 'system',
        sound: 'default',
        muted: false,
        previewPDF: true,
      })
    );
    expect(result).toEqual({ ok: false, message: 'disk full' });
    expect(next).not.toHaveBeenCalled();
  });

  it('reloads sounds when sound changes', async () => {
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
