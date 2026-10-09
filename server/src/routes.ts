import type { Express, Request, Response } from "express";
import { EMPTY_PROFILE, normalizeProfile, type LinkedInProfile, type RoomView } from "@ih/shared";
import {
  clearSessionCookie,
  requireAuth,
  setSessionCookie,
  sign,
  verify,
  type Session,
} from "./auth";
import { CFG, linkedinEnabled, resolveWebBase } from "./config";
import { buildAuthUrl, exchangeCode, fetchUserInfo, type LinkedInUserInfo } from "./linkedin";
import { activeCount, activeCounts } from "./rtc";
import { store } from "./store";
import { authRateLimit, roomsRateLimit } from "./security";
import { log, metrics } from "./metrics";
import {
  aiEnabled,
  AiNotConfiguredError,
  evaluateInterview,
  normalizeCandidateProfile,
} from "./ai";

/* --------------------------------- yardimcilar ------------------------------- */

const str = (v: unknown, max = 500) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

const rawStr = (v: unknown, max = 5000) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

function sessionFromUser(user: {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  provider: "linkedin" | "demo";
}): Session {
  return {
    sub: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    provider: user.provider,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30,
  };
}

function upsertFromLinkedIn(ui: LinkedInUserInfo) {
  const id = `li:${ui.sub}`;
  return store.upsertUser({
    id,
    name: str(ui.name || [ui.given_name, ui.family_name].filter(Boolean).join(" "), 80) || "LinkedIn kullanicisi",
    email: ui.email,
    avatarUrl: ui.picture,
    provider: "linkedin",
  });
}

/** Sadece chromiumapp.org adresine izin ver - acik yonlendirici engeli */
function isExtensionRedirect(value: unknown): value is string {
  return typeof value === "string" && /^https:\/\/[a-z0-9]+\.chromiumapp\.org\/[a-z0-9_\-/]*$/i.test(value);
}

/* ------------------------------------ routes --------------------------------- */

/**
 * Isteyen origin'lere izin ver.
 * - ayni origin (Origin basligi yok): sayfa ayni sunucudan, eklenti fetch'i, curl
 * - WEB_URL (Vite gelistirme sunucusu) ve PUBLIC_URL
 * - chrome-extension:// (eklenti)
 * Diger herhangi bir site origin'ine yanit GOVDEDE verilmez; boylece cookie'li
 * oturum baska bir siteden kullanilamaz.
 */
function isAllowedOrigin(origin: string): boolean {
  if (/^chrome-extension:\/\/|^chrome-webextension:\/\//i.test(origin)) return true;
  const allowed = new Set([CFG.PUBLIC_URL, CFG.WEB_URL]);
  if (allowed.has(origin)) return true;
  // Gelistirme sunucusu farkli port/localhost varyantinda olabilir
  try {
    const url = new URL(origin);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (local && url.protocol === "http:") return true;
  } catch {
    /* gecersiz origin */
  }
  return false;
}

export function mountRoutes(app: Express) {
  /* --- CORS: eklenti chrome-extension origin'inden cagirir --- */
  app.use((req: Request, res: Response, next) => {
    const origin = req.headers.origin;
    if (origin && isAllowedOrigin(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get("/api/config", async (_req, res) => {
    res.json({
      linkedinEnabled: linkedinEnabled(),
      demo: CFG.ALLOW_DEMO,
      /** Arayuzun calistigi adres (eklenti oda baglantilarini bununla kurar) */
      webUrl: await resolveWebBase(),
      publicUrl: CFG.PUBLIC_URL,
    });
  });

  /* ---------------------------------- auth ---------------------------------- */

  const webRedirectUri = `${CFG.PUBLIC_URL}/auth/linkedin/callback`;

  /** Giris sonrasi donecegimiz uygulama yolu (acik yonlendiriciyi engelle). */
  function safeNext(value: unknown): string {
    return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
      ? value
      : "/dashboard";
  }

  app.get("/auth/linkedin", (req, res) => {
    if (!linkedinEnabled()) {
      res.status(501).json({ error: "LinkedIn OAuth yapilandirilmamis. Demo girisini kullanin." });
      return;
    }
    const state = sign({ mode: "web", redirectUri: webRedirectUri, next: safeNext(req.query.next) });
    res.redirect(buildAuthUrl(webRedirectUri, state));
  });

  app.get("/auth/extension", (req, res) => {
    if (!linkedinEnabled()) {
      res.status(501).json({ error: "LinkedIn OAuth yapilandirilmamis. Demo girisini kullanin." });
      return;
    }
    const redirectUri = req.query.redirect_uri;
    if (!isExtensionRedirect(redirectUri)) {
      res.status(400).json({ error: "Gecersiz redirect_uri. Beklenen: https://<id>.chromiumapp.org/..." });
      return;
    }
    const state = sign({ mode: "extension", redirectUri });
    res.redirect(buildAuthUrl(redirectUri, state));
  });

  app.get("/auth/linkedin/callback", async (req, res) => {
    const state = verify<{ mode?: string; redirectUri?: string; next?: string; exp: number }>(
      typeof req.query.state === "string" ? req.query.state : "",
    );
    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!state || !code) {
      res.status(400).send("Gecersiz OAuth donusu (state/code eksik).");
      return;
    }

    const redirectUri = state.redirectUri || webRedirectUri;

    try {
      const { access_token } = await exchangeCode(code, redirectUri);
      const ui = await fetchUserInfo(access_token);
      const user = upsertFromLinkedIn(ui);
      const token = sign(sessionFromUser(user));

      if (state.mode === "extension" && isExtensionRedirect(state.redirectUri)) {
        const url = new URL(state.redirectUri);
        url.searchParams.set("token", token);
        res.redirect(url.toString());
        return;
      }

      setSessionCookie(res, token);
      // Giris yapilan sayfaya don (guvenli yolla dogrulanmis yol)
      res.redirect(`${await resolveWebBase()}${safeNext(state.next)}`);
    } catch (err) {
      console.error("[auth] LinkedIn donusu basarisiz:", err);
      res.status(502).send(`LinkedIn girisinde hata: ${(err as Error).message}`);
    }
  });

  app.post("/auth/demo", authRateLimit, (req: Request, res: Response) => {
    if (!CFG.ALLOW_DEMO) {
      res.status(403).json({ error: "Demo girisi kapali." });
      return;
    }
    const name = str(req.body?.name, 60) || "Demo Kullanici";
    // Turkce karakterler korunur (Yilmaz -> yilmaz, Dogan -> dogan)
    const slug =
      name
        .toLocaleLowerCase("tr-TR")
        .replace(/[^a-z0-9ığüşiöç]+/gi, "-")
        .replace(/^-+|-+$/g, "") || "kullanici";
    const id = `demo:${slug}`;
    const user = store.upsertUser({ id, name, provider: "demo" });
    const token = sign(sessionFromUser(user));
    setSessionCookie(res, token);
    res.json({ user, token });
  });

  app.post("/auth/logout", (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.get("/api/me", requireAuth, (req, res) => {
    const session = req.session!;
    const profile = store.getProfile(session.sub);
    res.json({
      user: {
        id: session.sub,
        name: session.name,
        email: session.email,
        avatarUrl: session.avatarUrl,
        provider: session.provider,
      },
      hasProfile: Boolean(profile),
    });
  });

  /* --------------------------------- profil --------------------------------- */

  app.get("/api/me/profile", requireAuth, (req, res) => {
    const stored = store.getProfile(req.session!.sub);
    res.json({ profile: stored ? normalizeProfile(stored) : EMPTY_PROFILE });
  });

  app.put("/api/me/profile", requireAuth, (req, res) => {
    const body = (req.body ?? {}) as Partial<LinkedInProfile>;
    const profile: LinkedInProfile = {
      linkedinUrl: rawStr(body.linkedinUrl, 300),
      fullName: str(body.fullName, 120),
      headline: str(body.headline, 200),
      location: str(body.location, 120),
      summary: rawStr(body.summary, 3000),
      shareProfile: body.shareProfile !== false,
      experience: Array.isArray(body.experience)
        ? body.experience.slice(0, 20).map((e) => ({
            title: str(e?.title, 140),
            company: str(e?.company, 140),
            period: str(e?.period, 60),
            description: rawStr(e?.description, 800),
          }))
        : [],
      education: Array.isArray(body.education)
        ? body.education.slice(0, 20).map((e) => ({
            school: str(e?.school, 160),
            degree: str(e?.degree, 140),
            period: str(e?.period, 60),
          }))
        : [],
      skills: Array.isArray(body.skills)
        ? body.skills.slice(0, 40).map((s) => str(s, 60)).filter(Boolean)
        : [],
    };
    store.setProfile(req.session!.sub, profile);
    res.json({ profile });
  });

  /* ---------------------------------- odalar -------------------------------- */

  app.get("/api/ice", (_req, res) => {
    res.json({ iceServers: CFG.ICE_SERVERS });
  });

  app.post("/api/rooms", requireAuth, roomsRateLimit, async (req, res) => {
    const session = req.session!;
    const room = store.createRoom({
      title: str(req.body?.title, 120) || "Gorusme odasi",
      hostId: session.sub,
      hostName: session.name,
    });
    metrics.inc("rooms_created_total");
    const view: RoomView = { ...room, active: activeCounts([room.id])[room.id] };
    res.status(201).json({ room: view, url: `${await resolveWebBase()}/room/${room.id}` });
  });

  app.get("/api/me/rooms", requireAuth, (req, res) => {
    const session = req.session!;
    const rooms = store.listRooms().filter((r) => r.hostId === session.sub);
    const counts = activeCounts(rooms.map((r) => r.id));
    res.json({
      rooms: rooms.map((r) => ({ ...r, active: counts[r.id] ?? 0 }) satisfies RoomView),
    });
  });

  app.get("/api/rooms/:id", requireAuth, async (req, res) => {
    const room = store.getRoom(req.params.id);
    if (!room) {
      res.status(404).json({ error: "Oda bulunamadi." });
      return;
    }
    res.json({
      room: { ...room, active: activeCount(room.id) } satisfies RoomView,
      url: `${await resolveWebBase()}/room/${room.id}`,
    });
  });

  app.delete("/api/rooms/:id", requireAuth, (req, res) => {
    const room = store.getRoom(req.params.id);
    if (!room) {
      res.status(404).json({ error: "Oda bulunamadi." });
      return;
    }
    if (room.hostId !== req.session!.sub) {
      res.status(403).json({ error: "Sadece oda sahibi silebilir." });
      return;
    }
    store.deleteRoom(room.id);
    res.json({ ok: true });
  });

  /* --------------------------- metrikler ------------------------------ */

  /** Operasyon metrikleri (tum oturumlu kullanicilar). */
  app.get("/api/metrics", requireAuth, (_req, res) => {
    metrics.setGauge("uptime_sec", Math.round(process.uptime()));
    res.json(metrics.snapshot());
  });

  /* --------------------- AI degerlendirme --------------------------- */

  /**
   * Mülakât notlarina ve (paylasilmis) aday profilina dayali
   * AI degerlendirmesi. Sadece oda sahibi (mülakâtçi) kullanabilir;
   * medya asla iletilmez. AI_API_KEY yoksa 501 doner.
   */
  app.post("/api/rooms/:id/evaluate", requireAuth, async (req, res) => {
    const room = store.getRoom(req.params.id);
    if (!room) {
      res.status(404).json({ error: "Oda bulunamadi." });
      return;
    }
    if (room.hostId !== req.session!.sub) {
      res.status(403).json({
        error: "Sadece oda sahibi (mulakatci) degerlendirme yapabilir.",
      });
      return;
    }
    const notes = rawStr(req.body?.notes, 4000);
    if (!notes.trim()) {
      res.status(400).json({ error: "Degerlendirme icin gorusme notlari gerekli." });
      return;
    }
    const candidate = normalizeCandidateProfile(req.body?.candidateProfile);
    const position = str(req.body?.position, 120);
    try {
      const evaluation = await evaluateInterview({
        notes,
        candidate,
        position,
      });
      metrics.inc("ai_evaluations_total", { status: "ok" });
      res.json({ evaluation });
    } catch (err) {
      if (err instanceof AiNotConfiguredError) {
        res.status(501).json({
          error: "AI_DEGERLENDIRME_YAPILANDIRILMADI",
          message: err.message,
        });
        return;
      }
      metrics.inc("ai_evaluations_total", { status: "error" });
      log("error", "ai_evaluation_failed", {
        room: room.id,
        message: (err as Error).message,
      });
      res.status(502).json({
        error: "AI_DEGERLENDIRME_BASARISIZ",
        message: (err as Error).message,
      });
    }
  });
}
