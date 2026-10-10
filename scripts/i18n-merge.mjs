/**
 * i18n locale birlestirme araci.
 *
 * Kullanim: node scripts/i18n-merge.mjs <lang> [...]
 * Ornek:   node scripts/i18n-merge.mjs tr de fr es ru ja zh
 *
 * Her dil icin web/src/i18n/locales/<lang>.json dosyasina <lang>-new.json
 * icerigini DERIN birleştirir:
 *  - nesneler: anahtar anahtar birlestirilir (mevcut degerler korunur, yeniler eklenir)
 *  - diziler:   indeks indeks birlestirilir
 *  - null:      mevcut deger korunur (sadece olan anahtarlari guncellemek icin)
 *  - string:    ustlar
 *
 * Amac: tek kaynak (en.json) referans alinarak tum dillerin anahtar kumeleri
 * birebir ayni kalsin; eksik anahtari olan dil uretilmesin.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.resolve(here, "..", "web", "src", "i18n", "locales");
const langs = process.argv.slice(2);
if (!langs.length) {
  console.error("Dil belirtilmedi. Ornek: node scripts/i18n-merge.mjs tr de fr es ru ja zh");
  process.exit(1);
}

/** Derin birlestirme: null = mevcut degeri koru */
function deepMerge(target, patch) {
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value === null) continue; // mevcut degeri koru
    if (Array.isArray(value)) {
      const base = Array.isArray(target[key]) ? target[key] : [];
      target[key] = value.map((item, i) => {
        if (item === null) return base[i];
        if (item && typeof item === "object" && base[i] && typeof base[i] === "object") {
          return deepMerge(Array.isArray(base[i]) ? base[i] : { ...base[i] }, item);
        }
        return item;
      });
      continue;
    }
    if (value && typeof value === "object") {
      if (!target[key] || typeof target[key] !== "object" || Array.isArray(target[key])) {
        target[key] = {};
      }
      deepMerge(target[key], value);
      continue;
    }
    target[key] = value;
  }
  return target;
}

/** Nesneyi anahtar sirasina gore yazar (kararlik icin) */
function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = sortDeep(value[k]);
    return out;
  }
  return value;
}

for (const lang of langs) {
  const targetPath = path.join(localesDir, `${lang}.json`);
  const patchPath = path.join(localesDir, `${lang}-new.json`);
  if (!fs.existsSync(patchPath)) {
    console.error(`[${lang}] ${lang}-new.json bulunamadi`);
    process.exitCode = 1;
    continue;
  }
  const target = JSON.parse(fs.readFileSync(targetPath, "utf8"));
  const patch = JSON.parse(fs.readFileSync(patchPath, "utf8"));
  const before = JSON.stringify(target).length;
  deepMerge(target, patch);
  const sorted = sortDeep(target);
  fs.writeFileSync(targetPath, JSON.stringify(sorted, null, 2) + "\n", "utf8");
  const after = JSON.stringify(sorted).length;
  console.log(`[${lang}] birlestirildi: ${before} -> ${after} karakter`);
}
