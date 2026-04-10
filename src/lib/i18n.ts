import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from '../locales/en.json';
import mlTranslation from '../locales/ml.json';
import hiTranslation from '../locales/hi.json';
import taTranslation from '../locales/ta.json';

const resources = {
  en: { translation: enTranslation },
  ml: { translation: mlTranslation },
  hi: { translation: hiTranslation },
  ta: { translation: taTranslation }
};

let initialLanguage = 'en';
if (typeof window !== 'undefined') {
  initialLanguage = localStorage.getItem('cir_preferred_language') || 'en';
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false 
    }
  });

i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('cir_preferred_language', lng);
  }
});

export default i18n;
