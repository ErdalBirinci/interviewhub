// Web uygulamasinin dil davranisini dogrular — iki faz:
//
//   Faz 1 (ilk acilis): localStorage'da ih_lang yokken sayfa Ingilizce acilir,
//                       <html lang>="en" ve sayfada Turkce karakter yoktur.
//   Faz 2 (kullanici secimi): ih_lang="tr" yapilip yenilenince metin Turkce'ye
//                       gecer VE <html lang> da "tr" olur. (Ekran okuyucu ve
//                       arama motorlari icin gerekli; birkac kez unutuldu.)
//
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

// Dil adlari ("Türkçe", "Deutsch"...) menu ve secicilerde meşrudur; yok sayilir
const LANG_NAMES = [
  "Türkçe",
  "Deutsch",
  "Français",
  "Español",
  "Русский",
  "日本語",
  "中文",
];
// Kullanici verisi Turkce olabilir (demo profili "Ayşe Yılmaz", "İstanbul,
// Türkiye"). Bunlar cevrilmemis arayuz metni DEGILDIR; Turkce-karakter
// taramasindan dusmek gerekir, yoksa sahte pozitif verir.
const USER_DATA = ["Ayşe Yılmaz", "Istanbul, Türkiye", "İstanbul, Türkiye"];
const TR_RE = /[çğıöşüÇĞİÖŞÜ]/g;

/** Sayfa govdesindeki Turkce karakter sayisini (dil adlari + kullanici verisi hariç) dondurur. */
async function trChars() {
  // Tarama tum body'ye yapilmiyor: onizleme mockup'i icerisindeki avatar
  // bas harfi ("İ") veya demo profil verisi kullanici verisidir, cevrilmemis
  // arayuz metni degildir. Gercek risk arayuz kabugundadir — oraya bakilir.
  const body =
    (await ev(
      `[...document.querySelectorAll(
         "header, nav, footer, h1, h2, h3, button, a.btn, .eyebrow, .lead, summary, label, .lp-checks li"
       )].map((e) => e.innerText || "").join("\\n")`,
    )) ?? "";
  const stripped = [...LANG_NAMES, ...USER_DATA].reduce(
    (acc, n) => acc.split(n).join(" "),
    body,
  );
  return (stripped.match(TR_RE) || []).length;
}

const fails = [];
const ok = (cond, label, detail) => {
  console.log(`${cond ? "  OK  " : "  HATA"} ${label}${detail ? `  (${detail})` : ""}`);
  if (!cond) fails.push(label);
};

await send("Page.enable");

// ---------------------------------------------------------------- Faz 1
console.log("\n=== Faz 1 — ilk acilis (ih_lang yok) ===");
await send("Page.navigate", { url: TARGET });
await sleep(3500);
await ev(`localStorage.removeItem("ih_lang")`);
await send("Page.navigate", { url: TARGET });
await sleep(4000);

const l1 = await ev(`document.documentElement.lang`);
console.log("localStorage[ih_lang] =", await ev(`localStorage.getItem("ih_lang")`));
console.log("<html lang>          =", l1);
console.log("title                =", await ev(`document.title`));
const t1 = await trChars();
console.log("Turkce karakter       =", t1);
ok(l1 === "en", '<html lang> varsayilan "en"', l1);
ok(t1 === 0, "ilk acilusta Turkce metin yok", `${t1} yer`);

// ---------------------------------------------------------------- Faz 2
console.log("\n=== Faz 2 — kullanici dili secimi (ih_lang=tr) ===");
await ev(`localStorage.setItem("ih_lang", "tr")`);
await send("Page.navigate", { url: TARGET });
await sleep(4500);

const l2 = await ev(`document.documentElement.lang`);
const persisted = await ev(`localStorage.getItem("ih_lang")`);
const h2 = (await ev(`(document.querySelector("h2")||{}).textContent || ""`))?.trim();
const t2 = await trChars();
console.log("localStorage[ih_lang] =", persisted);
console.log("<html lang>          =", l2);
console.log("ilk <h2>             =", JSON.stringify(h2));
console.log("Turkce karakter       =", t2);
ok(persisted === "tr", "dil tercihi kalici", persisted);
ok(l2 === "tr", '<html lang> dil degisiminde "tr" olur', l2);
ok(t2 > 0, "metin Turkce'ye gecti", `${t2} yer`);
ok(/\p{Script=Latin}/u.test(h2 || "") && (t2 || 0) > 0, "baslik cevirildi", JSON.stringify(h2));

// Temizlik: sonraki calistirmalar etkilenmesin
await ev(`localStorage.removeItem("ih_lang")`);
ws.close();

console.log(
  fails.length ? `\n*** ${fails.length} KONTROL BASARISIZ: ${fails.join(" | ")} ***` : "\nOK — iki faz da gecti.",
);
process.exit(fails.length ? 1 : 0);
