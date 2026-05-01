import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import commonEn from './locales/en/common.json';
import landingEn from './locales/en/landing.json';
import pricingEn from './locales/en/pricing.json';
import systemEn from './locales/en/system.json';

import commonAz from './locales/az/common.json';
import landingAz from './locales/az/landing.json';
import pricingAz from './locales/az/pricing.json';
import systemAz from './locales/az/system.json';

import commonRu from './locales/ru/common.json';
import landingRu from './locales/ru/landing.json';
import pricingRu from './locales/ru/pricing.json';
import systemRu from './locales/ru/system.json';

import commonTr from './locales/tr/common.json';
import landingTr from './locales/tr/landing.json';
import pricingTr from './locales/tr/pricing.json';
import systemTr from './locales/tr/system.json';

const resources = {
  en: {
    common: commonEn,
    landing: landingEn,
    pricing: pricingEn,
    system: systemEn,
  },
  az: {
    common: commonAz,
    landing: landingAz,
    pricing: pricingAz,
    system: systemAz,
  },
  ru: {
    common: commonRu,
    landing: landingRu,
    pricing: pricingRu,
    system: systemRu,
  },
  tr: {
    common: commonTr,
    landing: landingTr,
    pricing: pricingTr,
    system: systemTr,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    ns: ['common', 'landing', 'pricing', 'system'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
