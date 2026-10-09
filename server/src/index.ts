import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import express from "express";
import { CFG, linkedinEnabled } from "./config";
import { mountRoutes } from "./routes";
import { createIo } from "./rtc";
import { securityMiddleware } from "./security";
import { log, metrics } from "./metrics";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(securityMiddleware);

/* --------------------- istek metrikleri + yapili log --------------------- */
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    if (req.path.startsWith("/socket.io")) return;
    const ms = Date.now() - start;
    const route = (req as { route?: { path?: string } }).route?.path ?? req.path;
    const statusClass = `${Math.floor(res.statusCode / 100)}xx`;
    metrics.inc("http_requests_total", {
      method: req.method,
      route,
      status: statusClass,
    });
    metrics.observe("http_request_duration_ms", ms);
    if (res.statusCode >= 500) {
      log("error", "http_5xx", {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms,
      });
    } else if (res.statusCode >= 400 || ms > 1500) {
      log("warn", "http_4xx_or_slow", {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms,
      });
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
  const rooms = io.sockets.adapter.rooms.size;
  const clients = io.sockets.sockets.size;
  metrics.setGauge("live_rooms", rooms);
  metrics.setGauge("connected_clients", clients);
  metrics.setGauge("uptime_sec", Math.round(process.uptime()));
  res.json({
    ok: true,
    uptimeSec: Math.round(process.uptime()),
    pid: process.pid,
    rooms,
    clients,
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
  log("error", "uncaught_exception", { message: (err as Error).message });
});
process.on("unhandledRejection", (reason) => {
  log("error", "unhandled_rejection", { reason: String(reason) });
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
  log("info", "server_started", {
    port: CFG.PORT,
    publicUrl: CFG.PUBLIC_URL,
    linkedin: linkedinEnabled(),
    demo: CFG.ALLOW_DEMO,
    ai: Boolean(CFG.AI_API_KEY),
  });
  console.log("\n  InterviewHub sunucusu hazir");
  console.log(`  API      : ${CFG.PUBLIC_URL}`);
  console.log(`  Web (ugrama): ${CFG.WEB_URL}`);
  console.log(`  LinkedIn OAuth: ${linkedinEnabled() ? "ACIK" : "KAPALI (demo girisi acik: " + CFG.ALLOW_DEMO + ")"}`);
  console.log(`  AI degerlendirme: ${CFG.AI_API_KEY ? "ACIK (" + CFG.AI_MODEL + ")" : "KAPALI (AI_API_KEY gerekli)"}`);
  console.log(`  Statik web: ${hasWeb ? CFG.WEB_DIST : "bulunamadi (npm run build -w @ih/web)"}`);
  console.log(`  Saglik   : ${CFG.PUBLIC_URL}/api/health`);
  console.log(`  Metrikler: ${CFG.PUBLIC_URL}/api/metrics`);
  console.log("");
});
