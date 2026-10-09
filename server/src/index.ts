import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import express from "express";
import { CFG, linkedinEnabled } from "./config";
import { mountRoutes } from "./routes";
import { createIo } from "./rtc";
import { securityMiddleware } from "./security";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(securityMiddleware);

// Basit istek logu
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    if (req.path.startsWith("/socket.io")) return;
    const ms = Date.now() - start;
    if (res.statusCode >= 400 || ms > 1500) {
      console.log(`${req.method} ${req.path} -> ${res.statusCode} (${ms}ms)`);
    }
  });
  next();
});

mountRoutes(app);

const server = http.createServer(app);
const io = createIo(server);

/* ------------------------------- saglik ---------------------------------- */

// Canli saglik raporu (nydmonitor / `npm run status` icin).
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    uptimeSec: Math.round(process.uptime()),
    pid: process.pid,
    rooms: io.sockets.adapter.rooms.size,
    clients: io.sockets.sockets.size,
    linkedin: linkedinEnabled(),
    demo: CFG.ALLOW_DEMO,
    time: new Date().toISOString(),
  });
});

const hasWeb = fs.existsSync(path.join(CFG.WEB_DIST, "index.html"));
if (hasWeb) {
  app.use(express.static(CFG.WEB_DIST, { index: false }));
  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/auth") ||
      req.path.startsWith("/socket.io")
    ) {
      next();
      return;
    }
    res.sendFile(path.join(CFG.WEB_DIST, "index.html"));
  });
}

/* --------------------------- hatayi yonet ------------------------------- */

// Port dolu ise okunabilir mesaj ver (yigin izi yerine).
server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `\n  HATA: ${CFG.PORT} portu zaten kullaniliyor.\n` +
        `  Var olan InterviewHub sunucusunu durdurun ya da PORT ile farkli bir port verin.\n` +
        `  Ornek: PORT=4001 npm start\n`,
    );
    process.exit(1);
  }
  console.error("[server] HTTP hatasi:", err);
  process.exit(1);
});

// Sunucu, tek bir beklenmeyen hata yuzunden kapanmasin.
process.on("uncaughtException", (err) => {
  console.error("[fatal] yakalanmamistis:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[fatal] islenmemis promise:", reason);
});

// Duzgun kapanis: port hemen serbest kalsin (yeniden baslatma hizli olsun).
let closing = false;
const shutdown = (signal: string) => {
  if (closing) return;
  closing = true;
  console.log(`\n  ${signal} alindi, sunucu kapatiliyor…`);
  io.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

server.listen(CFG.PORT, () => {
  console.log("\n  InterviewHub sunucusu hazir");
  console.log(`  API      : ${CFG.PUBLIC_URL}`);
  console.log(`  Web (ugrama): ${CFG.WEB_URL}`);
  console.log(`  LinkedIn OAuth: ${linkedinEnabled() ? "ACIK" : "KAPALI (demo girisi acik: " + CFG.ALLOW_DEMO + ")"}`);
  console.log(`  Statik web: ${hasWeb ? CFG.WEB_DIST : "bulunamadi (npm run build -w @ih/web)"}`);
  console.log(`  Saglik   : ${CFG.PUBLIC_URL}/api/health`);
  console.log("");
});
