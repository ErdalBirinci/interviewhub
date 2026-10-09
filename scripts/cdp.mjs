/**
 * CDP (Chrome DevTools Protokolü) yardimcilari — tarayici ic otomasyon testleri icin.
 * Kullanim: node scripts/cdp.mjs   (kendi basina bir sey yapmaz; modul olarak kullanilir)
 *
 * Chrome ornegi ornek:
 *   chrome.exe --remote-debugging-port=9333 --user-data-dir=<temp> about:blank
 */
const PORT = Number(process.env.CDP_PORT ?? 9333);
const BASE = `http://127.0.0.1:${PORT}`;

/** HTTP araclarinin sonsuza kadar asilmasin */
const FETCH_TIMEOUT = Number(process.env.CDP_FETCH_TIMEOUT ?? 8000);
/** Tek bir CDP komutu icin ust sinir */
const SEND_TIMEOUT = Number(process.env.CDP_SEND_TIMEOUT ?? 30000);

async function http(url, init = {}) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  return res;
}

export async function listTargets() {
  try {
    const res = await http(`${BASE}/json/list`);
    return await res.json();
  } catch (err) {
    throw new Error(`CDP list alinamadi (${BASE}): ${err.message}`);
  }
}

export async function newTarget(url) {
  const res = await http(`${BASE}/json/new?${new URLSearchParams({ url })}`, { method: "PUT" });
  if (!res.ok) throw new Error(`json/new failed: ${res.status}`);
  return res.json();
}

export async function closeTarget(id) {
  const res = await http(`${BASE}/json/close/${id}`).catch(() => null);
  return res?.ok ?? false;
}

export function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let seq = 0;
  const pending = new Map();
  let closed = false;

  const failAll = (reason) => {
    for (const { reject } of pending.values()) reject(new Error(reason));
    pending.clear();
  };

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve(), { once: true });
    ws.addEventListener(
      "error",
      () => reject(new Error("CDP WebSocket hatasi")),
      { once: true },
    );
    ws.addEventListener(
      "close",
      () => {
        if (!closed) reject(new Error("CDP WebSocket kapandi (hedef kapanmis olabilir)"));
      },
      { once: true },
    );
  });

  ws.addEventListener("message", (ev) => {
    let msg;
    try {
      msg = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString());
    } catch {
      return;
    }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject, timer } = pending.get(msg.id);
      pending.delete(msg.id);
      clearTimeout(timer);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });

  ws.addEventListener("close", () => failAll("CDP WebSocket kapandi"));
  ws.addEventListener("error", () => failAll("CDP WebSocket hatasi"));

  const send = async (method, params = {}) => {
    await ready;
    if (closed) throw new Error("CDP WebSocket kapandi");
    const id = ++seq;
    const p = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP timeout: ${method} (${SEND_TIMEOUT}ms)`));
      }, SEND_TIMEOUT);
      pending.set(id, { resolve, reject, timer });
    });
    ws.send(JSON.stringify({ id, method, params }));
    return p;
  };

  return {
    send,
    close: () => {
      closed = true;
      failAll("CDP baglantisi kapatildi");
      try {
        ws.close();
      } catch {
        /* yoksay */
      }
    },
  };
}

/** Sayfadaki ifadeyi calistirip JSON degerini dondurur. */
export async function evaluate(client, expression) {
  const res = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.exception?.description ?? "evaluate hatasi");
  }
  return res.result?.value;
}

/**
 * chrome://extensions sayfasindan yuklu eklentileri okur: [{ id, name }].
 * MV3 service worker'lar uykuya girebildigi icin SW hedefine bagimli degildir.
 */
export async function listExtensionIds() {
  const tab = await newTarget("about:blank");
  const client = connect(tab.webSocketDebuggerUrl);
  try {
    await client.send("Page.enable");
    await client.send("Page.navigate", { url: "chrome://extensions" });
    await new Promise((r) => setTimeout(r, 2000));
    const raw = await evaluate(
      client,
      `(() => {
        const mgr = document.querySelector("extensions-manager");
        const list = mgr && mgr.shadowRoot && mgr.shadowRoot.querySelector("extensions-item-list");
        if (!list) return "[]";
        const items = [...list.shadowRoot.querySelectorAll("extensions-item")];
        return JSON.stringify(
          items.map((i) => ({
            id: i.id || i.getAttribute("id") || "",
            name: (((i.shadowRoot || {}).querySelector("#name")) || {}).textContent || "",
          })),
        );
      })()`,
    );
    return JSON.parse(raw ?? "[]");
  } catch {
    return [];
  } finally {
    client.close();
    await closeTarget(tab.id).catch(() => null);
  }
}

export async function screenshot(client, path) {
  const fs = await import("node:fs/promises");
  const res = await client.send("Page.captureScreenshot", { format: "png" });
  await fs.writeFile(path, Buffer.from(res.data, "base64"));
  return path;
}
