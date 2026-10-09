/**
 * Tarayici (gercek Chrome) ic uctan uca WebRTC testi.
 *
 * On kosullar:
 *  - sunucu calisiyor (http://localhost:4000)
 *  - Chrome CDP ile acik ve sahte medya cihazlari acik:
 *      chrome.exe --remote-debugging-port=9333 --remote-allow-origins=* \
 *        --user-data-dir="<temp>\ih-chrome-profile" \
 *        --use-fake-ui-for-media-stream --use-fake-device-for-media-stream about:blank
 *
 * Kullanim:
 *  node scripts/e2e-browser.mjs [roomId]
 *
 * Cikti: iki sekmenin oda/WebRTC durumu; cikis kodu 0 = peer "connected" + video track canli.
 */
import { connect, closeTarget, evaluate, listTargets, newTarget, screenshot } from "./cdp.mjs";
import { APP, checkServer, loadOrCreateTestEnv } from "./testenv.mjs";

const envFile =
  process.env.IH_TEST_ENV ?? `${process.env.TEMP ?? process.env.TMPDIR ?? "."}/ih-test-env.json`;

const step = (msg) => console.error(`[e2e] ${msg}`);
const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout: ${label} (${ms}ms)`)), ms)),
  ]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Test token'lari/odasi - hazir degilse betik kendisi olusturur. */
let tokens = { a: "", b: "", roomId: "" };
let roomId = "";

const roomUrl = (token) =>
  `${APP}/room/${roomId}?token=${encodeURIComponent(token)}&autojoin=1&debug=1`;

const probe = `(() => {
  const d = window.__ihRoom ? window.__ihRoom() : null;
  if (!d) return { error: "debug-global yok", text: document.body.innerText.replace(/\\s+/g, " ").slice(0, 200) };
  return {
    status: d.status,
    selfId: d.selfId,
    media: d.media,
    peers: d.peers.map((p) => ({
      id: p.id,
      polite: p.polite,
      conn: p.conn,
      ice: p.ice,
      sig: p.sig,
      dc: p.dc,
      remoteDesc: p.remoteDesc,
      remoteTracks: p.remoteTracks,
      senders: p.senders,
    })),
    text: document.body.innerText.replace(/\\s+/g, " ").slice(0, 320),
  };
})()`;

const statsProbe = `(async (peerId) => {
  const pc = window.__ihRoom().getPc(peerId);
  if (!pc) return null;
  const rep = await pc.getStats();
  const local = [], remote = [];
  let pair = null;
  rep.forEach((e) => {
    if (e.type === "local-candidate") local.push(e.protocol + "/" + e.candidateType);
    if (e.type === "remote-candidate") remote.push(e.protocol + "/" + e.candidateType);
    if (e.type === "candidate-pair" && e.state === "succeeded" && !pair) {
      pair = { bytes: String(e.bytesSent) + "/" + String(e.bytesReceived), rtt: e.currentRoundTripTime };
    }
  });
  return { local, remote, pair };
})`;

async function main() {
  step("sunucu + test ortami");
  try {
    await checkServer();
    tokens = await loadOrCreateTestEnv(envFile);
  } catch (err) {
    console.error("E2E BASLATILAMADI:", err.message);
    process.exit(2);
  }
  roomId = process.argv[2] ?? process.env.IH_ROOM ?? tokens.roomId;
  step(`oda: ${roomId}`);

  step("CDP surum kontrolu");
  const version = await withTimeout(
    fetch("http://127.0.0.1:9333/json/version").catch(() => null),
    8000,
    "json/version",
  );
  if (!version) {
    console.error("CDP yok. Chrome'u su komutla acin:");
    console.error(
      '  node scripts/cdp-start.mjs   (veya) chrome.exe --remote-debugging-port=9333 --remote-allow-origins=* --user-data-dir="%TEMP%\\ih-chrome-profile" --use-fake-ui-for-media-stream about:blank',
    );
    process.exit(2);
  }

  const versionInfo = await version.json();

  /* Kamera/mikrofon iznini onceden ver (balonuk beklemesin). */
  step("izin ver (Browser.grantPermissions)");
  const browserClient = connect(versionInfo.webSocketDebuggerUrl);
  await withTimeout(
    browserClient
      .send("Browser.grantPermissions", {
        origin: APP,
        permissions: ["audioCapture", "videoCapture"],
      })
      .catch((err) => console.error("[e2e] grantPermissions atlandi:", err.message)),
    10000,
    "grantPermissions",
  );

  /* Onceki test sekmelerini kapat (odada olu peer birakmasinlar). */
  const before = await listTargets();
  const stale = before.filter((t) => t.type === "page" && t.url.startsWith(APP));
  if (stale.length) {
    step(`eski sekme kapatiliyor: ${stale.length}`);
    await Promise.all(stale.map((t) => fetch(`${"http://127.0.0.1:9333"}/json/close/${t.id}`, { method: "PUT" }).catch(() => null)));
    await sleep(800);
  }

  step("iki sekme aciliyor");
  const tabA = await withTimeout(newTarget("about:blank"), 10000, "new A");
  const tabB = await withTimeout(newTarget("about:blank"), 10000, "new B");
  const clientA = connect(tabA.webSocketDebuggerUrl);
  const clientB = connect(tabB.webSocketDebuggerUrl);

  await withTimeout(
    Promise.all([clientA.send("Page.enable"), clientB.send("Page.enable")]),
    15000,
    "Page.enable",
  );
  step("navigate");
  await withTimeout(
    Promise.all([
      clientA.send("Page.navigate", { url: roomUrl(tokens.a) }),
      clientB.send("Page.navigate", { url: roomUrl(tokens.b) }),
    ]),
    15000,
    "Page.navigate",
  );

  /* Iki sekme de odaya girene kadar bekle. */
  step("katilim bekleniyor");
  let a = null;
  let b = null;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    a = await evaluate(clientA, probe).catch(() => null);
    b = await evaluate(clientB, probe).catch(() => null);
    if (a?.status === "joined" && b?.status === "joined") break;
  }
  if (a?.status !== "joined" || b?.status !== "joined") {
    console.log(JSON.stringify({ a, b }, null, 2));
    console.log("\nE2E FAIL: iki sekme de odaya katilamadi");
    process.exit(1);
  }

  /* P2P kurulana kadar bekle. */
  step("p2p bekleniyor");
  let connected = false;
  for (let i = 0; i < 25; i++) {
    await sleep(1000);
    a = await evaluate(clientA, probe);
    b = await evaluate(clientB, probe);
    connected = (a.peers ?? []).some((p) => p.conn === "connected") &&
      (b.peers ?? []).some((p) => p.conn === "connected");
    if (connected) break;
  }

  /* Baglili peer icin stats ekle. */
  const attachStats = async (client, r) => {
    for (const p of r.peers) {
      if (p.conn === "connected" || p.conn === "checking") {
        p.stats = await evaluate(client, `${statsProbe}("${p.id}")`).catch(() => null);
      }
    }
  };
  await attachStats(clientA, a);
  await attachStats(clientB, b);

  step("ekran goruntusu");
  const shotDir = process.env.TEMP ?? ".";
  await withTimeout(screenshot(clientA, `${shotDir}/ih-e2e-a.png`), 20000, "shot A").catch(() => null);
  await withTimeout(screenshot(clientB, `${shotDir}/ih-e2e-b.png`), 20000, "shot B").catch(() => null);

  clientA.close();
  clientB.close();
  browserClient.close();

  // Sekmeleri de kapat. Aksi halde socket baglantilari odada kalir
  // ve ardindan calisan signal-test gibi testleri kirler.
  await Promise.all([closeTarget(tabA.id), closeTarget(tabB.id)]);
  await sleep(600);

  console.log(JSON.stringify({ a, b }, null, 2));

  const liveMedia = (r) =>
    (r.peers ?? []).some(
      (p) =>
        p.conn === "connected" &&
        (p.remoteTracks ?? []).some((t) => t === "video:live" || t === "audio:live"),
    );
  const mediaOk = liveMedia(a) && liveMedia(b);
  if (!connected) {
    console.log("\nE2E FAIL: peer baglantisi connected degil");
    process.exit(1);
  }
  const kinds = (r) =>
    [...new Set((r.peers ?? []).flatMap((p) => p.remoteTracks ?? []))].filter((t) => t.endsWith(":live"));
  console.log(
    mediaOk
      ? `\nE2E OK: peer baglantisi connected + medya canli (A: ${kinds(a).join(",")} | B: ${kinds(b).join(",")})`
      : "\nE2E OK (kismi): baglanti connected; medya track canli degil",
  );
  process.exit(mediaOk ? 0 : 1);
}

await withTimeout(main(), 160000, "main").catch((err) => {
  console.error("E2E ERROR:", err.message);
  process.exit(3);
});
