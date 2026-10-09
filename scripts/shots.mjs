/**
 * Urune ait ekran goruntulerini toplar (CDP gerekir: node scripts/cdp-start.mjs).
 *
 * Kullanim: node scripts/shots.mjs [cikti-klasoru]
 * Varsayilan cikti: %TEMP%\ih-shots
 *
 * Kaptur:
 *   01-landing      /            (cikis yapilmis)
 *   02-login        /dashboard   (giris karti)
 *   03-dashboard    /dashboard   (girisli, oda listesi)
 *   04-profile      /profile     (profil editoru, dolu veriyle)
 *   05-room-join    /room/<id>   (katilma ekrani)
 *   06-room         /room/<id>   (gorusme: iki kisi, medya + panel)
 *   07-panel        eklenti yan paneli
 *   08-landing-mobile /          (390x844 — mobil duyarlilik kontrolu)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  closeTarget,
  connect,
  evaluate,
  listExtensionIds,
  listTargets,
  newTarget,
  screenshot,
} from "./cdp.mjs";
import { APP, checkServer, loadOrCreateTestEnv } from "./testenv.mjs";

const OUT = process.argv[2] ?? path.join(os.tmpdir(), "ih-shots");
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const step = (m) => console.error(`[shots] ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (p, ms, label) =>
  Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout: ${label}`)), ms)),
  ]);

fs.mkdirSync(OUT, { recursive: true });

/** Sekmenin gorunumunu ayarlayip ekran goruntusu alir. */
async function shot(client, name, viewport = DESKTOP) {
  await client
    .send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: viewport === MOBILE,
    })
    .catch(() => null);
  await evaluate(client, `document.fonts ? document.fonts.ready.then(() => true) : true`).catch(
    () => null,
  );
  await sleep(400);
  const file = path.join(OUT, `${name}.png`);
  await screenshot(client, file);
  console.log("SHOT:", file);
  return file;
}

/** Navigasyon + sayfanin hazir olmasini bekler. */
async function goto(client, url, waitMs = 2500) {
  await client.send("Page.navigate", { url });
  await sleep(waitMs);
}

async function main() {
  step("sunucu + test ortami");
  await checkServer();
  const env = await loadOrCreateTestEnv();

  const version = await withTimeout(
    fetch("http://127.0.0.1:9333/json/version").catch(() => null),
    8000,
    "json/version",
  );
  if (!version) throw new Error("CDP yok — once: node scripts/cdp-start.mjs");
  const versionInfo = await version.json();

  /* Kamera/mikrofon izni (medya ekran goruntusu icin) */
  const browserClient = connect(versionInfo.webSocketDebuggerUrl);
  await withTimeout(
    browserClient
      .send("Browser.grantPermissions", { origin: APP, permissions: ["audioCapture", "videoCapture"] })
      .catch((err) => step(`grantPermissions atlandi: ${err.message}`)),
    10000,
    "grantPermissions",
  );

  /* Eski localhost sekmelerini kapat (oda kalintisi birakmasin) */
  const before = await listTargets();
  const stale = before.filter((t) => t.type === "page" && t.url.startsWith(APP));
  if (stale.length) {
    step(`eski sekme kapatiliyor: ${stale.length}`);
    await Promise.all(stale.map((t) => closeTarget(t.id).catch(() => null)));
    await sleep(600);
  }

  /* --- tek sekme: landing -> login -> dashboard -> profile -> join --- */
  const tab = await withTimeout(newTarget("about:blank"), 10000, "new tab");
  const c = connect(tab.webSocketDebuggerUrl);
  await c.send("Page.enable");

  step("landing");
  await evaluate(c, `localStorage.clear(); sessionStorage.clear();`).catch(() => null);
  await goto(c, `${APP}/`);
  await shot(c, "01-landing");

  step("giris karti");
  await goto(c, `${APP}/dashboard`);
  await shot(c, "02-login");

  step("girisli dashboard");
  await evaluate(
    c,
    `localStorage.setItem("ih_token", ${JSON.stringify(env.a)}); sessionStorage.clear();`,
  );
  await goto(c, `${APP}/dashboard`, 3000);
  await shot(c, "03-dashboard");

  step("profil");
  await goto(c, `${APP}/profile`, 3000);
  await shot(c, "04-profile");

  step("katilma ekrani");
  await goto(c, `${APP}/room/${env.roomId}`, 3000);
  await shot(c, "05-room-join");

  c.close();
  await closeTarget(tab.id).catch(() => null);
  await sleep(500);

  /* --- oda: iki kisi, P2P + medya --- */
  step("oda: iki sekme");
  const tabA = await withTimeout(newTarget("about:blank"), 10000, "new A");
  const tabB = await withTimeout(newTarget("about:blank"), 10000, "new B");
  const ca = connect(tabA.webSocketDebuggerUrl);
  const cb = connect(tabB.webSocketDebuggerUrl);
  await Promise.all([ca.send("Page.enable"), cb.send("Page.enable")]);

  const roomUrl = (t) => `${APP}/room/${env.roomId}?autojoin=1&token=${encodeURIComponent(t)}`;
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
    if (a?.status === "joined" && b?.status === "joined" &&
        (a.peers ?? []).some((p) => p.conn === "connected") &&
        (b.peers ?? []).some((p) => p.conn === "connected")) {
      joined = true;
      break;
    }
  }
  step(joined ? "oda hazir (P2P bagli)" : "oda: P2P tam kurulamadi, yine de aliniyor");

  await sleep(2500); // uzak video ilk kareyi gosterir
  await shot(ca, "06-room");
  ca.close();
  cb.close();
  await Promise.all([closeTarget(tabA.id), closeTarget(tabB.id)]).catch(() => null);
  await sleep(500);

  /* --- eklenti paneli --- */
  const installed = await listExtensionIds().catch(() => []);
  const byName = installed.find((e) => /interviewhub/i.test(e.name ?? ""));
  const targets = await listTargets();
  const sw = targets.find(
    (t) => t.type === "service_worker" && /chrome-extension:\/\/[^/]+\/background\.js$/.test(t.url),
  );
  const extId = process.env.IH_EXT_ID ?? byName?.id ?? (sw ? new URL(sw.url).host : null);
  if (extId) {
    step("eklenti paneli");
    const pTab = await newTarget("about:blank");
    const pc = connect(pTab.webSocketDebuggerUrl);
    await pc.send("Page.enable");
    await goto(pc, `chrome-extension://${extId}/sidepanel.html`, 3000);
    await shot(pc, "07-panel", { width: 420, height: 800 });
    pc.close();
    await closeTarget(pTab.id).catch(() => null);
  } else {
    step("eklenti ID bulunamadi — 07-panel atlandi");
  }

  /* --- mobil gorunum --- */
  step("mobil landing (390x844)");
  const mTab = await newTarget("about:blank");
  const mc = connect(mTab.webSocketDebuggerUrl);
  await mc.send("Page.enable");
  await goto(mc, `${APP}/`);
  await shot(mc, "08-landing-mobile", MOBILE);
  mc.close();
  await closeTarget(mTab.id).catch(() => null);

  browserClient.close();
  console.log("\nOK — tum goruntuler:", OUT);
}

await withTimeout(main(), 180000, "main").catch((e) => {
  console.error("SHOTS ERROR:", e.message);
  process.exit(1);
});
