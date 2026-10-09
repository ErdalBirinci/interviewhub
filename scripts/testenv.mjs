/** Test ortami hazirligi — e2e/sinyal betikleri icin ortak yardimci.
 *
 * - Sunucu ayakta mi kontrol eder (aciklayici hata mesaji uretir)
 * - token/oda iceren test env dosyasi yoksa (ya da gecersizlestiyse)
 *   demo kullanicilar + oda olusturup dosyayi kendisi yazar.
 *
 * Boylece `npm run test:signal` / `npm run test:e2e` tek basina calisir.
 */
import fs from "node:fs/promises";

export const APP = process.env.IH_APP ?? "http://localhost:4000";
export const DEFAULT_ENV_FILE =
  process.env.IH_TEST_ENV ??
  `${process.env.TEMP ?? process.env.TMPDIR ?? "."}/ih-test-env.json`;

const timeout = (ms) => AbortSignal.timeout(ms);

async function json(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function post(path, body, token) {
  const res = await fetch(`${APP}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
    signal: timeout(8000),
  });
  const data = await json(res);
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${data?.error ?? ""}`.trim());
  return data;
}

async function put(path, body, token) {
  const res = await fetch(`${APP}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body ?? {}),
    signal: timeout(8000),
  });
  const data = await json(res);
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${data?.error ?? ""}`.trim());
  return data;
}

/** Sunucu calisiyor mu? Ayni zamanda /api/config imzasini de dogrular. */
export async function checkServer() {
  let res;
  try {
    res = await fetch(`${APP}/api/config`, { signal: timeout(4000) });
  } catch (err) {
    throw new Error(
      `Sunucuya ulasilamadi: ${APP}\n  Detay: ${err.message}\n  Baslatin:  npm start`,
    );
  }
  if (!res.ok) throw new Error(`/api/config -> ${res.status}`);
  const data = await json(res);
  if (!data || typeof data.linkedinEnabled !== "boolean") {
    throw new Error("/api/config beklenen cevabi vermedi (baska bir uygulama bu portta olabilir).");
  }
  return data;
}

/**
 * iki demo kullanic + bir oda + paylasilan profiller olusturur.
 * signal-test profil alanlarini dogrular; o yuzden profil de yazilir.
 */
export async function provision(names = ["Ayse Yilmaz", "Mehmet Kaya"]) {
  const a = await post("/auth/demo", { name: names[0] });
  const b = await post("/auth/demo", { name: names[1] });

  for (const [token, fullName, headline] of [
    [a.token, names[0], "Test katilimci"],
    [b.token, names[1], "Test aday"],
  ]) {
    await put(
      "/api/me/profile",
      {
        fullName,
        headline,
        linkedinUrl: "https://www.linkedin.com/in/test",
        summary: "Otomatik olusturulan test profili.",
        shareProfile: true,
        skills: ["WebRTC"],
      },
      token,
    );
  }

  const room = await post("/api/rooms", { title: "Test odasi (otomatik)" }, a.token);
  const env = { a: a.token, b: b.token, roomId: room.room.id };
  return env;
}

async function isUsable(env) {
  if (!env || !env.a || !env.b || !env.roomId) return false;
  try {
    const me = await fetch(`${APP}/api/me`, {
      headers: { Authorization: `Bearer ${env.a}` },
      signal: timeout(4000),
    });
    if (!me.ok) return false; // token suresi dolmus / silinmis
    const room = await fetch(`${APP}/api/rooms/${env.roomId}`, {
      headers: { Authorization: `Bearer ${env.a}` },
      signal: timeout(4000),
    });
    return room.ok; // oda silinmis/kirpilmis olabilir
  } catch {
    return false;
  }
}

/**
 * HMAC imzali oturum token'inin payload'ini okur (imza dogrulanmaz,
 * sadece isim/rol gibi bilgileri test icin okumak amaclidir).
 */
export function decodeSession(token) {
  try {
    const body = String(token).split(".")[0];
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * Test kullanicilarinda profil zorunlu (sinyal testi profil alanlarini dogrular).
 * Profil zaten doluysa dokunmaz - kullanici eliyle bir sey yazdiysa silinmesin.
 */
export async function ensureProfiles(env) {
  for (const token of [env?.a, env?.b]) {
    if (!token) continue;
    const session = decodeSession(token);
    if (!session?.name) continue;
    try {
      const res = await fetch(`${APP}/api/me/profile`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: timeout(4000),
      });
      if (!res.ok) continue;
      const data = await json(res);
      if (data?.profile?.fullName) continue;
      await put(
        "/api/me/profile",
        { fullName: session.name, headline: "Test katilimci", shareProfile: true },
        token,
      );
    } catch {
      /* profil sonraki calistirmada denenir */
    }
  }
}

/** env dosyasini okur; yoksa veya gecersizse yeniden olusturur. */
export async function loadOrCreateTestEnv(file = DEFAULT_ENV_FILE) {
  let existing = null;
  try {
    existing = JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    existing = null;
  }
  const env = (await isUsable(existing)) ? existing : await provision();
  if (env !== existing) {
    await fs.mkdir(file.replace(/[\\/][^\\/]+$/, "") || ".", { recursive: true }).catch(() => {});
    await fs.writeFile(file, JSON.stringify(env, null, 2), "utf8");
  }
  await ensureProfiles(env);
  return env;
}
