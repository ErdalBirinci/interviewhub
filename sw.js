/**
 * InterviewHub Service Worker — minimal PWA cache.
 *
 * - install: çekirdek dosyaları önbelleğe al
 * - fetch: network-first, çevrimdışıyda cache'e düşür; navigasyonlarda offline.html
 * - activate: eski cache'leri temizle
 */
const VERSION = "ih-v1";
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

  // Navigasyon: network-first, offline.html'e düşür
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

  // Statik: cache-first, sonra network (ve cache'e yaz)
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok && new URL(request.url).origin === self.location.origin) {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
