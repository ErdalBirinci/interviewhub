/**
 * Statik varlik referans kontrolu.
 *
 * 1) BASE UYUMLULUGU
 * GitHub Pages'te uygulama /interviewhub/ altinda calisir; "src=/x.png" gibi
 * base'siz mutlak yollar 404 doner (bkz. vite.config.ts VITE_BASE, main.tsx).
 * Dogru desen: `${import.meta.env.BASE_URL}x.png`.
 *
 * Yalnizca DOSYA UZANTILI mutlak yollari bayraklar; "/room/xyz" gibi rota
 * baglantilari React Router tarafindan tabanla birlestirildigi icin sorun degildir.
 *
 * 2) GORSEL BOYUT BEYANI
 * Bir <img>'e width/height verildiyse bunlar CLS onlemi icin yalnizca YER
 * AYRIRIR; CSS height:auto ile gercek oran dosyanin kendisinden gelir. Beyan
 * ile dosya boyutu eslesmezse gorsel yuklenince sayfa kayar. Bu bolum o
 * uyusmazligi yakalar (bkz. readImageSize asagida).
 *
 * Kullanim: node scripts/asset-check.mjs   (cikis 0 = sorun yok)
 *   npm run test:asset
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scanDirs = [path.join(root, "web", "src")];
const scanFiles = [path.join(root, "web", "index.html")];

//  /birsey.png  |  /birsey.svg  |  /birsey.css  |  /birsey.js  ... (uzantili)
const ABS_ASSET = /(?:src|href)\s*=\s*["']\/[^"']*\.[a-zA-Z0-9]{2,6}(?:[?#][^"']*)?["']/g;
const URL_FUNC = /url\(\s*['"]?\/[^'")]*\.[a-zA-Z0-9]{2,6}[^'")]*['"]?\s*\)/g;

function collect(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (["node_modules", "dist", "locales"].includes(e.name)) continue;
      collect(p, out);
    } else if (/\.(tsx?|jsx?|html|css)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

const files = [...scanDirs.flatMap((d) => collect(d)), ...scanFiles.filter(fs.existsSync)];
const problems = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  content.split("\n").forEach((line, i) => {
    // BASE_URL ile kurulan referanslar zaten dogru
    if (line.includes("BASE_URL")) return;
    // Vite girisi: /src/... build sirasinda hash'li ciktiga yazilir, dokunma
    if (/src\s*=\s*["']\/src\//.test(line)) return;
    for (const re of [ABS_ASSET, URL_FUNC]) {
      for (const m of line.matchAll(re)) {
        problems.push(`${path.relative(root, file)}:${i + 1}  ${m[0].trim()}`);
      }
    }
  });
}

/* ---------------- <img> width/height beyani <-> gercek dosya boyutu ---------------
 * width/height nitelikleri CLS onlemi icin yalnizca YER AYIRIR; CSS
 * height:auto ile gercek oran dosyanin kendisinden gelir. Beyan ile dosya
 * boyutu eslesmezse gorsel yuklenince sayfa kayar. Bu kontrol o uyusmazligi
 * kalici olarak yakalar (bir kez olmustu: sayfada 2000x1125 beyan edilmis,
 * dosya ise 2974x1602 idi).
 *
 * Yalnizca BASE_URL ile kurulan, web/public altindaki PNG/JPEG dosyalarina
 * bakar; SVG gibi vektorlerde piksel boyutu kavrami farkli oldugu icun atlanir.
 */
function readImageSize(file) {
  let b;
  try {
    b = fs.readFileSync(file);
  } catch {
    return null;
  }
  // PNG: 8 bayt imza + 4 bayt uzunluk + "IHDR" (0x49484452), sonra w/h big-endian
  if (b.length > 24 && b.readUInt32BE(12) === 0x49484452) {
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), kind: "PNG" };
  }
  // JPEG: SOF0-SOF15 marker'lari arasinda yukseklik/Genislik
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length - 9) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      const isSOF = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isSOF) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5), kind: "JPEG" };
      i += 2 + len;
    }
  }
  return null;
}

const dimProblems = [];
{
  const imgNum = (tag, name) => {
    const m =
      tag.match(new RegExp(`\\b${name}\\s*=\\s*\\{\\s*(\\d+)\\s*\\}`)) ||
      tag.match(new RegExp(`\\b${name}\\s*=\\s*["'](\\d+)["']`));
    return m ? Number(m[1]) : null;
  };

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const tag of content.match(/<img\b[^>]*>/gs) ?? []) {
      const w = imgNum(tag, "width");
      const h = imgNum(tag, "height");
      if (!w || !h) continue; // boyut beyani verilmemis: CLS riski yok
      // `src={`${import.meta.env.BASE_URL}showcase-room.png`}` deseni
      const m = tag.match(/BASE_URL\}([^"'`]+\.[a-zA-Z0-9]{2,6})/);
      if (!m) continue; // BASE_URL ile kurulmuyorsa asset bolumu zaten yakalar
      const onDisk = path.join(root, "web", "public", m[1]);
      const size = readImageSize(onDisk);
      if (!size) continue; // dosya yok ya da desteklenmeyen bicim
      if (size.w !== w || size.h !== h) {
        dimProblems.push(
          `${path.relative(root, file)}  ${m[1]}: beyan ${w}x${h}, ` +
            `dosya gercekten ${size.w}x${size.h} (${size.kind})`,
        );
      }
    }
  }
}

if (dimProblems.length) {
  console.error(`\n[asset] ${dimProblems.length} <img> boyut beyani dosyayla uyusmuyor:`);
  for (const p of dimProblems) console.error(`  ✗ ${p}`);
  console.error(
    `\n  width/height CLS onlemi icin yalnizca yer ayirir; gercek oran dosyadan\n` +
      `  gelir. Beyan ile dosya boyutu eslesmeli. Tanitim gorselini su komutla\n` +
      `  yeniden uretin ve yeni boyutlari Landing.tsx'e yazin: npm run showcase\n`,
  );
  process.exit(1);
}

if (problems.length) {
  console.error(`\n[asset] ${problems.length} base'siz mutlak varlik referansi bulundu:`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error(
    `\n  Pages'te site /interviewhub/ altinda; yollar BASE_URL ile kurulmali:\n` +
      `    src={\`\${import.meta.env.BASE_URL}dosya.png\`}\n`,
  );
  process.exit(1);
}

console.log(`[asset] OK — ${files.length} dosya tarandi, base'siz mutlak varlik referansi yok.`);
