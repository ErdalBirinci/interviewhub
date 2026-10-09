import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { CFG } from "./config";

export const SESSION_COOKIE = "ih_session";

export interface Session {
  sub: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  provider: "linkedin" | "demo";
  exp: number;
}

const b64u = (value: string | Buffer) =>
  Buffer.from(value).toString("base64url");

/** HMAC imzali, kendinden kodlu token uretir. */
export function sign(payload: object, ttlMs = 1000 * 60 * 60 * 24 * 30): string {
  const body = b64u(JSON.stringify({ ...payload, exp: Date.now() + ttlMs }));
  const sig = crypto.createHmac("sha256", CFG.SESSION_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verify<T = Session>(token?: string | null): T | null {
  if (!token || typeof token !== "string") return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = crypto
    .createHmac("sha256", CFG.SESSION_SECRET)
    .update(body)
    .digest("base64url");

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof payload.exp === "number" && payload.exp < Date.now()) return null;
    return payload as T;
  } catch {
    return null;
  }
}

function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

/** Authorization: Bearer once once cookie. */
export function readToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  const cookie = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  return cookie ?? null;
}

export function setSessionCookie(res: Response, token: string) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`,
  );
}

export function clearSessionCookie(res: Response) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/** Socket.IO handshake icin de cookie/bearer okur. */
export function tokenFromHeaders(headers: Record<string, unknown>): string | null {
  const auth = headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) return auth.slice(7).trim();
  const cookie = parseCookies(typeof headers.cookie === "string" ? headers.cookie : undefined);
  return cookie[SESSION_COOKIE] ?? null;
}

declare module "express-serve-static-core" {
  interface Request {
    session?: Session;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = verify<Session>(readToken(req));
  if (!session || !session.sub) {
    return res.status(401).json({ error: "Oturum bulunamadi. Lutfen giris yapin." });
  }
  req.session = session;
  next();
}

/** Giris yapilmis olabilir de olmayabilir - hata firlatmaz. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const session = verify<Session>(readToken(req));
  if (session?.sub) req.session = session;
  next();
}
