import i18n from 'i18next';
import DetectBrowserLanguage from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend';
import { join } from 'path-browserify';
import { initReactI18next } from 'react-i18next';

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .use(DetectBrowserLanguage)
  .use(HttpApi)
  .init({
    // resources,
    debug: true,

    fallbackLng: {
      'zh-CN': ['zh-Hans', 'en'],
      'zh-Hant': ['zh-Hans', 'en'],
      default: ['en'],
    },
    defaultNS: 'common',

    detection: {
      lookupLocalStorage: 'i18nextLng',
    },
    react: {
      useSuspense: false,
    },
    backend: {
      loadPath: join(import.meta.env.BASE_URL, '/locales/{{lng}}/{{ns}}.json'),
    },
  });

Object.assign(globalThis, { i18n, BASE_URL: import.meta.env.BASE_URL });

export default i18n;
