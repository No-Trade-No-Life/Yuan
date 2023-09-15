import i18n from 'i18next';
import DetectBrowserLanguage from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .use(DetectBrowserLanguage)
  .use(HttpApi)
  .init({
    // resources,
    debug: true,

    fallbackLng: 'en',
    defaultNS: 'common',

    detection: {
      lookupLocalStorage: 'i18nextLng',
    },
    react: {
      useSuspense: false,
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
  });

export default i18n;
