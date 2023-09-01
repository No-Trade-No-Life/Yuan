import { parse } from 'csv-parse/browser/esm/sync';
import i18n from 'i18next';
import DetectBrowserLanguage from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import translations from './translations.csv?raw';

const convertCsvToResource = (data: string[][]) => {
  const [key, ...langs] = data[0];
  const resources: any = {};
  langs.forEach((lang) => {
    resources[lang] = {
      translation: {},
    };
  });
  for (let i = 1; i < data.length; i++) {
    const [key, ...values] = data[i];
    langs.forEach((lang, index) => {
      resources[lang].translation[key] = values[index];
    });
  }
  return resources;
};

const data = parse(translations, { skip_empty_lines: true });
const resources = convertCsvToResource(data);

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .use(DetectBrowserLanguage)
  .init({
    resources,
    debug: true,

    // lng: userLocale,
    // lng: 'en', // language to use, more information here: https://www.i18next.com/overview/configuration-options#languages-namespaces-resources
    // you can use the i18n.changeLanguage function to change the language manually: https://www.i18next.com/overview/api#changelanguage
    // if you're using a language detector, do not define the lng option
    saveMissing: true,
    missingKeyHandler: (lngs, namespace, key, fallbackValue) => {
      console.log('missingKeyHandler', lngs, namespace, key, fallbackValue);
    },

    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    detection: {
      lookupLocalStorage: 'i18nextLng',
    },
  });

export default i18n;
