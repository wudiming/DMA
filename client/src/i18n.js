import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import zhTranslation from './locales/zh.json';
import enTranslation from './locales/en.json';

const resources = {
    zh: {
        translation: zhTranslation
    },
    en: {
        translation: enTranslation
    }
};

const savedLanguage = localStorage.getItem('dma_language') || 'zh';

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: savedLanguage,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false
        },
        react: {
            useSuspense: false
        }
    });

i18n.on('languageChanged', (lng) => {
    localStorage.setItem('dma_language', lng);
});

export default i18n;
