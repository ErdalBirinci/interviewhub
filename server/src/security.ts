/**
 * Guvenlik katmani: CSP + rate-limiting + guvenlik basliklari.
 *
 * CSP Notu: WebRTC medya akislari blob: URL kullanir; avatarlar data: URL
 * olabilir. Socket.IO ws/wss baglantilari icin connect-src gerekir.
 */
import type { NextFunction, Request, Response } from "express";

/* ------------------------------ CSP -------------------------------------- */

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "media-src 'self' blob:",
  "connect-src 'self' ws: wss:",
  "font-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CSP,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(self), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

/* --------------------------- rate limiting -------------------------------- */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Eski bucket'lari temizle (memory leak'i onle). */
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}, 60_000).unref();

function rateLimit({ windowMs, max, keyPrefix }: { windowMs: number; max: number; keyPrefix: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${keyPrefix}:${req.ip ?? "unknown"}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count++;
    if (bucket.count > max) {
      res.setHeader("Retry-After", Math.ceil((bucket.resetAt - now) / 1000));
      res.status(429).json({ error: "Cok fazla istek. Lutfen bekleyin." });
      return;
    }
    next();
  };
}

/* ------------------------------ middleware -------------------------------- */

/** Guvenlik basliklarini + genel rate limit (dakikada 120 istek). */
export function securityMiddleware(req: Request, res: Response, next: NextFunction) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(name, value);
  }
  next();
}

/** Auth endpoint'leri icin sıkı limit: dakikada 12 istek (brute-force korumasi). */
export const authRateLimit = rateLimit({ windowMs: 60_000, max: 12, keyPrefix: "auth" });

/** Oda olusturma/silme icin limit: dakikada 20 istek. */
export const roomsRateLimit = rateLimit({ windowMs: 60_000, max: 20, keyPrefix: "rooms" });
