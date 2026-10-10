/**
 * Statik varlik referans kontrolu.
 *
 * GitHub Pages'te uygulama /interviewhub/ altinda calisir; "src=/x.png" gibi
 * base'siz mutlak yollar 404 doner (bkz. vite.config.ts VITE_BASE, main.tsx).
 * Dogru desen: `${import.meta.env.BASE_URL}x.png`.
 *
 * Yalnizca DOSYA UZANTILI mutlak yollari bayraklar; "/room/xyz" gibi rota
 * baglantilari React Router tarafindan tabanla birlestirildigi icin sorun degildir.
 *
 * Kullanim: node scripts/asset-check.mjs   (cikis 0 = sorun yok)
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
