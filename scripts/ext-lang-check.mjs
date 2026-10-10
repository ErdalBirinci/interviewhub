// Dil seciminin gercekten calistigini dogrular: panel acilir, dil secicisi
// sirayla degistirilir ve metnin o dile gectigi kontrol edilir.
const EXT_ID = "lpgdjbfhdlnkdhjflbiciapanaipedip";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTargets() {
  const res = await fetch("http://localhost:9333/json");
  return res.json();
}

// Paneli yeni bir sekmede ac
await fetch("http://localhost:9333/json/new?about:blank", { method: "PUT" });
await sleep(600);
let targets = await getTargets();
let tab = targets.find((t) => t.type === "page");
if (!tab) throw new Error("CDP sayfa hedefi yok");

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  return { send, close: () => ws.close() };
}

const c = await connect(`ws://127.0.0.1:9333/devtools/page/${tab.id}`);
await c.send("Page.enable");
await c.send("Page.navigate", { url: `chrome-extension://${EXT_ID}/sidepanel.html` });
await sleep(1500);
const evaluate = async (expr) => {
  const r = await c.send("Runtime.evaluate", {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  });
  return r?.result?.value;
};

const expect = [
  ["en", "Rooms open with your LinkedIn identity"],
  ["tr", "Görüşme odaları LinkedIn kimliğinizle açılır"],
  ["de", "Räume werden mit Ihrer LinkedIn-Identität eröffnet"],
  ["fr", "Les salles s'ouvrent avec votre identité LinkedIn"],
  ["es", "Las salas se abren con tu identidad de LinkedIn"],
  ["ru", "Комнаты открываются под вашей личностью LinkedIn"],
  ["ja", "ルームは LinkedIn のアイデンティティで開かれます"],
  ["zh", "会议室使用您的 LinkedIn 身份开启"],
];

let ok = 0;
for (const [lang, needle] of expect) {
  await evaluate(`(() => {
    const s = document.getElementById("lang");
    s.value = ${JSON.stringify(lang)};
    s.dispatchEvent(new Event("change"));
    return true;
  })()`);
  await sleep(120);
  const lead = await evaluate(`document.querySelector(".lead")?.textContent?.trim() ?? ""`);
  const btn = await evaluate(`document.getElementById("btn-auth")?.textContent?.trim() ?? ""`);
  const matched = lead.includes(needle);
  if (matched) ok++;
  console.log(
    `${matched ? "OK  " : "FAIL"} ${lang}  btn="${btn}"  lead="${lead.slice(0, 62)}..."`,
  );
}

const langAttr = await evaluate(`document.documentElement.lang`);
console.log(`\n<html lang> = "${langAttr}"`);
console.log(`SONUC: ${ok}/${expect.length} dil dogrulandi`);
c.close();
process.exit(ok === expect.length ? 0 : 1);
