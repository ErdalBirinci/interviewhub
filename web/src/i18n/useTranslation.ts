import { useTranslation as useI18nextTranslation } from "react-i18next";
import { supportedLanguages, type SupportedLng } from "./index";

/** i18n hook with type-safe keys */
export function useTranslation() {
  const { t, i18n } = useI18nextTranslation();

  const changeLanguage = (lng: SupportedLng) => {
    i18n.changeLanguage(lng);
  };

  const currentLanguage = i18n.language as SupportedLng;
  const currentLanguageInfo = supportedLanguages.find((l) => l.code === currentLanguage);

  return {
    t,
    i18n,
    changeLanguage,
    currentLanguage,
    currentLanguageInfo,
    supportedLanguages,
    isRTL: false, // none of our languages are RTL
  };
}

/** Type-safe translation key helper (for IDE autocomplete) */
export type TranslationKey = keyof typeof import("./locales/en.json");

export function useT() {
  const { t } = useTranslation();
  return t;
}