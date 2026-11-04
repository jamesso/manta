// Libs
import * as ACTION_TYPES from '../constants/actions';
import { createSelector } from 'reselect';
import { handleActions } from 'redux-actions';
import { getDefaultPreviewConfigs } from '../constants/defaultConfigs';
const appConfig = window.manta.settings;
const invoiceSettings = appConfig.get('invoice');
const profileSettings = appConfig.get('profile');
const generalSettings = appConfig.get('general');

const initialState = {
  ui: { language: generalSettings.language },
  invoice: {},
  profile: profileSettings,
  configs: getDefaultPreviewConfigs(invoiceSettings, generalSettings),
};

const RootReducer = handleActions(
  {
    // Plain payload (scripts/pdf-snapshot.mjs, e2e): the invoice and its own
    // configs, rendered with the stored seller profile.
    [ACTION_TYPES.INVOICE_UPDATE]: (state, action) =>
      Object.assign({}, state, {
        invoice: action.payload,
        profile: appConfig.get('profile') ?? state.profile,
        configs: action.payload.configs
          ? action.payload.configs
          : state.configs,
      }),
    // Coordinated PDF job from the main process.
    [ACTION_TYPES.PREVIEW_COORDINATED_UPDATE]: (state, action) => {
      const { invoice, profile, configs, language } = action.payload;
      const invoiceSettingsNow = appConfig.get('invoice');
      const generalSettingsNow = appConfig.get('general');
      return Object.assign({}, state, {
        invoice,
        profile: profile ?? state.profile,
        configs:
          configs ??
          getDefaultPreviewConfigs(invoiceSettingsNow, generalSettingsNow),
        ui: Object.assign({}, state.ui, {
          language: language ?? state.ui.language,
        }),
      });
    },
  },
  initialState
);

export default RootReducer;

// Selectors
const getState = state => state;
export const getConfigs = createSelector(getState, state => state.configs);
export const getInvoice = createSelector(getState, state => state.invoice);
export const getProfile = createSelector(getState, state => state.profile);
export const getUILang = createSelector(getState, state => state.ui.language);
export const getInvoiceLang = createSelector(
  getState,
  state => state.invoice.language
);
