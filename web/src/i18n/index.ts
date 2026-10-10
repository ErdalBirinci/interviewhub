import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import de from "./locales/de.json";
import fr from "./locales/fr.json";
import es from "./locales/es.json";
import tr from "./locales/tr.json";
import ru from "./locales/ru.json";
import ja from "./locales/ja.json";
import zh from "./locales/zh.json";

const resources = {
  en: { translation: en },
  de: { translation: de },
  fr: { translation: fr },
  es: { translation: es },
  tr: { translation: tr },
  ru: { translation: ru },
  ja: { translation: ja },
  zh: { translation: zh },
} as const;

export type SupportedLng = keyof typeof resources;

export const supportedLanguages: { code: SupportedLng; name: string; nativeName: string }[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: supportedLanguages.map((l) => l.code),
    defaultNS: "translation",
    ns: ["translation"],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    detection: {
      // Yalnizca kullanicinin acik secimi (localStorage) oncelikli.
      // Tarayici dili/HTML lang bilerek dinlenmiyor: site varsayilan olarak
      // Ingilizce (fallbackLng) acilir, kullanici isterse dil degistirir ve
      // bu secim localStorage'da kalir.
      order: ["localStorage"],
      caches: ["localStorage"],
      lookupLocalStorage: "ih_lang",
    },
  });

/**
 * <html lang> degerini her dil degisiminde guncelle.
 *
 * index.html varsayilan olarak lang="en" acilir; kullanici dil degistirince
 * ekran okuyucu ile arama motorlari icin de o dil bildirilmeli. Eklenti
 * (extension/src/i18n.ts) ayni seyi panel <html> etiketi icin yapiyor;
 * web tarafinda yoktu: icerik Turkce gorunurken lang="en" kaliyordu.
 */
const syncDocumentLang = (lng?: string) => {
  document.documentElement.lang = lng ?? i18n.resolvedLanguage ?? "en";
};
i18n.on("languageChanged", syncDocumentLang);
syncDocumentLang();

/**
 * Bilesen disinda (hook, util, servis) calisan cevirici.
 * React hook'i degildir; dogrudan i18n orneginden okur.
 * Ornek: translate('media.permissionDenied')
 */
export function translate(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options);
}

export default i18n;