import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./en.json";
import zh from "./zh.json";
import ms from "./ms.json";
import ta from "./ta.json";

/**
 * i18next configuration for SGRail.
 * Supports 4 official languages of Singapore: English, Chinese, Malay, Tamil.
 * Language preference is persisted in localStorage via the preferencesStore.
 *
 * Validates: Requirements 27.1, 27.2, 27.3
 */

/** Read saved language from localStorage (mirrors preferencesStore key) */
function getStoredLanguage(): string {
  try {
    const stored = localStorage.getItem("sgrail-preferences");
    if (stored) {
      const parsed = JSON.parse(stored);
      // Zustand persist stores state under "state" key
      const lang = parsed?.state?.language;
      if (lang && ["en", "zh", "ms", "ta"].includes(lang)) {
        return lang;
      }
    }
  } catch {
    // Ignore parse errors — fall back to English
  }
  return "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
    ms: { translation: ms },
    ta: { translation: ta },
  },
  lng: getStoredLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false, // React already escapes
  },
});

export default i18n;
