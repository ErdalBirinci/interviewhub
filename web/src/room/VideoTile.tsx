import { useEffect, useRef, useState, type ReactNode } from "react";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "?";
}

/** İsimden deterministik gradient üretir (avatar arka planı). */
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#7c3aed,#db2777)",
  "linear-gradient(135deg,#2563eb,#06b6d4)",
  "linear-gradient(135deg,#059669,#84cc16)",
  "linear-gradient(135deg,#d97706,#f43f5e)",
  "linear-gradient(135deg,#4f46e5,#0ea5e9)",
  "linear-gradient(135deg,#be185d,#f59e0b)",
];

export function avatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

interface VideoTileProps {
  stream?: MediaStream | null;
  name: string;
  /** Adin yaninda gosterilen kisa etiket (orn. "(siz)") - bas harflere girmez */
  suffix?: string;
  headline?: string;
  role?: "host" | "guest";
  isSelf?: boolean;
  mirrored?: boolean;
  cam?: boolean;
  mic?: boolean;
  screen?: boolean;
  connectionState?: RTCPeerConnectionState;
  footer?: ReactNode;
}

/** Ses seviyesi ölçer — canvas ile hafif, 5 sn'de bir örnek. */
function useAudioLevel(stream: MediaStream | null | undefined): number {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!stream) return;
    const audio = stream.getAudioTracks()[0];
    if (!audio) return;

    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let data: Uint8Array<ArrayBuffer> | null = null;
    let src: MediaStreamAudioSourceNode | null = null;

    const sample = () => {
      if (!analyser || !data) return;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      // 0..1 arasına normalize et (kübik ile hassasiyet artır)
      const norm = Math.min(1, Math.pow(rms * 3, 2));
      setLevel((prev) => (Math.abs(prev - norm) > 0.03 ? norm : prev));
      rafRef.current = requestAnimationFrame(sample);
    };

    const start = () => {
      try {
        ctx = new AudioContext();
        analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src = ctx.createMediaStreamSource(stream);
        src.connect(analyser);
        data = new Uint8Array(analyser.fftSize);
        sample();
      } catch {
        /* ses analizi desteklenmiyorsa sessiz geç */
      }
    };

    // Tarayıcı autoplay ilkesi: ilk kullanıcı etkileşiminde başlat
    const kick = () => start();
    window.addEventListener("pointerdown", kick, { once: true });
    // Eğer sayfa zaten etkileşimliyse (test ortamı) hemen başlat
    if (document.hasFocus()) start();

    return () => {
      window.removeEventListener("pointerdown", kick);
      cancelAnimationFrame(rafRef.current);
      try {
        src?.disconnect();
        analyser?.disconnect();
        void ctx?.close();
      } catch {
        /* yoksay */
      }
    };
  }, [stream]);

  return level;
}

export default function VideoTile({
  stream,
  name,
  suffix,
  headline,
  role,
  isSelf = false,
  mirrored = false,
  cam = true,
  mic = true,
  screen = false,
  connectionState,
  footer,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioLevel = useAudioLevel(stream);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream ?? null;
    if (stream) void el.play().catch(() => {});
  }, [stream, cam, screen]);

  // Kamera kapaliyken ekran paylasimi da goruntuyu gosterir (ekran = video).
  const showVideo = (cam || screen) && Boolean(stream);
  const connecting = connectionState && !["connected", "completed"].includes(connectionState);
  const failed = connectionState === "failed" || connectionState === "closed";
  const speaking = mic && audioLevel > 0.08;

  return (
    <div
      className={`tile ${showVideo ? "" : "tile--nocam"} ${isSelf ? "tile--self" : ""} ${speaking ? "tile--speaking" : ""}`}
    >
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          className={`tile__video ${mirrored && !screen ? "tile__video--mirror" : ""}`}
        />
      ) : (
        <div className="tile__avatar" style={{ background: avatarGradient(name) }} aria-hidden>
          {initials(name)}
        </div>
      )}

      {/* Konuşma göstergesi: tile kenarlığında nabız */}
      {speaking && <span className="tile__speaking-ring" aria-hidden="true" />}

      <div className="tile__overlay">
        <span className={`tile__name ${!mic ? "tile__name--muted" : ""}`}>
          {!mic && <span className="tile__micoff" title="Mikrofon kapalı">🔇</span>}
          {name}
          {suffix && <em className="tile__suffix">{suffix}</em>}
          {role === "host" && <em className="tile__role">ev sahibi</em>}
          {screen && <em className="tile__role tile__role--screen">ekran paylaşıyor</em>}
        </span>
        {connecting && (
          <span className="tile__conn">{failed ? "bağlantı kesildi" : "bağlanıyor…"}</span>
        )}
      </div>

      {headline && <div className="tile__headline">{headline}</div>}
      {footer}
    </div>
  );
}
