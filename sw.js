/**
 * InterviewHub Service Worker — minimal PWA cache.
 *
 * - install: çekirdek dosyaları önbelleğe al
 * - fetch:   navigasyonlarda network-first, çevrimdışıyken index/offline
 *            statik varlıklarda cache-first
 * - activate: eski cache'leri temizle
 *
 * ÖNEMLİ: /api/* ve /socket.io/* ASLA önbelleklenmez (aşağıya bkz. isStaticAsset).
 */
const VERSION = "ih-v2";
/**
 * Kendi bazini registration.scope uzerinden bul:
 * - lokal:        scope = http://localhost:4000/        -> BASE = .../4000/
 * - GitHub Pages: scope = https://.../interviewhub/     -> BASE = .../interviewhub/
 */
const BASE = new URL("./", self.registration.scope).href;
const CORE = [
  BASE,
  `${BASE}index.html`,
  `${BASE}offline.html`,
  `${BASE}manifest.webmanifest`,
  `${BASE}ih-icon.svg`,
];

/**
 * Yalnizca GERCEK statik varliklar onbelleklenir.
 *
 * /api ve /socket.io istekleri bilerek disarida birakildi. Onceden bu ayrim
 * yoktu ve sw her ayni-kok GET istegini cache-first sunup onbelleğe yaziyordu.
 * Sonucu production'da gozlenen iki hata sinifi oldu:
 *
 *   1) /api/me, /api/me/profile, /api/rooms/:id gibi KIMLIK DOGRULAMALI
 *      yanitlar onbellekte kaliyordu. Kullanici cikis yapipten baska bir
 *      hesapla girdiginde tarayici eski kullanicinin kimligini gosteriyordu
 *      (ekran goruntusu testiyle yakalandi: oda iki farkli kisiyle kuruluyor
 *      ama her iki rozet de eski kullanicinin adini tasiyordu).
 *
 *   2) /socket.io/?EIO=4&transport=polling yanitlari onbellenince eski oturum
 *      kimlikleri (sid) yeniden oynatiliyordu; bu, gercek zamanli baglantiyi
 *      sessizce bozabilir.
 *
 * Ayrica onbelleğe yazilan her yanit VERSION sabit kaldigi icin buyuyordu:
 * onlarca farkli eski JS bundle'i ayni cache'de birikiyordu.
 */
function isStaticAsset(url) {
  if (url.origin !== self.location.origin) return false;
  const p = url.pathname;
  if (p.startsWith("/api/")) return false;
  if (p.startsWith("/socket.io/")) return false;
  return true;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Kimlik dogrulamali ve gercek zamanli istekler: dogrudan ag, hic onbellek yok.
  if (!isStaticAsset(new URL(request.url))) return;

  // Navigasyon: network-first, offline.html'e dusur
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(`${BASE}index.html`, copy));
          return res;
        })
        .catch(
          async () =>
            (await caches.match(`${BASE}index.html`)) ||
            (await caches.match(`${BASE}offline.html`)),
        ),
    );
    return;
  }

  // Statik varlik: cache-first, sonra network (ve cache'e yaz)
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
