import type { MediaFlags } from "./useRoom";
import {
  CameraIcon,
  CameraOffIcon,
  LeaveIcon,
  MicIcon,
  MicOffIcon,
  PanelIcon,
  ScreenIcon,
  UsersIcon,
  RecordIcon,
  RecordOffIcon,
  TranscriptIcon,
} from "../components/icons";

interface ControlsProps {
  media: MediaFlags;
  screenActive: boolean;
  /** Cihaz var mi? (izin verilmediyse buton devre disi kalir) */
  micAvailable: boolean;
  camAvailable: boolean;
  onMic: () => void;
  onCam: () => void;
  onScreen: () => void;
  onLeave: () => void;
  onToggleSide?: () => void;
  sideLabel?: string;
  disabled?: boolean;
  participants: number;
  /** Kayıt kontrolleri */
  recordingState?: "idle" | "recording" | "paused";
  onRecordStart?: () => void;
  onRecordPause?: () => void;
  onRecordResume?: () => void;
  onRecordStop?: () => void;
  onRecordDownload?: () => void;
  recordingDurationMs?: number;
  /** Transkripsiyon kontrolleri */
  transcriptActive?: boolean;
  onTranscriptToggle?: () => void;
}

/** Klavye kısayolu rozetini gosteren kucuk etiket */
function Kbd({ children }: { children: string }) {
  return <kbd className="ctrl__kbd" aria-hidden="true">{children}</kbd>;
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function Controls({
  media,
  screenActive,
  micAvailable,
  camAvailable,
  onMic,
  onCam,
  onScreen,
  onLeave,
  onToggleSide,
  sideLabel,
  disabled = false,
  participants,
  recordingState = "idle",
  onRecordStart,
  onRecordPause,
  onRecordResume,
  onRecordStop,
  onRecordDownload,
  recordingDurationMs = 0,
  transcriptActive = false,
  onTranscriptToggle,
}: ControlsProps) {
  return (
    <div className="controls">
      <button
        className={`ctrl ${media.mic ? "" : "ctrl--off"}`}
        onClick={onMic}
        disabled={disabled || !micAvailable}
        title={media.mic ? "Mikrofonu kapat (M)" : "Mikrofonu aç (M)"}
        aria-label={media.mic ? "Mikrofonu kapat" : "Mikrofonu aç"}
        aria-keyshortcuts="m"
      >
        <span className="ctrl__icon">{media.mic ? <MicIcon /> : <MicOffIcon />}</span>
        <span className="ctrl__label">{media.mic ? "Mikrofon" : "Sessiz"}</span>
        <Kbd>M</Kbd>
      </button>

      <button
        className={`ctrl ${media.cam ? "" : "ctrl--off"}`}
        onClick={onCam}
        disabled={disabled || !camAvailable}
        title={media.cam ? "Kamerayı kapat (C)" : "Kamerayı aç (C)"}
        aria-label={media.cam ? "Kamerayı kapat" : "Kamerayı aç"}
        aria-keyshortcuts="c"
      >
        <span className="ctrl__icon">{media.cam ? <CameraIcon /> : <CameraOffIcon />}</span>
        <span className="ctrl__label">{media.cam ? "Kamera" : "Kapalı"}</span>
        <Kbd>C</Kbd>
      </button>

      <button
        className={`ctrl ${screenActive ? "ctrl--active" : ""}`}
        onClick={() => void onScreen()}
        disabled={disabled}
        title="Ekranı paylaş (S)"
        aria-label="Ekranı paylaş"
        aria-keyshortcuts="s"
      >
        <span className="ctrl__icon"><ScreenIcon /></span>
        <span className="ctrl__label">{screenActive ? "Paylaşılıyor" : "Ekran"}</span>
        <Kbd>S</Kbd>
      </button>

      {/* KAYIT */}
      {onRecordStart && (
        <>
          {recordingState === "idle" && (
            <button
              className="ctrl ctrl--record"
              onClick={onRecordStart}
              disabled={disabled}
              title="Kaydı başlat (R)"
              aria-label="Kaydı başlat"
              aria-keyshortcuts="r"
            >
              <span className="ctrl__icon"><RecordIcon /></span>
              <span className="ctrl__label">Kayıt</span>
              <Kbd>R</Kbd>
            </button>
          )}
          {recordingState === "recording" && (
            <button
              className="ctrl ctrl--record ctrl--recording"
              onClick={onRecordPause}
              disabled={disabled}
              title="Kaydı duraklat"
              aria-label="Kaydı duraklat"
            >
              <span className="ctrl__icon"><RecordIcon /></span>
              <span className="ctrl__label">
                <span className="rec-dot" aria-hidden="true" /> Kayıt {formatMs(recordingDurationMs ?? 0)}
              </span>
            </button>
          )}
          {recordingState === "paused" && (
            <button
              className="ctrl ctrl--record ctrl--paused"
              onClick={onRecordResume}
              disabled={disabled}
              title="Kaydı devam ettir"
              aria-label="Kaydı devam ettir"
            >
              <span className="ctrl__icon"><RecordOffIcon /></span>
              <span className="ctrl__label">Duraklatıldı</span>
            </button>
          )}
        </>
      )}

      {/* TRANSKRİPSİYON */}
      {onTranscriptToggle && (
        <button
          className={`ctrl ${transcriptActive ? "ctrl--active" : ""}`}
          onClick={onTranscriptToggle}
          disabled={disabled}
          title={transcriptActive ? "Transkripsiyonu durdur (T)" : "Transkripsiyonu başlat (T)"}
          aria-label={transcriptActive ? "Transkripsiyonu durdur" : "Transkripsiyonu başlat"}
          aria-keyshortcuts="t"
        >
          <span className="ctrl__icon"><TranscriptIcon /></span>
          <span className="ctrl__label">{transcriptActive ? "Yazılıyor" : "Transkript"}</span>
          <Kbd>T</Kbd>
        </button>
      )}

      <span className="controls__count" title="Odaktaki kişi sayısı">
        <UsersIcon size={16} />
        <span>{participants}</span>
      </span>

      {onToggleSide && (
        <button className="ctrl ctrl--side" onClick={onToggleSide} title={sideLabel ?? "Paneli aç/kapat (P)"} aria-label={sideLabel ?? "Panel"} aria-keyshortcuts="p">
          <span className="ctrl__icon"><PanelIcon /></span>
          <span className="ctrl__label">{sideLabel ?? "Panel"}</span>
          <Kbd>P</Kbd>
        </button>
      )}

      <button className="ctrl ctrl--leave" onClick={onLeave} title="Görüşmeden ayrıl" aria-label="Görüşmeden ayrıl">
        <span className="ctrl__icon"><LeaveIcon /></span>
        <span className="ctrl__label">Ayrıl</span>
      </button>
    </div>
  );
}
