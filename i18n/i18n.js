import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import moment from 'moment';

const appConfig = window.manta.settings;
const defaultLanguage = appConfig.get('general.language');

// Language Files
import de from './de';
import en from './en';
import fr from './fr';
import id from './id';
import it from './it';
import sk from './sk';
import urPK from './ur-PK';
import vi from './vi';
import zhCN from './zh-CN';

i18n.use(initReactI18next).init({
  initAsync: false,
  lng: defaultLanguage,
  fallbackLng: 'en',
  debug: import.meta.env.DEV,
  defaultNS: 'form',
  resources: {
    de,
    en,
    fr,
    id,
    it,
    sk,
    'ur-PK': urPK,
    vi,
    'zh-CN': zhCN,
  },
  interpolation: {
    function(value, format, lng) {
      if (value instanceof Date) return moment(value).format(format);
      return value;
    },
  },
  react: {
    useSuspense: false,
  },
});

i18n.on('languageChanged', currentLang => {
  moment.locale(currentLang);
});

moment.locale(defaultLanguage);

export default i18n;
