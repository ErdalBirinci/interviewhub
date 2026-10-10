// Web uygulamasinin varsayilan dilini dogrular: localStorage'da ih_lang olmadan
// sayfa acilir, gorunen metin ve <html lang> Ingilizce mi bakilir.
// Kullanim: node scripts/web-lang-check.mjs [url]
const TARGET = process.argv[2] || "http://localhost:4000/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const listRes = await fetch("http://localhost:9333/json");
const all = await listRes.json();
let tab = all.find((t) => t.type === "page" && t.url.startsWith("http://localhost:4000"));
if (!tab) {
  await fetch("http://localhost:9333/json/new?about:blank", { method: "PUT" });
  await sleep(500);
  tab = (await (await fetch("http://localhost:9333/json")).json()).find((t) => t.type === "page");
}

const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
const ev = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return r?.result?.value;
};

await send("Page.enable");
await send("Page.navigate", { url: TARGET });
await sleep(3500);
// Kayitli dil tercihini temizleyip yenile: boylece "ilk acilis" davranisi olculur
await ev(`localStorage.removeItem("ih_lang")`);
await send("Page.navigate", { url: TARGET });
await sleep(4000);

console.log("localStorage[ih_lang] =", await ev(`localStorage.getItem("ih_lang")`));
console.log("<html lang>          =", await ev(`document.documentElement.lang`));
console.log("detectedLanguage     =", await ev(`window.i18n?.language ?? "(yok)"`));
console.log("title                =", await ev(`document.title`));

const body = (await ev(`document.body.innerText`)) ?? "";
console.log("\n--- sayfa metni (ilk 700 karakter) ---");
console.log(body.slice(0, 700));

// Dil adlari ("Türkçe", "Deutsch"...) meşrudur; kontrol bunlari yok sayar
const LANG_NAMES = [
  "Türkçe",
  "Deutsch",
  "Français",
  "Español",
  "Русский",
  "日本語",
  "中文",
];
const stripped = LANG_NAMES.reduce((acc, n) => acc.split(n).join(" "), body);
const hits = [];
const re = /[çğıöşüÇĞİÖŞÜ]/g;
let m;
while ((m = re.exec(stripped)) !== null) {
  hits.push("…" + stripped.slice(Math.max(0, m.index - 45), m.index + 25).replace(/\n/g, " ") + "…");
}
console.log(`\nTürkçe karakter: ${hits.length ? hits.length + " yer" : "0 (OK)"}`);
for (const h of [...new Set(hits)].slice(0, 12)) console.log("   " + h);
ws.close();
process.exit(hits.length ? 1 : 0);
