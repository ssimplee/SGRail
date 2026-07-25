import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  usePreferencesStore,
  type SupportedLanguage,
} from "@/store/preferencesStore";

const LANGUAGE_OPTIONS: { value: SupportedLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
  { value: "ms", label: "Bahasa Melayu" },
  { value: "ta", label: "தமிழ்" },
];

/**
 * Language picker for the Profile page.
 * Updates both i18next language and the persisted preferencesStore.
 *
 * Validates: Requirements 27.1, 27.2, 27.3
 */
export function LanguageSelector() {
  const { i18n, t } = useTranslation();
  const language = usePreferencesStore((s) => s.language);
  const setLanguage = usePreferencesStore((s) => s.setLanguage);

  function handleChange(value: string) {
    const lang = value as SupportedLanguage;
    setLanguage(lang);
    i18n.changeLanguage(lang);
  }

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">{t("profile.language")}</span>
      <Select value={language} onValueChange={handleChange}>
        <SelectTrigger className="w-40" aria-label={t("profile.language")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LANGUAGE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
