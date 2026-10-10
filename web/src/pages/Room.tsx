import { useEffect, useRef, useState } from "react";
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
import AIEvaluationPanel from "../room/AIEvaluationPanel";
import { useMedia } from "../room/useMedia";
import { useRoom } from "../room/useRoom";
import { useRecording, useTranscription } from "../room/useRecording";
import { useTranslation } from "../i18n/useTranslation";
import {
  CameraIcon,
  CameraOffIcon,
  MicIcon,
  MicOffIcon,
  RefreshIcon,
  BotIcon,
} from "../components/icons";

const DEFAULT_ICE: IceServerLike[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

interface RoomMetaResponse {
  room: { id: string; title: string; hostId: string; hostName: string; active: number; createdAt: number };
}

type SideTab = "profil" | "sohbet" | "transkript" | "ai";

export default function Room() {
  const { id: routeId = "" } = useParams();
  const { t, i18n } = useTranslation();
  const roomId = routeId;

  const { me, loading: authLoading, hasProfile } = useAuth();
  const { stream, state: mediaState, error: mediaError } = useMedia();

  const [iceServers, setIceServers] = useState<IceServerLike[]>(DEFAULT_ICE);
  const [meta, setMeta] = useState<RoomMetaResponse["room"] | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [name, setName] = useState("");
  const [tab, setTab] = useState<SideTab>("profil");
  const [sideOpen, setSideOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Kayıt + transkripsiyon + AI
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "paused">("idle");
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const [transcriptActive, setTranscriptActive] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiPosition, setAiPosition] = useState("");
  const [aiNotes, setAiNotes] = useState("");

  const room = useRoom({ roomId, name, localStream: stream, iceServers });

  const micReady = Boolean(stream?.getAudioTracks().length);
  const camReady = Boolean(stream?.getVideoTracks().length);

  /* ---------- Kayıt: yerel akış (kamera+mikrofon+ekran) ---------- */
  const recordingStream = room.screenActive ? room.screenStream : stream;
  const recording = useRecording(recordingStream);

  /* ---------- Transkripsiyon ---------- */
  const transcription = useTranscription();

  /* Kopyalama */
  const copyInvite = async () => {
    const ok = await copyText(`${window.location.origin}/room/${roomId}`);
    setCopied(ok);
    setTimeout(() => setCopied(false), 1800);
  };

  /* Oda meta + ICE */
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

  /* İsim varsayılanı */
  useEffect(() => {
    if (!name && me?.name) setName(me.name);
  }, [me, name]);

  /* Profil panelinde varsayılan seçim */
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

  /* Otomasyon/test: ?autojoin=1 */
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("autojoin")) return;
    if (canJoin && room.status === "idle") room.join();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canJoin, room.status]);

  /* Klavye kısayolları: M/C/S/P + R/T */
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
      } else if (key === "r" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (joined && recording.state === "idle") recording.start();
        else if (joined && recording.state === "recording") recording.pause();
        else if (joined && recording.state === "paused") recording.resume();
      } else if (key === "t" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (joined) transcription.start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [joined, room, recording, transcription]);

  /* Kayıt durumunu Controls'a aktar */
  useEffect(() => {
    setRecordingState(recording.state);
  }, [recording.state]);

  useEffect(() => {
    setRecordingDurationMs(recording.durationMs);
  }, [recording.durationMs]);

  useEffect(() => {
    setTranscriptActive(transcription.isListening);
  }, [transcription.isListening]);

  /* ----------------------------- ekranlar ---------------------------------- */

  if (authLoading || metaLoading) {
    return (
      <div className="center-screen">
        <div className="spinner" />
        <p className="muted">{t("room.preparing")}</p>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="center-screen">
        <LoginCard
          title={t("room.joinLoginTitle")}
          note={t("room.joinLoginNote")}
        />
      </div>
    );
  }

  if (metaError || !meta) {
    return (
      <div className="center-screen">
        <div className="card">
          <h2>{t("room.notFoundTitle")}</h2>
          <p className="muted">{metaError ?? t("room.invalidLink")}</p>
          <Link className="btn btn--primary" to="/dashboard">
            {t("room.backToInterviews")}
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
            name={name || me.name}
            cam={room.media.cam}
            mic={room.media.mic}
            mirrored
            footer={
              !hasProfile && (
                <div className="gate__profilehint">
                  {t("room.profileNotShared")}{" "}
                  <Link to="/profile">{t("room.profileLink")}</Link>
                </div>
              )
            }
          />
        </div>

        <div className="gate__side">
          <p className="eyebrow">{t("room.eyebrow")}</p>
          <h1>{meta.title}</h1>
          <p className="muted">
            {t("dashboard.host")}: <strong>{meta.hostName}</strong> · {roomUrl}
          </p>

          <label className="field">
            <span>{t("room.displayName")}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder={t("room.namePlaceholder")}
            />
          </label>

          {mediaError && <p className="error">{mediaError}</p>}
          {failed && <p className="error">{room.error}</p>}
          {left && <p className="hint">{t("room.leftMeeting")}</p>}

          <div className="gate__toggles">
            <button
              className={`btn ${room.media.mic ? "btn--secondary" : "btn--secondary btn--danger"}`}
              onClick={room.toggleMic}
              disabled={!micReady}
            >
              {room.media.mic ? <MicIcon size={16} /> : <MicOffIcon size={16} />}
              {room.media.mic ? t("room.micOn") : t("room.micOff")}
            </button>
            <button
              className={`btn ${room.media.cam ? "btn--secondary" : "btn--secondary btn--danger"}`}
              onClick={room.toggleCam}
              disabled={!camReady}
            >
              {room.media.cam ? <CameraIcon size={16} /> : <CameraOffIcon size={16} />}
              {room.media.cam ? t("room.camOn") : t("room.camOff")}
            </button>
          </div>

          <button
            className="btn btn--primary btn--lg btn--block"
            onClick={room.join}
            disabled={!canJoin || room.status === "connecting"}
          >
            {room.status === "connecting"
              ? t("room.connecting")
              : left || failed
              ? t("room.rejoin")
              : t("room.join")}
          </button>

          {!canJoin && room.status !== "connecting" && (
            <p className="hint">
              {!meta ? t("room.loadingMeta") : !ready ? t("room.preparingMedia") : t("room.enterName")}
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

  // AI paneli için seçili aday profili
  const aiCandidate = selectedPeer?.profile ?? null;

  return (
    <div className="room">
      <header className="room__top">
        <span className="room__dot" title={t("room.connected")} />
        <strong className="room__title">{meta.title}</strong>
        <span className="muted room__count">{participants} {t("room.people")}</span>
        <button
          className={`btn btn--ghost btn--sm ${copied ? "btn--ok" : ""}`}
          onClick={() => void copyInvite()}
          title={roomUrl}
        >
          {copied ? t("room.copied") : t("room.copyInvite")}
        </button>
        <span className="room__spacer" />
        <Link className="btn btn--ghost btn--sm" to="/dashboard">
          {t("room.backInterviews")}
        </Link>
      </header>

      <div className={`room__body ${sideOpen ? "" : "room__body--wide"}`}>
        <section className="stage">
          <div className={`stage__grid stage__grid--count-${Math.min(room.peers.length + 1, 6)}`}>
            <VideoTile
              stream={room.localPreview}
              name={name || me.name}
              suffix={t("room.selfSuffix")}
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
            sideLabel={sideOpen ? t("room.sideHide") : t("room.sideShow")}
            participants={participants}
            recordingState={recording.state}
            onRecordStart={recording.start}
            onRecordPause={recording.pause}
            onRecordResume={recording.resume}
            onRecordStop={recording.stop}
            onRecordDownload={recording.download}
            recordingDurationMs={recording.durationMs}
            transcriptActive={transcription.isListening}
            onTranscriptToggle={() => (transcription.isListening ? transcription.stop() : transcription.start())}
          />
        </section>

        {/* AI Değerlendirme Paneli (modal) */}
        {showAIPanel && (
          <AIEvaluationPanel
            roomId={roomId}
            hostName={meta.hostName}
            candidateProfile={aiCandidate}
            position={aiPosition}
            notes={aiNotes}
            onNotesChange={setAiNotes}
            onPositionChange={setAiPosition}
            onClose={() => setShowAIPanel(false)}
          />
        )}

        <aside className={`side ${sideOpen ? "" : "side--hidden"}`}>
          <div className="side__tabs">
            <button
              className={tab === "profil" ? "tab tab--active" : "tab"}
              onClick={() => setTab("profil")}
            >
              {t("room.sidePanel.tabs.profile")}
            </button>
            <button
              className={tab === "sohbet" ? "tab tab--active" : "tab"}
              onClick={() => setTab("sohbet")}
            >
              {t("room.sidePanel.tabs.chat")}
              {room.chat.length > 0 && <span className="tab__badge">{room.chat.length}</span>}
            </button>
            <button
              className={tab === "transkript" ? "tab tab--active" : "tab"}
              onClick={() => setTab("transkript")}
            >
              {t("room.sidePanel.tabs.transcript")}
              {transcription.segments.length > 0 && <span className="tab__badge">{transcription.segments.length}</span>}
            </button>
            {meta.hostId === me?.id && (
              <button
                className={tab === "ai" ? "tab tab--active" : "tab"}
                onClick={() => {
                  setTab("ai");
                  setShowAIPanel(true);
                }}
              >
                <BotIcon size={16} style={{ marginRight: 4, verticalAlign: "middle" }} />
                {t("room.sidePanel.tabs.ai")}
              </button>
            )}
          </div>

          <div className="side__content">
            {tab === "profil" ? (
              <ProfilePanel
                peers={panelPeers}
                selfId={room.selfId}
                selectedId={selectedPeer?.id ?? null}
                onSelect={setSelectedId}
              />
            ) : tab === "sohbet" ? (
              <ChatPanel
                messages={room.chat}
                selfId={room.selfId}
                onSend={room.sendChat}
                disabled={room.status !== "joined"}
              />
            ) : tab === "transkript" ? (
              <TranscriptPanel
                segments={transcription.segments}
                isListening={transcription.isListening}
                error={transcription.error}
                lang={transcription.lang}
                fullText={transcription.fullText}
                onToggle={() => (transcription.isListening ? transcription.stop() : transcription.start())}
                onClear={transcription.clear}
                onCopy={async () => {
                  await navigator.clipboard.writeText(transcription.fullText);
                }}
                onLanguageChange={transcription.setLanguage}
              />
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ----------------------- Transkript Yan Paneli ----------------------- */

function TranscriptPanel({
  segments,
  isListening,
  error,
  lang,
  fullText,
  onToggle,
  onClear,
  onCopy,
  onLanguageChange,
}: {
  segments: { id: string; text: string; timestamp: number; isFinal: boolean }[];
  isListening: boolean;
  error: string | null;
  lang: string;
  fullText: string;
  onToggle: () => void;
  onClear: () => void;
  onCopy: () => void;
  onLanguageChange: (lang: string) => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <div className="transcript-panel">
      <div className="transcript-panel__header">
        <div className="transcript-panel__status">
          <span className={`status-dot ${isListening ? "status-dot--live" : ""}`} />
          <span>{isListening ? t("room.sidePanel.transcript.status.listening") : t("room.sidePanel.transcript.status.idle")}</span>
        </div>
        <select
          value={lang}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="transcript-panel__lang"
          disabled={isListening}
          aria-label={t("nav.language")}
        >
          <option value="tr-TR">{t("room.sidePanel.transcript.languages.tr-TR")}</option>
          <option value="en-US">{t("room.sidePanel.transcript.languages.en-US")}</option>
          <option value="de-DE">{t("room.sidePanel.transcript.languages.de-DE")}</option>
          <option value="fr-FR">{t("room.sidePanel.transcript.languages.fr-FR")}</option>
        </select>
      </div>

      {error && <div className="error transcript-panel__error">{error}</div>}

      <div className="transcript-panel__actions">
        <button className="btn btn--primary btn--sm" onClick={onToggle}>
          {isListening ? t("room.sidePanel.transcript.stop") : t("room.sidePanel.transcript.start")}
        </button>
        <button className="btn btn--ghost btn--sm" onClick={onCopy} disabled={!fullText}>
          {t("room.sidePanel.transcript.actions.copy")}
        </button>
        <button className="btn btn--ghost btn--sm" onClick={onClear} disabled={segments.length === 0}>
          {t("room.sidePanel.transcript.actions.clear")}
        </button>
      </div>

      <div className="transcript-panel__list" role="log" aria-live="polite" aria-label={t("room.sidePanel.transcript.ariaLabel")}>
        {segments.length === 0 && (
          <p className="hint transcript-panel__empty">
            {isListening
              ? t("room.sidePanel.transcript.empty.listening")
              : t("room.sidePanel.transcript.empty.idle")}
          </p>
        )}
        {segments.map((seg) => (
          <div
            key={seg.id}
            className={`transcript-seg ${seg.isFinal ? "transcript-seg--final" : "transcript-seg--interim"}`}
          >
            <span className="transcript-seg__time">
              {new Date(seg.timestamp).toLocaleTimeString(i18n.language, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
            <span className="transcript-seg__text">{seg.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}