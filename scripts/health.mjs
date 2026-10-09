/**
 * Sunucu saglik kontrolu — "site calisiyor mu?" sorusunun tek komutluk cevabi.
 * Kullanim: npm run status
 * Cikis kodu: 0 = saglikli, 1 = yanit yok/hatali
 */
import { APP } from "./testenv.mjs";

const url = `${APP}/api/health`;

try {
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.ok) throw new Error("beklenmeyen cevap");

  const time = Math.floor(process.uptime());
  console.log(`OK    ${url}`);
  console.log(
    `      pid=${data.pid} · uptime=${data.uptimeSec}sn · bagli=${data.clients} · oda=${data.rooms}`,
  );
  console.log(
    `      LinkedIn=${data.linkedin ? "acik" : "kapali"} · demo girisi=${data.demo ? "acik" : "kapali"} · rapor=${data.time}`,
  );
  process.exit(0);
} catch (err) {
  console.error(`FAIL  ${url}`);
  console.error(`      ${err.message}`);
  console.error("      Sunucuyu baslatin:  npm start   (veya npm run start:watch)");
  process.exit(1);
}
