/**
 * Eklenti (Chrome MV3) E2E kontrolu:
 *  1) LinkedIn sayfasinda content script FAB enjekte edilmis mi bakilir
 *  2) FAB'a trusted tiklama yapilir, panel acma isteginin sonucu (toast) kontrol edilir
 *  3) sidepanel.html acilir ve arayuz metni okunur
 *
 * Not: eklenti ID'si aday service worker'lar arasindan **dogrulanarak** secilir
 * (sidepanel.html acilip "InterviewHub" metni okunur); boylece profildeki baska
 * bir eklenti (orn. Google Drive) yanlis ID'ye yol acmaz.
 * IH_EXT_ID ortam degiskeniyle dogrudan da verilebilir.
 *
 * Markali Chrome 137+ --load-extension desteklemez; CDP'yi Chromium /
 * Chrome for Testing ile acin:  node scripts/cdp-start.mjs
 *
 * Kullanim: node scripts/ext-e2e.mjs
 */
import {
  closeTarget,
  connect,
  evaluate,
  listExtensionIds,
  listTargets,
  newTarget,
  screenshot,
} from "./cdp.mjs";

const LINKEDIN_URL = process.env.IH_LINKEDIN_URL ?? "https://www.linkedin.com/in/williamhgates/";

const step = (m) => console.error(`[ext] ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (p, ms, label) =>
  Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout: ${label}`)), ms)),
  ]);

/**
 * Aday bir eklenti ID'sinin bizim eklentimiz oldugunu yanitlar:
 * sidepanel.html acilir, "InterviewHub" metni ve hata metni kontrol edilir.
 */
const verifyId = async (id) => {
  const t = await newTarget("about:blank");
  const c = connect(t.webSocketDebuggerUrl);
  try {
    await c.send("Page.enable");
    await c.send("Page.navigate", { url: `chrome-extension://${id}/sidepanel.html` });
    await sleep(1500);
    const text = await evaluate(
      c,
      `document.body ? document.body.innerText.replace(/\\s+/g, " ").slice(0, 300) : ""`,
    ).catch(() => "");
    return text.includes("InterviewHub") && !text.includes("ERR_FILE_NOT_FOUND");
  } catch {
    return false;
  } finally {
    c.close();
    await closeTarget(t.id).catch(() => null);
  }
};

/** Bizim eklentimizin ID'sini bulur (gerekirse dogrular). */
const findId = async () => {
  const candidates = [];
  if (process.env.IH_EXT_ID) candidates.push(process.env.IH_EXT_ID);

  // 1) chrome://extensions — ada gore. MV3 service worker'lar uykuya
  //    girebildigi icin SW hedefine bagimli kalmak yeterli degil.
  const installed = await listExtensionIds();
  const byName = installed.find((e) => /interviewhub/i.test(e.name ?? ""));
  if (byName) candidates.push(byName.id);

  // 2) service worker adaylari: "background.js" bizim SW'imizdir; diger
  //    adaylar (background_compiled.js vb.) yanlis eklentiye yol acmasin.
  const list = await listTargets();
  const workers = list.filter(
    (t) => t.type === "service_worker" && t.url.startsWith("chrome-extension://"),
  );
  const swIds = [...new Set(workers.map((t) => new URL(t.url).host))].sort((a, b) => {
    const ua = workers.find((t) => t.url.includes(a))?.url ?? "";
    const ub = workers.find((t) => t.url.includes(b))?.url ?? "";
    const sa = /\/background\.js$/.test(ua) ? 2 : ua.includes("background") ? 1 : 0;
    const sb = /\/background\.js$/.test(ub) ? 2 : ub.includes("background") ? 1 : 0;
    return sb - sa;
  });
  candidates.push(...swIds);

  for (const id of [...new Set(candidates)]) {
    if (await verifyId(id)) return id;
  }
  return null;
};

async function main() {
  /* --- 1) LinkedIn + FAB --- */
  const liTab = await newTarget("about:blank");
  const li = connect(liTab.webSocketDebuggerUrl);
  await li.send("Page.enable");
  step("linkedin aciliyor");
  await li.send("Page.navigate", { url: LINKEDIN_URL });
  await sleep(6000);

  const fabInfo = await evaluate(
    li,
    `(() => {
      const host = document.getElementById("interviewhub-host");
      if (!host) return JSON.stringify({ host: false, url: location.href, ready: document.readyState });
      const sr = host.shadowRoot;
      const btn = sr?.querySelector(".fab");
      return JSON.stringify({ host: true, hasShadow: Boolean(sr), fab: btn?.innerText ?? null, url: location.href });
    })()`,
  );
  console.log("FAB:", fabInfo);
  await screenshot(li, `${process.env.TEMP}/ih-ext-linkedin.png`).catch(() => null);

  let toast = null;
  if (fabInfo.includes('"host":true')) {
    const rect = JSON.parse(
      (await evaluate(
        li,
        `(() => { const b = document.getElementById("interviewhub-host")?.shadowRoot?.querySelector(".fab"); if (!b) return null; const r = b.getBoundingClientRect(); return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 }); })()`,
      )) ?? "null",
    );
    if (rect) {
      step(`FAB trusted tiklama (${Math.round(rect.x)}, ${Math.round(rect.y)})`);
      await li.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x, y: rect.y });
      await li.send("Input.dispatchMouseEvent", { type: "mousePressed", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
      await li.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
      await sleep(2500);
      toast = await evaluate(
        li,
        `(() => { const t = document.getElementById("interviewhub-host")?.shadowRoot?.querySelector(".toast"); return JSON.stringify({ text: t?.textContent ?? null, shown: t?.classList.contains("show") }); })()`,
      );
      console.log("TOAST:", toast);
      await screenshot(li, `${process.env.TEMP}/ih-ext-fab-click.png`).catch(() => null);
    }
  }
  li.close();

  /* --- 2) eklenti id (FAB mesaji service worker'i uyandirir) --- */
  const id = await withTimeout(findId(), 20000, "findId").catch(() => null);
  if (!id) {
    console.error("Eklenti yuklu gorunmuyor veya ID dogrulanamadi.");
    console.error("  - CDP'yi Chromium / Chrome for Testing ile acin:  node scripts/cdp-start.mjs");
    console.error("  - (markali Chrome 137+ --load-extension bayragini yok sayar)");
    console.error("  - veya IH_EXT_ID=<id> ortam degiskeniyle verin.");
    process.exit(2);
  }
  step(`eklenti id: ${id}`);

  /* --- 3) side panel arayuzu --- */
  const panelTab = await newTarget("about:blank");
  const panel = connect(panelTab.webSocketDebuggerUrl);
  await panel.send("Page.enable");
  await panel.send("Page.navigate", { url: `chrome-extension://${id}/sidepanel.html` });
  await sleep(2500);
  const panelText = await evaluate(panel, `document.body.innerText.replace(/\\s+/g, " ").slice(0, 400)`);
  const panelButtons = await evaluate(
    panel,
    `JSON.stringify([...document.querySelectorAll("button")].map((b) => b.innerText.replace(/\\s+/g, " ").trim()).filter(Boolean))`,
  );
  console.log("PANEL TEXT:", panelText);
  console.log("PANEL BUTTONS:", panelButtons);
  await screenshot(panel, `${process.env.TEMP}/ih-ext-panel.png`).catch(() => null);
  panel.close();

  const fabOk = fabInfo.includes('"host":true');
  const panelOk = panelText.length > 20;
  // Basarili acilmada toast gosterilmez; toast'a yazilan herhangi bir metin hatadir
  // (orn. "user gesture", "Panel acilamadi").
  let toastText = "";
  try {
    toastText = toast ? (String(JSON.parse(toast).text ?? "").trim()) : "";
  } catch {
    toastText = "";
  }
  const clickOk = !toast || !toastText;
  console.log("TOAST TEXT:", JSON.stringify(toastText));
  console.log(
    fabOk && panelOk && clickOk
      ? "\nEXT OK: FAB + panel acma + panel arayuzu calisiyor"
      : `\nEXT FAIL: fab=${fabOk} panel=${panelOk} click=${clickOk}`,
  );
  process.exit(fabOk && panelOk && clickOk ? 0 : 1);
}

await withTimeout(main(), 90000, "main").catch((e) => {
  console.error("EXT ERROR:", e.message);
  process.exit(3);
});
