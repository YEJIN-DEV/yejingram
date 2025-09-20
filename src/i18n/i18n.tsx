import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.tsx';
import ko from './locales/ko.tsx';
import ja from './locales/ja.tsx';

// the translations
// (tip move them in a JSON file and import them,
// or even better, manage them separated from your code: https://react.i18next.com/guides/multiple-translation-files)
const resources = {
    ko: {
        translation: ko
    },
    en: {
        translation: en
    },
    ja: {
        translation: ja
    }
};

i18n
    .use(LanguageDetector) // detect user language
    .use(initReactI18next) // passes i18n down to react-i18next
    .init({
        fallbackLng: "en",
        detection: {
            order: ['navigator', 'localStorage', 'cookie', 'htmlTag'], // Detection order
            caches: ['localStorage'], // Caching detected language
        },
        resources,
        interpolation: {
            escapeValue: false // react already safes from xss
        }
    });

export default i18n;