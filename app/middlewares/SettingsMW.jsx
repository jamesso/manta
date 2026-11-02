// Node Libs
const ipc = window.manta.ipc;
const appConfig = window.manta.settings;
import sounds from '../../libs/sounds';
import i18n from '../../i18n/i18n';
import { isEqual } from 'lodash';

// Actions Verbs
import * as ACTION_TYPES from '../constants/actions.jsx';

// Helper
import {
  getRawNumberingErrors,
  getSettingsErrors,
  SETTINGS_SECTIONS,
} from '../helpers/settings';
import {
  isImportWriteLocked,
  importWriteLockReason,
  trackImportWriteStart,
} from '../helpers/importWriteLock';
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
          onboarding: appConfig.get('onboarding') ?? {
            dismissed: false,
            exportedPdf: false,
          },
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

      case ACTION_TYPES.SETTINGS_ONBOARDING_UPDATE: {
        const patch = action.payload || {};
        Object.keys(patch).forEach(key => {
          appConfig.set(`onboarding.${key}`, patch[key]);
        });
        return next(action);
      }

      case ACTION_TYPES.SETTINGS_UPDATE: {
        const { setting, data, imported } = action.payload;
        if (!SETTINGS_SECTIONS.includes(setting)) {
          return next(action);
        }
        if (isImportWriteLocked() && !imported) {
          return {
            ok: false,
            message: i18n.t(importWriteLockReason()),
          };
        }
        let nextData = data;
        if (setting === 'invoice' && !imported) {
          if ('numbering' in data) {
            const rawNumberingErrors = getRawNumberingErrors(data.numbering);
            if (Object.keys(rawNumberingErrors).length) {
              return { ok: false, errors: rawNumberingErrors };
            }
          }
          const storedInvoice = appConfig.get('invoice') ?? {};
          const storedNumbering = normalizeNumbering(storedInvoice.numbering);
          const savedNumbering =
            getState().settings?.saved?.invoice?.numbering ?? {};
          const incomingNumbering =
            'numbering' in data && data.numbering != null
              ? data.numbering
              : storedNumbering;
          nextData = {
            ...storedInvoice,
            ...data,
            numbering: mergeNumbering(
              storedNumbering,
              savedNumbering,
              incomingNumbering
            ),
          };
          const storedRates = storedInvoice.taxRates;
          const incomingRates =
            'taxRates' in nextData ? nextData.taxRates : undefined;
          const storedRev = Number(storedInvoice.taxRatesRevision ?? 0);
          if (
            incomingRates === undefined ||
            isEqual(incomingRates, storedRates)
          ) {
            nextData.taxRates = storedRates;
            nextData.taxRatesRevision = storedRev;
          } else if (Number(nextData.taxRatesRevision ?? 0) !== storedRev) {
            return { ok: false, conflict: 'taxRates' };
          } else {
            nextData.taxRates = incomingRates;
            nextData.taxRatesRevision = storedRev + 1;
          }
        } else if (setting === 'invoice' && imported) {
          const storedInvoice = appConfig.get('invoice') ?? {};
          const storedRev = Number(storedInvoice.taxRatesRevision ?? 0);
          nextData = { ...data };
          if (
            'taxRates' in data &&
            !isEqual(data.taxRates, storedInvoice.taxRates)
          ) {
            nextData.taxRatesRevision = storedRev + 1;
          } else if (!('taxRatesRevision' in nextData)) {
            nextData.taxRatesRevision = storedRev;
          }
        }
        const errors = getSettingsErrors(setting, nextData);
        if (Object.keys(errors).length) {
          return { ok: false, errors };
        }
        const previous = appConfig.get(setting);
        const endWrite = imported ? null : trackImportWriteStart();
        if (!imported && !endWrite) {
          return {
            ok: false,
            message: i18n.t(importWriteLockReason()),
          };
        }
        try {
          appConfig.set(setting, nextData);
        } catch (error) {
          return { ok: false, message: error.message };
        } finally {
          endWrite?.();
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
          payload: { setting, data: nextData, imported: Boolean(imported) },
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
