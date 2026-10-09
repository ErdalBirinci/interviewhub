/**
 * CDP test tarayicisini baslatir (port 9333).
 *
 * Markali Chrome 137+ `--load-extension` bayragini yok sayar; eklenti
 * testleri icin Chromium / Chrome for Testing gerekir. Bu betik uygun
 * binariyi kendisi bulur ve `--load-extension` + sahte medya
 * cihazlariyla baslatir (eklenti + WebRTC e2e testleri icin).
 *
 * Aday sirasi:
 *   1) IH_CHROME ortam degiskeni
 *   2) Playwright Chromium   (%LOCALAPPDATA%\ms-playwright\chromium-*\chrome-win64\chrome.exe)
 *   3) Chrome for Testing    (bilinen klasorler)
 *   4) Markali Chrome        (UYARI ile — eklenti testleri calismayabilir)
 *
 * Kullanim:  node scripts/cdp-start.mjs   (durdurmak icin Ctrl+C)
 * Port zaten aciksa bir sey yapmaz ve cikar.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const PORT = Number(process.env.CDP_PORT ?? 9333);
const EXT = path.join(root, "extension", "dist");
const PROFILE = path.join(os.tmpdir(), "ih-ctp-profile");

const exists = (p) => Boolean(p) && fs.existsSync(p);

/** Port dinleyeni var mi? */
function portInUse(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (v) => {
      socket.destroy();
      resolve(v);
    };
    socket.setTimeout(1200);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, "127.0.0.1");
  });
}

/** Bir dizinde chrome.exe adaylarini tarar. */
function scanForChrome(dir) {
  if (!fs.existsSync(dir)) return null;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  if (entries.some((e) => e.isFile() && e.name.toLowerCase() === "chrome.exe")) {
    return path.join(dir, "chrome.exe");
  }
  // Surum/alt klasorler (chromium-1223, chrome-win64, 148.x, ...)
  const subDirs = entries.filter((e) => e.isDirectory()).map((e) => path.join(dir, e.name));
  subDirs.sort().reverse(); // yeni surum oncelikli
  for (const sub of subDirs) {
    for (const rel of ["chrome-win64", "chrome-win", "chrome", ""]) {
      const candidate = rel ? path.join(sub, rel, "chrome.exe") : path.join(sub, "chrome.exe");
      if (exists(candidate)) return candidate;
    }
    // Derin tek seviye daha (orn. chromium-1223/chrome-win64)
    const deep = scanForChrome(sub);
    if (deep) return deep;
  }
  return null;
}

function findBinary() {
  if (exists(process.env.IH_CHROME)) {
    return { bin: process.env.IH_CHROME, branded: false, src: "IH_CHROME" };
  }

  const localAppData = process.env.LOCALAPPDATA ?? "";
  const searchRoots = [
    path.join(localAppData, "ms-playwright"),
    path.join(os.homedir(), ".cache", "chrome-for-testing"),
    path.join(os.homedir(), ".cache", "ms-playwright"),
    path.join(localAppData, "chrome-for-testing"),
    "C:\\chrome-for-testing",
  ].filter(exists);

  // once eklenti destekli adaylar
  for (const r of searchRoots) {
    const bin = scanForChrome(r);
    if (bin) return { bin, branded: false, src: r };
  }

  // markali chrome: eklenti testleri calismayabilir
  const branded = [
    path.join(process.env["ProgramFiles"] ?? "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["ProgramFiles(x86)"] ?? "", "Google", "Chrome", "Application", "chrome.exe"),
  ].find(exists);
  if (branded) return { bin: branded, branded: true, src: "markali Chrome" };

  return null;
}

const main = async () => {
  if (await portInUse(PORT)) {
    console.log(`[cdp] ${PORT} portu zaten acik — mevcut CDP ornegi kullanilir.`);
    process.exit(0);
  }

  const found = findBinary();
  if (!found) {
    console.error("[cdp] CDP tarayicisi bulunamadi. Playwright Chromium veya Chrome for Testing kurun.");
    console.error("      Ornek:  npm i -D playwright && npx playwright install chromium");
    process.exit(1);
  }

  if (found.branded) {
    console.warn(
      "[cdp] UYARI: markali Chrome bulundu; --load-extension yok sayilabilir.\n" +
        "      Eklenti testleri icin Chromium / Chrome for Testing kullanin\n" +
        "      (IH_CHROME=<yol> ile binariyi siz belirleyebilirsiniz).",
    );
  }

  const args = [
    `--remote-debugging-port=${PORT}`,
    "--remote-allow-origins=*",
    `--user-data-dir=${PROFILE}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--use-fake-ui-for-media-stream",
  ];
  if (exists(EXT)) {
    args.push(`--load-extension=${EXT}`);
  } else {
    console.warn(`[cdp]UYARI: eklenti dist yok (${EXT}) — once: npm run build -w @ih/extension`);
  }
  args.push("about:blank");

  console.log(`[cdp] binari : ${found.bin}`);
  console.log(`[cdp] profil : ${PROFILE}`);
  console.log(`[cdp] port   : ${PORT}`);
  console.log(`[cdp] eklenti: ${exists(EXT) ? EXT : "(dist yok)"}`);

  const child = spawn(found.bin, args, { stdio: "inherit" });
  child.on("error", (err) => {
    console.error("[cdp] baslatilamadi:", err.message);
    process.exit(1);
  });
  child.on("exit", (code) => process.exit(code ?? 0));
};

await main();
