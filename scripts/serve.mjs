/**
 * Dayanikli sunucu baslatici (watchdog).
 *
 * Sunucu cogu zaman "arka plan sureci kapandigi" icin oluyordu; bu betik
 * sunucuyu cocuk surec olarak calistirir ve beklenmedik sekilde kapanirsa
 * kendiliinden yeniden baslatir.
 *
 * Kullanim: npm run start:watch
 *
 * Kurallar:
 *  - temiz kapanis (Ctrl+C / kod 0) -> yeniden baslatma yok
 *  - port zaten kullaniliyor -> dongu yok, aciklayici mesaj
 *  - diger hatalar -> 60 sn penceresinde en fazla 10 deneme, artan bekleme
 *
 * Not: sunucu ciktisi pipe edilmez; dogrudan dosyaya yazilir.
 *      (Windows'ta pipe handle'lari, cocuk surec sikildiginda
 *      libuv assertion'ini tetikleyip watchdog'i de cokturur.)
 *      Log: server/.data/server.log
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const serverCwd = path.join(root, "server");
const serverEntry = path.join(serverCwd, "dist", "server.mjs");
const logDir = path.join(serverCwd, ".data");
const logPath = path.join(logDir, "server.log");
const PORT = Number(process.env.PORT ?? 4000);

if (!fs.existsSync(serverEntry)) {
  console.error("[watch] server/dist/server.mjs yok. Once derleyin:  npm run build");
  process.exit(1);
}

const WINDOW_MS = 60_000;
const MAX_RESTARTS = 10;

let attempts = [];
let stopping = false;
let child = null;
let restartTimer = null;
let logFd = -1;

const stamp = () => new Date().toLocaleString("tr-TR");

/** Portu dinleyen bir surec var mi? (baglanti denenerek) */
function portInUse(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(1500);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}

/** Sunucu ciktisi dosyaya gider (pipe tutmamak watchdog'i korur). */
function openLog() {
  try {
    fs.mkdirSync(logDir, { recursive: true });
    logFd = fs.openSync(logPath, "a");
    fs.appendFileSync(logFd, `\n===== ${stamp()} watchdog baslatildi (port ${PORT}) =====\n`);
  } catch (err) {
    console.error("[watch] log dosyasi acilamadi:", err.message);
    logFd = -1;
  }
}

function start() {
  if (stopping) return;
  portInUse(PORT).then((inUse) => {
    if (stopping) return;
    if (inUse) {
      // Zaten baska bir sunucu (veya watchdog) bu portu kullaniyor.
      // Bu bir hata degildir: temiz cikis (kod 0), yeniden baslatma yok.
      // Boylece Gorev Zamanlayicisi sonsuz restart dongusu baslatmaz.
      console.log(
        `[watch] ${PORT} portu zaten kullaniliyor (baska bir sunucu ayakta) - cikiliyor.`,
      );
      stopAll(0);
      return;
    }
    try {
      if (logFd >= 0) {
        fs.appendFileSync(logFd, `----- ${stamp()} sunucu baslatiliyor -----\n`);
      }
    } catch {
      /* yoksay */
    }
    const sink = logFd >= 0 ? logFd : "ignore";
    child = spawn(process.execPath, [serverEntry], {
      cwd: serverCwd,
      stdio: ["ignore", sink, sink],
      env: process.env,
    });

    child.on("error", (err) => {
      console.error("[watch] surec baslatilamadi:", err.message);
      scheduleRestart();
    });

    child.on("exit", (code, signal) => {
      child = null;
      if (stopping) return;
      if (code === 0) {
        console.log("[watch] sunucu temiz sekilde kapandi.");
        return;
      }
      console.error(
        `[watch] sunucu beklenmedik sekilde kapandi (kod=${code}, sinyal=${signal})`,
      );
      scheduleRestart();
    });
  });
}

function scheduleRestart() {
  if (stopping) return;
  const now = Date.now();
  attempts = attempts.filter((t) => now - t < WINDOW_MS);
  if (attempts.length >= MAX_RESTARTS) {
    console.error(`[watch] ${MAX_RESTARTS} deneme de tutmadi - kapatiliyor.`);
    stopAll(1);
    return;
  }
  attempts.push(now);
  const delay = Math.min(500 * attempts.length, 5000);
  console.log(
    `[watch] ${delay} ms sonra yeniden baslatiliyor (${attempts.length}/${MAX_RESTARTS})…`,
  );
  restartTimer = setTimeout(() => {
    restartTimer = null;
    start();
  }, delay);
}

function stopAll(code) {
  if (stopping) return;
  stopping = true;
  if (restartTimer) clearTimeout(restartTimer);
  if (child) {
    child.removeAllListeners("exit");
    child.kill();
    child = null;
  }
  if (logFd >= 0) {
    try {
      fs.appendFileSync(logFd, `===== ${stamp()} watchdog durdu =====\n`);
      fs.closeSync(logFd);
    } catch {
      /* yoksay */
    }
    logFd = -1;
  }
  process.exit(code);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    console.log(`\n[watch] ${signal} - kapatiliyor…`);
    stopAll(0);
  });
}

// JS hatasi cokmasin; sadece kaydedip devam etsin.
process.on("uncaughtException", (err) => {
  console.error("[watch] yakalanmamistis:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[watch] islenmemis promise:", reason);
});

openLog();
console.log(`[watch] InterviewHub watchdog baslatildi (log: ${logPath}, dur: Ctrl+C)`);
start();
