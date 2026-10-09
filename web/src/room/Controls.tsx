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
}

/** Klavye kısayolu rozetini gosteren kucuk etiket */
function Kbd({ children }: { children: string }) {
  return <kbd className="ctrl__kbd" aria-hidden="true">{children}</kbd>;
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
