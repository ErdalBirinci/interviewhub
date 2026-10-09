import { io } from "socket.io-client";
import { APP, checkServer, decodeSession, loadOrCreateTestEnv } from "./testenv.mjs";

let [tokenA, tokenB, roomId] = process.argv.slice(2);
const autoProvisioned = !tokenA || !tokenB || !roomId;

const log = (who, ...args) => console.log(`[${who}]`, ...args);

/**
 * Cikis oncesi socket'leri temizle.
 * Disconnect baglanti handle'larini asenkron kapatir; beklemeden
 * process.exit() cagirmak Windows'ta libuv assertion'ini
 * (src/win/async.c "!(handle->flags & UV_HANDLE_CLOSING)") tetikler.
 */
async function shutdown(code) {
  for (const sock of [a, b]) {
    try {
      sock?.disconnect();
    } catch {
      /* yoksay */
    }
  }
  await new Promise((r) => setTimeout(r, 250));
  process.exit(code);
}

const fail = async (msg) => {
  console.error("FAIL:", msg);
  await shutdown(1);
};

// Arguman verilmediyse sunucudan kendisi test ortami hazirlar.
if (autoProvisioned) {
  try {
    await checkServer();
    const env = await loadOrCreateTestEnv();
    tokenA ||= env.a;
    tokenB ||= env.b;
    roomId ||= env.roomId;
  } catch (err) {
    console.error("kullanim: node scripts/signal-test.mjs [tokenA tokenB roomId]");
    console.error('token: POST /auth/demo {"name":"Ayse Yilmaz"} -> { token }');
    console.error("HATA:", err.message);
    process.exit(2);
  }
}

const expectedNameA = decodeSession(tokenA)?.name ?? "Ayse Yilmaz";

const a = io(APP, { auth: { token: tokenA } });
const b = io(APP, { auth: { token: tokenB } });

// Baglanti hatasinda askida kalmasin (yoneticisiz beklemeyi onle).
a.on("connect_error", (err) => void fail(`A connect_error: ${err.message}`));
b.on("connect_error", (err) => void fail(`B connect_error: ${err.message}`));

const emitJoin = (sock, name) =>
  new Promise((resolve, reject) => {
    sock.timeout(5000).emit("room:join", { roomId, name }, (err, ack) =>
      err ? reject(new Error("join timeout")) : resolve(ack),
    );
  });

const wait = (sock, event, ms = 5000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout: ${event}`)), ms);
    sock.once(event, (payload) => {
      clearTimeout(t);
      resolve(payload);
    });
  });

try {
  await new Promise((r) => (a.connected ? r() : a.on("connect", r)));
  log("A", "baglandi");

  const ackA = await emitJoin(a, "Ayse (ev sahibi)");
  if (!ackA.ok || ackA.peers.length !== 0) await fail("A katilim beklenen: " + JSON.stringify(ackA));
  if (!ackA.self || ackA.self.role !== "host") await fail("A kendi bilgisi (self) alamadi");
  if (!ackA.self.profile || !ackA.self.profile.fullName)
    await fail(
      `A kendi paylasilan profilini alamadi (beklenen: ${expectedNameA}). ` +
        "Profil PUT /api/me/profile ile kaydedilmis mi?",
    );
  log("A", "odaya katildi, selfId=", ackA.selfId, "self.profile=", ackA.self.profile.fullName);

  const peerJoinedPromise = wait(a, "room:peer-joined");
  await new Promise((r) => (b.connected ? r() : b.on("connect", r)));
  const ackB = await emitJoin(b, "Mehmet (aday)");
  if (!ackB.ok) await fail("B katilim basarisiz");
  if (ackB.peers.length !== 1) await fail("B mevcut katilimci gormeli: " + ackB.peers.length);
  log("B", "odaya katildi, gelen peer profile:", ackB.peers[0].profile?.fullName);

  const joined = await peerJoinedPromise;
  log("A", "peer-joined:", joined.peer.name, "| profil:", joined.peer.profile?.headline);
  if (!joined.peer.profile) await fail("A, B'nin profilini alamadi");
  if (joined.peer.role !== "guest") await fail("ikinci katilimci guest olmali");

  // sinyal relay
  const offerPromise = wait(b, "rtc:signal");
  a.emit("rtc:signal", {
    to: joined.peer.id,
    signal: { type: "offer", sdp: "v=0 test-sdp" },
  });
  const sig = await offerPromise;
  if (sig.from !== ackA.selfId || sig.signal.sdp !== "v=0 test-sdp")
    await fail("sinyal relay hatali: " + JSON.stringify(sig));
  log("B", "sinyal aldi from=", sig.from);

  // medya durumu yayini
  const mediaPromise = wait(b, "media:state");
  a.emit("media:state", { mic: false, cam: true, screen: false });
  const media = await mediaPromise;
  if (media.mic !== false) await fail("media state yayinlanmadi");
  log("B", "media state alindi:", JSON.stringify(media));

  // chat
  const chatPromise = wait(b, "chat:message");
  a.emit("chat:send", { text: "Merhaba, gorusmeye baslayalim" });
  const chat = await chatPromise;
  if (chat.message.text !== "Merhaba, gorusmeye baslayalim") await fail("chat relay hatali");
  log("B", "chat alindi:", chat.message.fromName, "-", chat.message.text);

  // ayrilma
  const leftPromise = wait(a, "room:peer-left");
  b.disconnect();
  const left = await leftPromise;
  if (left.peerId !== joined.peer.id) await fail("peer-left id hatali");
  log("A", "peer-left alindi:", left.peerId);

  console.log("\nOK - sinyal katmaninin tum olaylari calisti.");
  await shutdown(0);
} catch (err) {
  console.error("FAIL:", err.message);
  await shutdown(1);
}
