/**
 * Tek sayfa ekran goruntusu alir (CDP gerekir).
 * Kullanim: node scripts/screenshot.mjs <url> [cikti.png]
 */
import { connect, evaluate, newTarget, screenshot } from "./cdp.mjs";

const url = process.argv[2];
if (!url) {
  console.error("kullanim: node scripts/screenshot.mjs <url> [cikti.png]");
  process.exit(2);
}
const out = process.argv[3] ?? `${process.env.TEMP ?? "."}/ih-shot.png`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tab = await newTarget("about:blank");
const client = connect(tab.webSocketDebuggerUrl);
await client.send("Page.enable");
await client.send("Page.navigate", { url });
await sleep(3500);
const info = await evaluate(client, `JSON.stringify({ title: document.title, text: document.body.innerText.replace(/\\s+/g, " ").slice(0, 300) })`);
console.log("INFO:", info);
await screenshot(client, out);
console.log("SHOT:", out);
client.close();
