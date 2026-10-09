import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { IceServerLike } from "@ih/shared";
import LoginCard from "../components/LoginCard";
import { api } from "../lib/api";
import { copyText } from "../lib/clipboard";
import { useAuth } from "../lib/auth";
import Controls from "../room/Controls";
import ChatPanel from "../room/ChatPanel";
import ProfilePanel from "../room/ProfilePanel";
import VideoTile from "../room/VideoTile";
import { useMedia } from "../room/useMedia";
import { useRoom } from "../room/useRoom";
import { CameraIcon, CameraOffIcon, MicIcon, MicOffIcon, RefreshIcon } from "../components/icons";

const DEFAULT_ICE: IceServerLike[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

interface RoomMetaResponse {
  room: { id: string; title: string; hostName: string; active: number; createdAt: number };
}

export default function Room() {
  const { id: routeId = "" } = useParams();
  const roomId = routeId;

  const { me, loading: authLoading, hasProfile } = useAuth();
  const { stream, state: mediaState, error: mediaError } = useMedia();

  const [iceServers, setIceServers] = useState<IceServerLike[]>(DEFAULT_ICE);
  const [meta, setMeta] = useState<RoomMetaResponse["room"] | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [name, setName] = useState("");
  const [tab, setTab] = useState<"profil" | "sohbet">("profil");
  const [sideOpen, setSideOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const room = useRoom({ roomId, name, localStream: stream, iceServers });
  const [copied, setCopied] = useState(false);

  const micReady = Boolean(stream?.getAudioTracks().length);
  const camReady = Boolean(stream?.getVideoTracks().length);

  const copyInvite = async () => {
    const ok = await copyText(`${window.location.origin}/room/${roomId}`);
    setCopied(ok);
    setTimeout(() => setCopied(false), 1800);
  };

  /* Oda meta bilgisi + ICE sunuculari */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [roomRes, iceRes] = await Promise.all([
          api<RoomMetaResponse>(`/api/rooms/${encodeURIComponent(roomId)}`),
          api<{ iceServers: IceServerLike[] }>("/api/ice").catch(() => ({ iceServers: DEFAULT_ICE })),
        ]);
        if (cancelled) return;
        setMeta(roomRes.room);
        setIceServers(iceRes.iceServers?.length ? iceRes.iceServers : DEFAULT_ICE);
      } catch (err) {
        if (!cancelled) setMetaError((err as Error).message);
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  /* Isim varsayilani */
  useEffect(() => {
    if (!name && me?.name) setName(me.name);
  }, [me, name]);

  /* Varsayilan olarak profil panelinde ilk profil sahibi katilimciyi sec */
  useEffect(() => {
    if (!room.peers.length) return;
    if (selectedId && room.peers.some((p) => p.info.id === selectedId)) return;
    const fallback =
      room.peers.find((p) => p.info.id !== room.selfId && p.info.profile) ??
      room.peers.find((p) => p.info.id !== room.selfId) ??
      room.peers[0];
    setSelectedId(fallback?.info.id ?? null);
  }, [room.peers, selectedId, room.selfId]);

  const joined = room.status === "joined";
  const ready = mediaState !== "requesting" && mediaState !== "idle";
  const canJoin = Boolean(meta) && ready && name.trim().length > 0 && !authLoading && Boolean(me);

  /* Otomasyon/test: ?autojoin=1 ile katilim ekrani beklemeden odaya gir */
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("autojoin")) return;
    if (canJoin && room.status === "idle") room.join();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canJoin, room.status]);

  /* Klavye kısayollari: M=mikrofon, C=kamera, S=ekran, P=panel */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const key = e.key.toLowerCase();
      if (key === "m" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (joined) room.toggleMic();
      } else if (key === "c" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (joined) room.toggleCam();
      } else if (key === "s" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (joined) void room.toggleScreen();
      } else if (key === "p" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (joined) setSideOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [joined, room]);

  /* ----------------------------- ekranlar ---------------------------------- */

  if (authLoading || metaLoading) {
    return (
      <div className="center-screen">
        <div className="spinner" />
        <p className="muted">Oda hazırlanıyor…</p>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="center-screen">
        <LoginCard
          title="Görüşmeye katılmak için giriş yapın"
          note="Kimliğiniz LinkedIn ile doğrulanır; odaya kendi profilinizle katılırsınız."
        />
      </div>
    );
  }

  if (metaError || !meta) {
    return (
      <div className="center-screen">
        <div className="card">
          <h2>Oda bulunamadı</h2>
          <p className="muted">{metaError ?? "Bağlantı geçersiz olabilir."}</p>
          <Link className="btn btn--primary" to="/dashboard">
            Görüşmelere dön
          </Link>
        </div>
      </div>
    );
  }

  const roomUrl = `${window.location.origin}/room/${meta.id}`;
  const participants = room.peers.length + (joined ? 1 : 0);

  /* --------------------------- katilim ekrani ------------------------------ */

  if (!joined) {
    const failed = room.status === "error";
    const left = room.status === "left";
    return (
      <div className="gate">
        <div className="gate__preview">
          <VideoTile
            stream={stream}
            name={name || "Siz"}
            cam={room.media.cam}
            mic={room.media.mic}
            mirrored
            footer={
              !hasProfile && (
                <div className="gate__profilehint">
                  Profiliniz paylaşılmadı.{" "}
                  <Link to="/profile">Profilinizi ekleyin →</Link>
                </div>
              )
            }
          />
        </div>

        <div className="gate__side">
          <p className="eyebrow">Görüşme odası</p>
          <h1>{meta.title}</h1>
          <p className="muted">
            Oda sahibi: <strong>{meta.hostName}</strong> · {roomUrl}
          </p>

          <label className="field">
            <span>Görünen adınız</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="Ad Soyad"
            />
          </label>

          {mediaError && <p className="error">{mediaError}</p>}
          {failed && <p className="error">{room.error}</p>}
          {left && <p className="hint">Görüşmeden ayrıldınız. Tekrar katılabilirsiniz.</p>}

          <div className="gate__toggles">
            <button
              className={`btn ${room.media.mic ? "btn--secondary" : "btn--secondary btn--danger"}`}
              onClick={room.toggleMic}
              disabled={!micReady}
            >
              {room.media.mic ? <MicIcon size={16} /> : <MicOffIcon size={16} />}
              {room.media.mic ? " Mikrofon açık" : " Mikrofon kapalı"}
            </button>
            <button
              className={`btn ${room.media.cam ? "btn--secondary" : "btn--secondary btn--danger"}`}
              onClick={room.toggleCam}
              disabled={!camReady}
            >
              {room.media.cam ? <CameraIcon size={16} /> : <CameraOffIcon size={16} />}
              {room.media.cam ? " Kamera açık" : " Kamera kapalı"}
            </button>
          </div>

          <button
            className="btn btn--primary btn--lg btn--block"
            onClick={room.join}
            disabled={!canJoin || room.status === "connecting"}
          >
            {room.status === "connecting"
              ? "Bağlanılıyor…"
              : left || failed
                ? "Yeniden katıl"
                : "Görüşmeye katıl"}
          </button>

          {!canJoin && room.status !== "connecting" && (
            <p className="hint">
              {!meta ? "Oda yükleniyor…" : !ready ? "Kamera/mikrofon hazırlanıyor…" : "Adınızı girin."}
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ------------------------------ oda ekrani ------------------------------- */

  const otherInfos = room.peers.map((p) => p.info);
  const panelPeers = room.selfInfo ? [room.selfInfo, ...otherInfos] : otherInfos;
  const selectedPeer =
    panelPeers.find((p) => p.id === selectedId) ?? panelPeers[0] ?? null;

  return (
    <div className="room">
      <header className="room__top">
        <span className="room__dot" title="Bağlı" />
        <strong className="room__title">{meta.title}</strong>
        <span className="muted room__count">{participants} kişi</span>
        <button
          className={`btn btn--ghost btn--sm ${copied ? "btn--ok" : ""}`}
          onClick={() => void copyInvite()}
          title={roomUrl}
        >
          {copied ? "Kopyalandı ✓" : "Davet bağlantısını kopyala"}
        </button>
        <span className="room__spacer" />
        <Link className="btn btn--ghost btn--sm" to="/dashboard">
          ← Görüşmeler
        </Link>
      </header>

      <div className={`room__body ${sideOpen ? "" : "room__body--wide"}`}>
        <section className="stage">
          <div className={`stage__grid stage__grid--count-${Math.min(room.peers.length + 1, 6)}`}>
            <VideoTile
              stream={room.localPreview}
              name={name || "Siz"}
              suffix="(siz)"
              isSelf
              mirrored={!room.screenActive}
              screen={room.screenActive}
              cam={room.screenActive ? true : room.media.cam}
              mic={room.media.mic}
              headline={room.selfInfo?.headline}
            />

            {room.peers.map((peer) => (
              <VideoTile
                key={peer.info.id}
                stream={peer.stream}
                name={peer.info.name}
                headline={peer.info.headline}
                role={peer.info.role}
                cam={peer.info.cam}
                mic={peer.info.mic}
                screen={peer.info.screen}
                connectionState={peer.pc.connectionState}
              />
            ))}
          </div>

          <Controls
            media={room.media}
            screenActive={room.screenActive}
            micAvailable={micReady}
            camAvailable={camReady}
            onMic={room.toggleMic}
            onCam={room.toggleCam}
            onScreen={() => void room.toggleScreen()}
            onLeave={room.leave}
            onToggleSide={() => setSideOpen((v) => !v)}
            sideLabel={sideOpen ? "Paneli gizle" : "Paneli göster"}
            participants={participants}
          />
        </section>

        <aside className={`side ${sideOpen ? "" : "side--hidden"}`}>
          <div className="side__tabs">
            <button
              className={tab === "profil" ? "tab tab--active" : "tab"}
              onClick={() => setTab("profil")}
            >
              LinkedIn Profili
            </button>
            <button
              className={tab === "sohbet" ? "tab tab--active" : "tab"}
              onClick={() => setTab("sohbet")}
            >
              Sohbet
              {room.chat.length > 0 && <span className="tab__badge">{room.chat.length}</span>}
            </button>
          </div>

          <div className="side__content">
            {tab === "profil" ? (
              <ProfilePanel
                peers={panelPeers}
                selfId={room.selfId}
                selectedId={selectedPeer?.id ?? null}
                onSelect={setSelectedId}
              />
            ) : (
              <ChatPanel
                messages={room.chat}
                selfId={room.selfId}
                onSend={room.sendChat}
                disabled={room.status !== "joined"}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
