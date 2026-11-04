import * as ACTION_TYPES from '../../constants/actions.jsx';
import { faker } from '@faker-js/faker';
import RootReducer, {
  getConfigs,
  getInvoice,
  getProfile,
  getUILang,
  getInvoiceLang,
} from '../index.jsx';

describe('RootReducer should', () => {
  it('handle INVOICE_UPDATE action', () => {
    const currentState = {
      invoice: {},
      configs: {},
    };
    const newState = RootReducer(currentState, {
      type: ACTION_TYPES.INVOICE_UPDATE,
      payload: {
        invoice: 'invoice',
        configs: 'configs',
      },
    });
    expect(newState.invoice).toEqual({
      invoice: 'invoice',
      configs: 'configs',
    });
    expect(newState.configs).toEqual('configs');
  });

  it('handle PREVIEW_COORDINATED_UPDATE action', () => {
    const currentState = {
      ui: { language: 'en' },
      invoice: {},
      profile: 'Profile',
      configs: {},
    };
    const newState = RootReducer(currentState, {
      type: ACTION_TYPES.PREVIEW_COORDINATED_UPDATE,
      payload: {
        requestId: 'r1',
        invoice: { _id: 'inv-1' },
        profile: 'Snapshot Profile',
        configs: { template: 'business' },
        language: 'fr',
      },
    });
    expect(newState.invoice).toEqual({ _id: 'inv-1' });
    expect(newState.profile).toEqual('Snapshot Profile');
    expect(newState.configs).toEqual({ template: 'business' });
    expect(newState.ui.language).toEqual('fr');
  });
});

describe('Selectors should', () => {
  let state;
  beforeEach(() => {
    state = {
      ui: { language: 'en' },
      configs: { template: 'Business' },
      invoice: { language: 'fr' },
      profile: 'Profile',
    };
  });
  it('getConfigs should return invoice current configs', () => {
    expect(getConfigs(state)).toEqual(state.configs);
  });
  it('getInvoice should return invoice data', () => {
    expect(getInvoice(state)).toEqual(state.invoice);
  });
  it('getProfile should return profile data', () => {
    expect(getProfile(state)).toEqual('Profile');
  });
  it('getUILang should return profile data', () => {
    expect(getUILang(state)).toEqual('en');
  });
  it('getInvoiceLang should return language of the invoice', () => {
    expect(getInvoiceLang(state)).toEqual('fr');
  });
});
