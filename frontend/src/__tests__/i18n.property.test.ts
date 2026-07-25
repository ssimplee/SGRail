/**
 * Property-Based Tests: Internationalisation Fallback
 *
 * Validates: Requirements 27.1, 27.2, 27.3
 *
 * Verifies that the i18n system always returns meaningful translations:
 * - If a key exists in the selected language, it returns the localised value.
 * - If a key is missing from a language, English is returned as fallback.
 * - No key ever returns undefined, empty string, or the raw key itself.
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as fc from "fast-check";
import i18next from "i18next";

// Import JSON files directly (avoids React i18next plugin side-effects)
import en from "../i18n/en.json";
import zh from "../i18n/zh.json";
import ms from "../i18n/ms.json";
import ta from "../i18n/ta.json";

// Flatten nested JSON keys: {nav: {map: "Map"}} → ["nav.map"]
function flattenKeys(
  obj: Record<string, unknown>,
  prefix = ""
): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

// Get a nested value from an object by dot-separated key
function getNestedValue(
  obj: Record<string, unknown>,
  key: string
): unknown {
  const parts = key.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

const allKeys = flattenKeys(en);
const keyArb = fc.constantFrom(...allKeys);
const langArb = fc.constantFrom("en", "zh", "ms", "ta");

const langFiles: Record<string, Record<string, unknown>> = {
  en,
  zh,
  ms,
  ta,
};

// Initialise i18next before tests (mirrors app config without React plugin)
beforeAll(async () => {
  await i18next.init({
    resources: {
      en: { translation: en },
      zh: { translation: zh },
      ms: { translation: ms },
      ta: { translation: ta },
    },
    lng: "en",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  });
});

describe("Property 23: Internationalisation Fallback", () => {
  /**
   * Validates: Requirements 27.1, 27.2
   * All English keys resolve to non-empty strings.
   */
  it("all English keys resolve to non-empty strings", () => {
    fc.assert(
      fc.property(keyArb, (key) => {
        const value = i18next.t(key, { lng: "en" });
        expect(value).toBeDefined();
        expect(typeof value).toBe("string");
        expect(value.length).toBeGreaterThan(0);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Validates: Requirements 27.2, 27.3
   * For any language, if a key exists in that language's file,
   * it returns the correct localised value.
   */
  it("if a key exists in a language file, it returns the correct value", () => {
    fc.assert(
      fc.property(keyArb, langArb, (key, lang) => {
        const expectedValue = getNestedValue(langFiles[lang], key);

        if (expectedValue !== undefined && typeof expectedValue === "string") {
          const translated = i18next.t(key, { lng: lang });
          expect(translated).toBe(expectedValue);
        }
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Validates: Requirements 27.2, 27.3
   * For any language, if a key is MISSING from that language's file,
   * it falls back to the English value.
   */
  it("missing keys fall back to English value", () => {
    fc.assert(
      fc.property(keyArb, langArb, (key, lang) => {
        const langValue = getNestedValue(langFiles[lang], key);
        const enValue = getNestedValue(langFiles["en"], key);

        if (langValue === undefined && enValue !== undefined) {
          const translated = i18next.t(key, { lng: lang });
          expect(translated).toBe(enValue);
        }
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Validates: Requirements 27.1, 27.2, 27.3
   * No key ever returns the raw key string (i.e., untranslated).
   */
  it("no key ever returns the raw key string (untranslated)", () => {
    fc.assert(
      fc.property(keyArb, langArb, (key, lang) => {
        const translated = i18next.t(key, { lng: lang });
        // i18next returns the key itself when translation is missing and no fallback
        expect(translated).not.toBe(key);
        // Also check it's not empty or undefined
        expect(translated).toBeDefined();
        expect(typeof translated).toBe("string");
        expect(translated.length).toBeGreaterThan(0);
      }),
      { numRuns: 50 }
    );
  });
});
