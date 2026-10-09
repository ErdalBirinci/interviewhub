import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IceServerLike } from "@ih/shared";

const here = path.dirname(fileURLToPath(import.meta.url));

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

const trimSlash = (v: string) => v.replace(/\/+$/, "");
const port = num(process.env.PORT, 4000);

/** STUN/TURN sunuculari */
function iceServers(): IceServerLike[] {
  const list: IceServerLike[] = [];
  const stun = (process.env.STUN_SERVERS ?? "stun:stun.l.google.com:19302")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const urls of stun) list.push({ urls });

  if (process.env.TURN_URL) {
    list.push({
      urls: process.env.TURN_URL.split(",").map((s) => s.trim()).filter(Boolean),
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }
  return list;
}

const publicUrl = trimSlash(process.env.PUBLIC_URL ?? `http://localhost:${port}`);
const webUrl = trimSlash(process.env.WEB_URL ?? "http://localhost:5173");
const webDist = path.resolve(here, "..", "..", "web", "dist");
/** Derlenmis arayuz var mi? (sunucu ayni zamanda statik web servis eder) */
const webServed = fs.existsSync(path.join(webDist, "index.html"));

export const CFG = {
  PORT: port,
  PUBLIC_URL: publicUrl,
  WEB_URL: webUrl,
  SESSION_SECRET: process.env.SESSION_SECRET ?? "interviewhub-gelistirme-secreti",
  LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID ?? "",
  LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET ?? "",
  ALLOW_DEMO: process.env.ALLOW_DEMO !== "false",
  ICE_SERVERS: iceServers(),
  /** AI değerlendirme asistanı (OpenAI-uyumlu API) */
  AI_API_URL:
    (process.env.AI_API_URL ?? "").trim() || "https://api.openai.com/v1",
  AI_API_KEY: (process.env.AI_API_KEY ?? "").trim(),
  AI_MODEL: (process.env.AI_MODEL ?? "").trim() || "gpt-4o-mini",
  /** Kalici veri (kullanici + profil + oda listesi) */
  DATA_FILE:
    process.env.DATA_FILE ?? path.resolve(here, "..", ".data", "db.json"),
  /** Derlenmis web arayuzu - varsa statik olarak servis edilir */
  WEB_DIST: webDist,
  WEB_SERVED: webServed,
  /**
   * Oda baglantilarinin kurulacagi arayuz adresi.
   * Arayuz sunucunun kendisindeyse (uretim) kendi adresi; gelistirmede
   * Vite sunucusu kullanilir.
   */
  WEB_BASE: webServed ? publicUrl : webUrl,
};

export const linkedinEnabled = () =>
  Boolean(CFG.LINKEDIN_CLIENT_ID && CFG.LINKEDIN_CLIENT_SECRET);

/* ------------------------- arayuz adresi cozumleme ------------------------- */

let webBaseCache: { value: string; at: number } | null = null;

/**
 * WEB_URL'in bizim arayuzumuz olup olmadigini dogrular.
 * Vite gelistirme sunucusu /api'yi proxy'ler, ayni zamanda uretimde de
 * arayuz ayni sunucudadir; bu yuzden /api/config imzasi kullanilir.
 * Baska bir proje 5173'te calisiyorsa burasi yanlis doner ve fallback devreye girer.
 */
async function probeWebUrl(): Promise<boolean> {
  try {
    const res = await fetch(`${CFG.WEB_URL}/api/config`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return false;
    const data = (await res.json()) as { linkedinEnabled?: unknown; demo?: unknown };
    return "linkedinEnabled" in data && "demo" in data;
  } catch {
    return false;
  }
}

/**
 * Oda ve giris baglantilari icin kullanilacak arayuz adresi.
 *  - Vite gelistirme sunucusu ayaktaysa: WEB_URL
 *  - degilse ve arayuz build edilmisse: PUBLIC_URL (sunucunun kendisi)
 *  - o da degilse: WEB_URL
 * Sonuc 60 saniye boyunca onbelleklenir.
 */
export async function resolveWebBase(): Promise<string> {
  const now = Date.now();
  if (webBaseCache && now - webBaseCache.at < 60_000) return webBaseCache.value;
  let value = CFG.WEB_BASE;
  if (await probeWebUrl()) value = CFG.WEB_URL;
  webBaseCache = { value, at: now };
  return value;
}
