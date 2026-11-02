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

  it('handles SETTINGS_GET_INITIAL with onboarding defaults', () => {
    window.manta.settings.get.mockImplementation(key => {
      if (key === 'onboarding') {
        return undefined;
      }
      if (key === 'invoice' || key === 'invoice.numbering') {
        return invoiceBase;
      }
      if (key === 'general') {
        return { language: 'en', theme: 'system', sound: 'default' };
      }
      return 'someSettings';
    });
    middleware(Actions.getInitalSettings());
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          current: expect.objectContaining({
            onboarding: { dismissed: false, exportedPdf: false },
          }),
        }),
      })
    );
  });

  it('persists onboarding patch to the settings store', () => {
    const store = new Map();
    window.manta.settings.set.mockImplementation((key, value) => {
      store.set(key, value);
    });
    middleware(Actions.updateOnboarding({ dismissed: true }));
    expect(store.get('onboarding.dismissed')).toBe(true);
    expect(next).toHaveBeenCalled();
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

  it('rejects null numbering without resetting stored counter', async () => {
    const result = await middleware(
      Actions.updateSettings('invoice', {
        ...invoiceBase,
        numbering: null,
      })
    );
    expect(result.ok).toBe(false);
    expect(result.errors.numbering).toBeDefined();
    expect(window.manta.settings.set).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('persists imported invoice numbering without mergeNumbering rewind', async () => {
    const imported = {
      ...invoiceBase,
      numbering: { prefix: 'BILL-', next: 100, padding: 4 },
    };
    const result = await middleware(
      Actions.updateSettings('invoice', imported, true)
    );
    expect(result).toMatchObject({ ok: true });
    expect(result.data).toEqual({
      ...imported,
      taxRatesRevision: 0,
    });
    expect(window.manta.settings.set).toHaveBeenCalledWith('invoice', {
      ...imported,
      taxRatesRevision: 0,
    });
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

  it('bumps taxRatesRevision and rejects stale taxRates overwrites', async () => {
    const rateA = [
      {
        id: 'standard',
        name: 'Standard',
        rate: 19,
        category: 'S',
        isDefault: true,
        active: true,
        exemptionReason: '',
      },
    ];
    const rateB = [{ ...rateA[0], rate: 7 }];
    let stored = { ...invoiceBase, taxRatesRevision: 0 };

    window.manta.settings.get.mockImplementation(key => {
      if (key === 'invoice' || key === 'invoice.numbering') {
        return key === 'invoice.numbering' ? stored.numbering : stored;
      }
      if (key === 'general') {
        return { language: 'en', theme: 'system', sound: 'default' };
      }
      return 'someSettings';
    });
    window.manta.settings.set.mockImplementation((key, value) => {
      if (key === 'invoice') {
        stored = value;
      }
    });

    let result = await middleware(
      Actions.updateSettings('invoice', {
        ...invoiceBase,
        taxRates: rateA,
        taxRatesRevision: 0,
      })
    );
    expect(result).toMatchObject({ ok: true });
    expect(result.data.taxRates[0].rate).toBe(19);
    expect(stored.taxRatesRevision).toBe(1);

    result = await middleware(
      Actions.updateSettings('invoice', {
        ...stored,
        taxRates: rateB,
        taxRatesRevision: 1,
      })
    );
    expect(result).toMatchObject({ ok: true });
    expect(result.data.taxRates[0].rate).toBe(7);
    expect(stored.taxRatesRevision).toBe(2);

    result = await middleware(
      Actions.updateSettings('invoice', {
        ...invoiceBase,
        taxRates: rateA,
        taxRatesRevision: 0,
        template: 'business',
      })
    );
    expect(result).toEqual({ ok: false, conflict: 'taxRates' });
    expect(stored.taxRates[0].rate).toBe(7);
    expect(stored.template).toBe('minimal');

    result = await middleware(
      Actions.updateSettings('invoice', { template: 'business' })
    );
    expect(result).toMatchObject({ ok: true });
    expect(result.data.template).toBe('business');
    expect(stored.taxRates[0].rate).toBe(7);
    expect(stored.taxRatesRevision).toBe(2);
  });
});
