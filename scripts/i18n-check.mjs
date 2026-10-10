/**
 * i18n tutarlilik dogrulamasi — CI ve yerel test icin.
 *
 * Kullanim: node scripts/i18n-check.mjs
 * Cikis kodu 0 = sorun yok, 1 = hata var.
 *
 * Kontrol eder:
 *   1. Tum locale dosyalari gecerli JSON'mu.
 *   2. en.json ile birebir ayni anahtar kumesine sahip mi (eksik/fazla yok).
 *   3. Kaynak kodda kullanilan t("anahtar") degerleri en.json'da mevcut mu
 *      (kullanilan ama tanimlanmamis anahtar = calisma aninda ham metin gosterir).
 *   4. Bos string degeri olan anahtar var mi (ceviri eksik kalmis olabilir).
 *
 * Bu script test:all icine alinmistir; yeni bir anahtar eklenirken bir dili
 * guncellemeyi unutmak artik testi kirar.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const localesDir = path.join(root, "web", "src", "i18n", "locales");
const srcDir = path.join(root, "web", "src");
const master = "en";

const problems = [];
let checkedLocales = 0;

/* --------------------------------- yardimcilar ------------------------------ */

function flat(obj, prefix = "") {
  const out = {};
  for (const [key, value] of Object.entries(obj ?? {})) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        const k = `${full}[${i}]`;
        if (item && typeof item === "object") Object.assign(out, flat(item, k));
        else out[k] = item;
      });
    } else if (value && typeof value === "object") {
      Object.assign(out, flat(value, full));
    } else {
      out[full] = value;
    }
  }
  return out;
}

/** Dizeyi t("anahtar") / t('anahtar') / t(\`anahtar\`) desenlerinden ayiklar. */
const KEY_PATTERN = /\bt\(\s*["'`]([a-zA-Z0-9_.\[\]]+)["'`]/g;

function collectSourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "locales") continue; // JSON'lar burada taranmaz
      out.push(...collectSourceFiles(p));
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

/* ---------------------------------- kontroller ------------------------------ */

if (!fs.existsSync(localesDir)) {
  console.error(`[i18n] locales klasoru yok: ${localesDir}`);
  process.exit(1);
}

const files = fs.readdirSync(localesDir).filter((f) => f.endsWith(".json"));
const masterPath = path.join(localesDir, `${master}.json`);
if (!files.includes(`${master}.json`)) {
  console.error(`[i18n] ana dil dosyasi yok: ${master}.json`);
  process.exit(1);
}

let masterData;
try {
  masterData = JSON.parse(fs.readFileSync(masterPath, "utf8"));
} catch (err) {
  console.error(`[i18n] ${master}.json gecersiz JSON: ${err.message}`);
  process.exit(1);
}
const masterKeys = flat(masterData);

// 1) Bos deger kontrolu (ana dilde)
for (const [key, value] of Object.entries(masterKeys)) {
  if (typeof value === "string" && value.trim() === "") {
    problems.push(`${master}.json: "${key}" bos deger iceriyor`);
  }
}

// 2) Diger diller: JSON gecerliligi + anahtar paritesi
for (const file of files.sort()) {
  const lang = file.replace(/\.json$/, "");
  if (lang === master) continue;
  checkedLocales++;
  const filePath = path.join(localesDir, file);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    problems.push(`${file}: gecersiz JSON — ${err.message}`);
    continue;
  }
  const keys = flat(data);

  const missing = Object.keys(masterKeys).filter((k) => !(k in keys));
  const extra = Object.keys(keys).filter((k) => !(k in masterKeys));

  if (missing.length) {
    problems.push(`${file}: ${missing.length} eksik anahtar:\n    ${missing.join("\n    ")}`);
  }
  if (extra.length) {
    problems.push(`${file}: ${extra.length} fazla anahtar:\n    ${extra.join("\n    ")}`);
  }
  // Bos ceviri kontrolu
  const empty = Object.entries(keys)
    .filter(([k, v]) => k in masterKeys && typeof v === "string" && v.trim() === "")
    .map(([k]) => k);
  if (empty.length) {
    problems.push(`${file}: ${empty.length} bos ceviri:\n    ${empty.join("\n    ")}`);
  }
}

// 3) Kaynak kodda kullanilan anahtarlar
const sourceFiles = collectSourceFiles(srcDir);
const usedKeys = new Map(); // key -> [dosya...]
for (const file of sourceFiles) {
  const content = fs.readFileSync(file, "utf8");
  for (const match of content.matchAll(KEY_PATTERN)) {
    const key = match[1];
    if (!usedKeys.has(key)) usedKeys.set(key, []);
    usedKeys.get(key).push(path.relative(root, file));
  }
}
for (const [key, where] of [...usedKeys].sort()) {
  if (!(key in masterKeys)) {
    problems.push(
      `tanimsiz anahtar "${key}" — kullanan: ${[...new Set(where)].slice(0, 3).join(", ")}`,
    );
  }
}

/* ----------------------------------- sonuc --------------------------------- */

const totalKeys = Object.keys(masterKeys).length;
if (problems.length) {
  console.error(`\n[i18n] ${problems.length} SORUN BULUNDU:\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error(
    `\n  Ana dil: ${master}.json (${totalKeys} anahtar)\n` +
      `  Kontrol edilen dil: ${checkedLocales}\n` +
      `  Taranan kaynak dosya: ${sourceFiles.length} (${usedKeys.size} benzersiz anahtar kullaniliyor)\n`,
  );
  process.exit(1);
}

console.log(
  `[i18n] OK — ${checkedLocales + 1} dil x ${totalKeys} anahtar esit; ` +
    `${usedKeys.size} kullanilan anahtarin tumu tanimli (${sourceFiles.length} dosya tarandi).`,
);
