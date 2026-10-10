/**
 * Tanitim ekran goruntusunu (web/public/showcase-room.png) yeniden uretir.
 *
 * Neden ayri betik:
 *   Bu dosya urunun herkese acik tanitim sayfasinda gorunur tek bir VARLIK.
 *   Urunun arayuzu degistiginde tek komutla guncellenir:
 *
 *     npm run showcase
 *
 *   Ayni is shots.mjs'ten de yapilabilir, ancak shots.mjs tum dokumantasyon
 *   goruntulerini alir ve 1x'te yakalar. Tanitim gorseli 2x (retina) yakalanir;
 *   boylece buyuk ekranlarda bulaniklasma olmaz.
 *
 * Ne yapar:
 *   1. iki demo katilimci + bir oda kurar (testenv.provision — profil verisi
 *      bilerek zengin ve Ingilizce tutulur, cunku bu profil gorselin kendisinde
 *      gorunur ornek veridir)
 *   2. iki sekmede odaya katilir, P2P baglantisinin kurulmasini bekler
 *   3. kameralari kapatir — kadrajda avatar daireleri gorunur ve dis bir
 *      kameranin karesi gorsel hic karismaz
 *   4. sagdaki LinkedIn profili paneli acikken A sekmesini 2x olcek yakalar
 *
 * CDP gerekir: node scripts/cdp-start.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closeTarget, connect, evaluate, newTarget, screenshot } from "./cdp.mjs";
import { APP, checkServer, loadOrCreateTestEnv } from "./testenv.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, "../web/public/showcase-room.png");

// shots.mjs'teki DESKTOP ile ayni CSS gorunumu; 2x olcekle yakalanir.
const VIEWPORT = { width: 1440, height: 900 };
const SCALE = 2;

const step = (m) => console.error(`[showcase] ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (p, ms, label) =>
  Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout: ${label}`)), ms)),
  ]);

async function main() {
  step("sunucu + test ortami");
  await checkServer();
  const env = await loadOrCreateTestEnv();
  const roomUrl = (t) => `${APP}/room/${env.roomId}?autojoin=1&token=${encodeURIComponent(t)}`;

  // Tanitim gorseli BILEREK hep Ingilizce uretilir. Calistirilan tarayicida
  // ih_lang=tr kalmis olsa bile sonuc degismez — aksi halde sayfadaki dil ile
  // gorseldeki dil tutarsiz olur (bir kez tam olarak boyle olmustu: gorsel
  // Turkce arayuz, sayfa varsayilan Ingilizce).
  step("dil Ingilizceye sabitleniyor");
  {
    const t0 = await withTimeout(newTarget("about:blank"), 10000, "lang tab");
    const c0 = connect(t0.webSocketDebuggerUrl);
    await c0.send("Page.enable");
    await c0.send("Page.navigate", { url: `${APP}/` });
    await sleep(2500);
    await evaluate(c0, `localStorage.setItem("ih_lang", "en"); true;`).catch(() => null);
    c0.close(); // not: cdp.close() bir Promise dondurmez
    // Sekmeyi gercekten kapat: acik kalan sekme sonraki testlere karisir.
    await closeTarget(t0.id).catch(() => null);
  }

  step("oda: iki sekme");
  const tabA = await withTimeout(newTarget("about:blank"), 10000, "new A");
  const tabB = await withTimeout(newTarget("about:blank"), 10000, "new B");
  const ca = connect(tabA.webSocketDebuggerUrl);
  const cb = connect(tabB.webSocketDebuggerUrl);
  await Promise.all([ca.send("Page.enable"), cb.send("Page.enable")]);

  await Promise.all([
    ca.send("Page.navigate", { url: roomUrl(env.a) }),
    cb.send("Page.navigate", { url: roomUrl(env.b) }),
  ]);

  const probe = `(() => { const d = window.__ihRoom ? window.__ihRoom() : null; if (!d) return { status: "yok" }; return { status: d.status, peers: (d.peers ?? []).map(p => ({ id: p.id, conn: p.conn })) }; })()`;

  let joined = false;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const a = await evaluate(ca, probe).catch(() => null);
    const b = await evaluate(cb, probe).catch(() => null);
    if (
      a?.status === "joined" &&
      b?.status === "joined" &&
      (a.peers ?? []).some((p) => p.conn === "connected") &&
      (b.peers ?? []).some((p) => p.conn === "connected")
    ) {
      joined = true;
      break;
    }
  }
  step(joined ? "oda hazir (P2P bagli)" : "UYARI: P2P tam kurulamadi, yine de aliniyor");

  // Kamerayi kapat: oda "c" tusunu cam toggle olarak dinler (Room.tsx onKey).
  step("kameralar kapatiliyor");
  for (const c of [ca, cb]) {
    await evaluate(
      c,
      `window.dispatchEvent(new KeyboardEvent("keydown", { key: "c", bubbles: true })); true;`,
    ).catch(() => null);
  }
  await sleep(2000); // kamera kapanir, tile duzene gecer

  step(`yakaliyor: ${VIEWPORT.width}x${VIEWPORT.height} @${SCALE}x`);
  await ca
    .send("Emulation.setDeviceMetricsOverride", {
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      deviceScaleFactor: SCALE,
      mobile: false,
    })
    .catch(() => null);
  await evaluate(ca, `document.fonts ? document.fonts.ready.then(() => true) : true`).catch(
    () => null,
  );
  await sleep(600);
  await screenshot(ca, OUT);

  ca.close();
  cb.close();
  // Oda sekmelerini KAPAT. Acik kalan oda sekmesi sunucuda hayalet katilimci
  // birakir; ayni odayi kullanan siradaki test (signal-test) o zaman fazladan
  // peer gorur ve kirar. Bu, betigin ilk surumunde tam olarak yasandi.
  await closeTarget(tabA.id).catch(() => null);
  await closeTarget(tabB.id).catch(() => null);
  step(`OK — ${OUT}`);
}

main().catch((err) => {
  console.error(`[showcase] HATA: ${err?.message ?? err}`);
  process.exitCode = 1;
});
