// Node Libs
const ipc = window.manta.ipc;
const appConfig = window.manta.settings;
import sounds from '../../libs/sounds';
import i18n from '../../i18n/i18n';
import { isEqual } from 'lodash';

// Actions Verbs
import * as ACTION_TYPES from '../constants/actions.jsx';

// Helper
import { getSettingsErrors, SETTINGS_SECTIONS } from '../helpers/settings';
import { mergeNumbering, normalizeNumbering } from '../helpers/numbering';
import { toast } from '@/components/ui/toast';

const SettingsMW =
  ({ dispatch, getState }) =>
  next =>
  action => {
    switch (action.type) {
      case ACTION_TYPES.SETTINGS_GET_INITIAL: {
        const savedSettings = {
          profile: appConfig.get('profile'),
          invoice: appConfig.get('invoice'),
          general: appConfig.get('general'),
        };
        return next(
          Object.assign({}, action, {
            payload: {
              current: savedSettings,
              saved: savedSettings,
            },
          })
        );
      }

      case ACTION_TYPES.SETTINGS_UPDATE: {
        const { setting, data } = action.payload;
        if (!SETTINGS_SECTIONS.includes(setting)) {
          return next(action);
        }
        let nextData = data;
        if (setting === 'invoice') {
          nextData = {
            ...data,
            numbering: mergeNumbering(
              normalizeNumbering(appConfig.get('invoice.numbering')),
              getState().settings?.saved?.invoice?.numbering ?? {},
              data.numbering ?? {}
            ),
          };
        }
        const errors = getSettingsErrors(setting, nextData);
        if (Object.keys(errors).length) {
          return { ok: false, errors };
        }
        const previous = appConfig.get(setting);
        try {
          appConfig.set(setting, nextData);
        } catch (error) {
          return { ok: false, message: error.message };
        }
        if (setting === 'profile' && !isEqual(previous, nextData)) {
          ipc.send('change-preview-window-profile', nextData);
        }
        if (setting === 'general') {
          const prevGeneral = previous || {};
          if (prevGeneral.language !== nextData.language) {
            i18n.changeLanguage(nextData.language);
            ipc.send('change-preview-window-language', nextData.language);
          }
          if (prevGeneral.sound !== nextData.sound) {
            sounds.preload();
          }
          if (prevGeneral.theme !== nextData.theme) {
            ipc.send('set-theme', nextData.theme);
          }
        }
        next({
          ...action,
          payload: { setting, data: nextData },
        });
        toast.add({
          id: 'settings-saved',
          title: i18n.t('messages:settings:saved'),
        });
        return { ok: true };
      }

      default: {
        return next(action);
      }
    }
  };

export default SettingsMW;
