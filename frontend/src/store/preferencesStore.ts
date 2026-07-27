import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SupportedLanguage = "en" | "zh" | "ms" | "ta";

export interface PreferencesStore {
  /** Selected UI language */
  language: SupportedLanguage;
  /** Text scale multiplier (1.0 = normal) */
  textScale: number;
  /** High contrast mode for accessibility */
  highContrast: boolean;
  /** Show colour-blind friendly labels on map */
  colourBlindLabels: boolean;
  /** Reduce motion/animations for accessibility */
  reducedMotion: boolean;
  /** Dark colour theme */
  darkMode: boolean;
  /** Whether location tracking is allowed for journey tracking */
  locationTracking: boolean;

  setLanguage: (lang: SupportedLanguage) => void;
  setTextScale: (scale: number) => void;
  toggleHighContrast: () => void;
  toggleColourBlindLabels: () => void;
  toggleReducedMotion: () => void;
  toggleDarkMode: () => void;
  toggleLocationTracking: () => void;
}

/**
 * Persisted preferences store for user accessibility and language settings.
 * Stored in localStorage under "sgrail-preferences".
 * The i18n module reads this key on init to detect the saved language.
 *
 * Validates: Requirements 27.1, 27.2, 27.3
 */
export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      language: "en",
      textScale: 1.0,
      highContrast: false,
      colourBlindLabels: false,
      reducedMotion: false,
      darkMode: false,
      locationTracking: true,

      setLanguage: (lang) => set({ language: lang }),
      setTextScale: (scale) => set({ textScale: scale }),
      toggleHighContrast: () =>
        set((state) => ({ highContrast: !state.highContrast })),
      toggleColourBlindLabels: () =>
        set((state) => ({ colourBlindLabels: !state.colourBlindLabels })),
      toggleReducedMotion: () =>
        set((state) => ({ reducedMotion: !state.reducedMotion })),
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      toggleLocationTracking: () =>
        set((state) => ({ locationTracking: !state.locationTracking })),
    }),
    {
      name: "sgrail-preferences",
    },
  ),
);
