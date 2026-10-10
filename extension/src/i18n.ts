/**
 * Eklenti icin hafif ceviru modulu.
 *
 * Web uygulamasindaki i18next kurulumundan bagimsizdir (eklenti vanilla TS'tir),
 * fakat anahtar adlari ve dil listesi web ile birebir aynidir. Dil tercihi
 * chrome.storage.local'da `ih_lang` anahtariyla tutulur.
 */

import en from "./locales/en.json";
import de from "./locales/de.json";
import fr from "./locales/fr.json";
import es from "./locales/es.json";
import tr from "./locales/tr.json";
import ru from "./locales/ru.json";
import ja from "./locales/ja.json";
import zh from "./locales/zh.json";

export const LANGS = { en, de, fr, es, tr, ru, ja, zh } as const;

export type Lang = keyof typeof LANGS;

export const LANG_CODES = Object.keys(LANGS) as Lang[];

/** Secicilerde gorunen dil adlari (ozel adlar disindaki tum diller yazima uygun). */
export const LANG_NAMES: Record<Lang, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  tr: "Türkçe",
  ru: "Русский",
  ja: "日本語",
  zh: "中文",
};

const STORAGE_KEY = "ih_lang";

let current: Lang = "en";

function isLang(value: unknown): value is Lang {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LANGS, value);
}

export function getLang(): Lang {
  return current;
}

/** Dil degisikliginde cagrilir; UI'i yeniden cevirmek icin kullanilir. */
export function setLangSync(lang: Lang): void {
  current = lang;
}

/** chrome.storage'da kayitli dili okur; yoksa Ingilizce. */
export async function loadLang(): Promise<Lang> {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    if (isLang(data[STORAGE_KEY])) current = data[STORAGE_KEY];
  } catch {
    /* storage erisilemezse varsayilan en */
  }
  return current;
}

export async function saveLang(lang: Lang): Promise<void> {
  current = lang;
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: lang });
  } catch {
    /* yoksay */
  }
}

/**
 * Anahtar dondurur. Parametreler `{ad}` biciminde isimlendirilir.
 * Anahtar bu dilde yoksa Ingilizceye, o da yoksa anahtarin kendisine duser
 * (boylece sessizce bos metin gorunmez).
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = LANGS[current] as Record<string, string>;
  const fallback = LANGS.en as Record<string, string>;
  let text = dict[key] ?? fallback[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}

/**
 * Belge icindeki `data-i18n*` niteliklerine gore metinleri uygular.
 *
 *  - `data-i18n="anahtar"`            -> textContent
 *  - `data-i18n-html="anahtar"`       -> innerHTML (guvenilir sabit metinler)
 *  - `data-i18n-ph="anahtar"`         -> placeholder
 *  - `data-i18n-title="anahtar"`      -> title
 *  - `data-i18n-label="anahtar"`      -> aria-label
 */
export function applyI18n(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n ?? "");
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-html]").forEach((node) => {
    node.innerHTML = t(node.dataset.i18nHtml ?? "");
  });
  root.querySelectorAll<HTMLInputElement>("[data-i18n-ph]").forEach((node) => {
    node.placeholder = t(node.dataset.i18nPh ?? "");
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((node) => {
    node.title = t(node.dataset.i18nTitle ?? "");
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-label]").forEach((node) => {
    node.setAttribute("aria-label", t(node.dataset.i18nLabel ?? ""));
  });
  if (typeof document !== "undefined") document.documentElement.lang = current;
}
