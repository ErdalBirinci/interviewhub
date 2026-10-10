/**
 * i18n tutarlilik dogrulamasi — CI ve yerel test icin.
 *
 * Kullanim: node scripts/i18n-check.mjs
 * Cikis kodu 0 = sorun yok, 1 = hata var.
 *
 * Hem web uygulamasini hem de Chrome eklentisini kapsar ( ikisi de
 * web ile ayni ana dil dosyasini referans alir, farkli klasorlerde tutulur).
 *
 * Kontrol eder:
 *   1. Tum locale dosyalari gecerli JSON mu.
 *   2. en.json ile birebir ayni anahtar kumesine sahip mi (eksik/fazla yok).
 *   3. Kaynak kodda kullanilan t("anahtar") / translate("anahtar") degerleri
 *      en.json'da mevcut mu (kullanilan ama tanimlanmamis anahtar = calisma
 *      aninda ham metin gosterir).
 *   4. HTML'deki data-i18n* niteliklerindeki anahtarlar tanimli mi.
 *   5. Bos string degeri olan anahtar var mi (ceviri eksik kalmis olabilir).
 *
 * Bu script test:all icine alinmistir; yeni bir anahtar eklenirken bir dili
 * guncellemeyi unutmak artik testi kirar.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const master = "en";

/** Kontrol edilecek her bir i18n alani. */
const PROJECTS = [
  {
    name: "web",
    localesDir: path.join(root, "web", "src", "i18n", "locales"),
    srcDirs: [path.join(root, "web", "src")],
    htmlFiles: [],
  },
  {
    name: "extension",
    localesDir: path.join(root, "extension", "src", "locales"),
    srcDirs: [path.join(root, "extension", "src")],
    htmlFiles: [path.join(root, "extension", "sidepanel.html")],
  },
];

const problems = [];

/* --------------------------------- yardimcilar ------------------------------ */

function flat(obj, prefix = "") {
  const out = {};
  for (const [key, value] of Object.entries(obj ?? {})) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        // i18next keySeparator "." dir; dizi elemanlari "items.0.title" biciminde
        // cozulur. "items[0].title" COZULMEZ ve ekranda ham anahtar gosterir —
        // bu yuzden burada da ayni gosterimi kullaniriz.
        const k = `${full}.${i}`;
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

/** Dizeyi t("anahtar") / translate('anahtar') / t(`anahtar`) desenlerinden ayiklar. */
const KEY_PATTERN = /\b(?:t|translate)\(\s*["'`]([a-zA-Z0-9_.\[\]]+)["'`]/g;

/** HTML'deki data-i18n, data-i18n-html, data-i18n-ph, ... niteliklerinden anahtar cikarir. */
const HTML_ATTR_PATTERN = /data-i18n(?:-[a-z]+)?\s*=\s*"([^"]+)"/g;

function collectSourceFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "locales" || entry.name === "node_modules" || entry.name === "dist") {
        continue;
      }
      out.push(...collectSourceFiles(p));
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

/* ---------------------------------- kontroller ------------------------------ */

/**
 * Bilesenlerin deger uzerinde string islem yaptigi (split vb.) anahtarlar icin
 * yapi sozlesmesi. Bir dil bu ayiriciyi unutursa bilesen sessizce bozuk
 * gorunur (orn. baslik ile govde metni ayni olur) — bu kontrol onu testte yakalar.
 */
const STRUCTURE_CONTRACTS = [
  {
    // Landing.tsx: title = deger.split(" — ")[0], text = deger
    key: "landing.steps.steps",
    separator: " — ",
    why: "baslik/govde ayirimi icin em-dash zorunlu",
  },
];

function checkStructureContracts(localesDir) {
  const out = [];
  for (const file of fs.readdirSync(localesDir).filter((f) => f.endsWith(".json"))) {
    const lang = file.replace(/\.json$/, "");
    const data = JSON.parse(fs.readFileSync(path.join(localesDir, file), "utf8"));
    for (const c of STRUCTURE_CONTRACTS) {
      const value = c.key.split(".").reduce((acc, part) => acc?.[part], data);
      if (value === undefined) continue; // bu anahtar bu projeye ait degil
      const items = Array.isArray(value) ? value : [value];
      items.forEach((v, i) => {
        if (typeof v !== "string" || !v.includes(c.separator)) {
          out.push(
            `${file}: "${c.key}${Array.isArray(value) ? `.${i}` : ""}" ayirici "${c.separator}" icermiyor — ${c.why}`,
          );
        }
      });
    }
  }
  return out;
}

/**
 * Kullanilan anahtarlarin gercek i18next tarafindan cozuldugunu dogrular.
 * i18next'i ayni kaynaklardan kurar ve anahtari tek tek istek eder; cevap
 * anahtarin kendisine esitse cozum basarisizdir.
 */
async function checkWithRealI18next(localesDir, usedKeys, masterData) {
  const out = [];
  let i18n;
  try {
    ({ default: i18n } = await import("i18next"));
  } catch {
    out.push("i18next yuklenemedi; cozme testi atlandi");
    return out;
  }

  const resources = {};
  for (const file of fs.readdirSync(localesDir).filter((f) => f.endsWith(".json"))) {
    const code = file.replace(/\.json$/, "");
    resources[code] = {
      translation: JSON.parse(fs.readFileSync(path.join(localesDir, file), "utf8")),
    };
  }

  // Farkli bir ornek kullan; test sirasinda mevcut i18n kurulumuna dokunma
  const instance = i18n.createInstance();
  await instance.init({
    resources,
    lng: "en",
    fallbackLng: "en",
    defaultNS: "translation",
    ns: ["translation"],
    interpolation: { escapeValue: false },
    returnEmptyString: false,
  });

  let resolved = 0;
  const known = new Set(Object.keys(flat(masterData)));
  for (const key of [...usedKeys.keys()].sort()) {
    if (!known.has(key)) continue; // tanimsiz anahtar ayrica raporlanir
    const value = instance.t(key);
    if (value === key) {
      out.push(
        `i18next bu anahtari COZEMEDI: "${key}" (ekranda ham anahtar olarak gorunur). ` +
          `Nokta/parantez yazimina dikkat: dizi elemanlari "items.0" bicimindedir.`,
      );
    } else if (typeof value !== "string" || value.trim() === "") {
      out.push(`anahtar bos/donusumsuz dondu: "${key}" -> ${JSON.stringify(value)}`);
    } else {
      resolved++;
    }
  }
  console.log(`[i18n:web] cozme testi: ${resolved} anahtar gercek i18next ile dogrulandi`);
  return out;
}

let totalMasterKeys = 0;
let totalUsedKeys = 0;
let totalSourceFiles = 0;

for (const project of PROJECTS) {
  const { name, localesDir, srcDirs, htmlFiles } = project;

  if (!fs.existsSync(localesDir)) {
    problems.push(`[${name}] locales klasoru yok: ${localesDir}`);
    continue;
  }

  const files = fs.readdirSync(localesDir).filter((f) => f.endsWith(".json"));
  const masterPath = path.join(localesDir, `${master}.json`);
  if (!files.includes(`${master}.json`)) {
    problems.push(`[${name}] ana dil dosyasi yok: ${master}.json`);
    continue;
  }

  let masterData;
  try {
    masterData = JSON.parse(fs.readFileSync(masterPath, "utf8"));
  } catch (err) {
    problems.push(`[${name}] ${master}.json gecersiz JSON: ${err.message}`);
    continue;
  }
  const masterKeys = flat(masterData);
  totalMasterKeys += Object.keys(masterKeys).length;

  // 1) Bos deger kontrolu (ana dilde)
  for (const [key, value] of Object.entries(masterKeys)) {
    if (typeof value === "string" && value.trim() === "") {
      problems.push(`[${name}] ${master}.json: "${key}" bos deger iceriyor`);
    }
  }

  // 2) Diger diller: JSON gecerliligi + anahtar paritesi + bos ceviri
  for (const file of files.sort()) {
    const lang = file.replace(/\.json$/, "");
    if (lang === master) continue;
    const filePath = path.join(localesDir, file);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (err) {
      problems.push(`[${name}] ${file}: gecersiz JSON — ${err.message}`);
      continue;
    }
    const keys = flat(data);

    const missing = Object.keys(masterKeys).filter((k) => !(k in keys));
    const extra = Object.keys(keys).filter((k) => !(k in masterKeys));

    if (missing.length) {
      problems.push(
        `[${name}] ${file}: ${missing.length} eksik anahtar:\n    ${missing.join("\n    ")}`,
      );
    }
    if (extra.length) {
      problems.push(
        `[${name}] ${file}: ${extra.length} fazla anahtar:\n    ${extra.join("\n    ")}`,
      );
    }
    const empty = Object.entries(keys)
      .filter(([k, v]) => k in masterKeys && typeof v === "string" && v.trim() === "")
      .map(([k]) => k);
    if (empty.length) {
      problems.push(`[${name}] ${file}: ${empty.length} bos ceviri:\n    ${empty.join("\n    ")}`);
    }
  }

  // 3) Kaynak kodda kullanilan anahtarlar
  const sourceFiles = srcDirs.flatMap((d) => collectSourceFiles(d));
  const usedKeys = new Map(); // key -> [dosya...]
  const addUsed = (key, file) => {
    if (!usedKeys.has(key)) usedKeys.set(key, []);
    usedKeys.get(key).push(path.relative(root, file));
  };

  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, "utf8");
    for (const match of content.matchAll(KEY_PATTERN)) addUsed(match[1], file);
  }

  // 4) HTML data-i18n* nitelikleri
  for (const file of htmlFiles) {
    if (!fs.existsSync(file)) {
      problems.push(`[${name}] HTML dosyasi yok: ${path.relative(root, file)}`);
      continue;
    }
    sourceFiles.push(file);
    const content = fs.readFileSync(file, "utf8");
    for (const match of content.matchAll(HTML_ATTR_PATTERN)) addUsed(match[1], file);
  }

  for (const [key, where] of [...usedKeys].sort()) {
    if (!(key in masterKeys)) {
      problems.push(
        `[${name}] tanimsiz anahtar "${key}" — kullanan: ${[...new Set(where)].slice(0, 3).join(", ")}`,
      );
    }
  }

  // 5) Bilesenlerin split ile ayirdigi degerlerde yapilandirma sozlesmesi
  problems.push(...checkStructureContracts(localesDir).map((p) => `[${name}] ${p}`));

  // 6) Gercek i18next ile COZME testi.
  //    "Anahtar JSON'da var" ile "i18next o anahtari buluyor" ayni sey degildir.
  //    Or: "landing.features.items[0].title" JSON'da kalinca flat() tarafinda
  //    "var" gorunur ama i18next keySeparator nokta oldugu icin bunu COZEMEZ ve
  //    ekranda ham anahtar gosterir. Bu adim o sinif bug'i kalici olarak yakalar.
  if (name === "web") {
    const runtimeProblems = await checkWithRealI18next(localesDir, usedKeys, masterData);
    problems.push(...runtimeProblems.map((p) => `[${name}] ${p}`));
  }

  totalUsedKeys += usedKeys.size;
  totalSourceFiles += sourceFiles.length;

  console.log(
    `[i18n:${name}] ${files.length} dil x ${Object.keys(masterKeys).length} anahtar; ` +
      `${usedKeys.size} kullanilan anahtar (${sourceFiles.length} dosya)`,
  );
}

/* ----------------------------------- sonuc --------------------------------- */

if (problems.length) {
  console.error(`\n[i18n] ${problems.length} SORUN BULUNDU:\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error("");
  process.exit(1);
}

console.log(
  `[i18n] OK — toplam ${totalMasterKeys} anahtar; ${totalUsedKeys} kullanilan anahtarin tumu tanimli (${totalSourceFiles} dosya tarandi).`,
);
