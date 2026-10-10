import type { MediaFlags } from "./useRoom";
import { useTranslation } from "../i18n/useTranslation";
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
  const { t } = useTranslation();
  return (
    <div className="controls">
      <button
        className={`ctrl ${media.mic ? "" : "ctrl--off"}`}
        onClick={onMic}
        disabled={disabled || !micAvailable}
        title={media.mic ? t("room.controls.micOnTitle") : t("room.controls.micOffTitle")}
        aria-label={media.mic ? t("room.controls.micOnAria") : t("room.controls.micOffAria")}
        aria-keyshortcuts="m"
      >
        <span className="ctrl__icon">{media.mic ? <MicIcon /> : <MicOffIcon />}</span>
        <span className="ctrl__label">{media.mic ? t("room.controls.micLabel") : t("room.controls.mutedLabel")}</span>
        <Kbd>M</Kbd>
      </button>

      <button
        className={`ctrl ${media.cam ? "" : "ctrl--off"}`}
        onClick={onCam}
        disabled={disabled || !camAvailable}
        title={media.cam ? t("room.controls.camOnTitle") : t("room.controls.camOffTitle")}
        aria-label={media.cam ? t("room.controls.camOnAria") : t("room.controls.camOffAria")}
        aria-keyshortcuts="c"
      >
        <span className="ctrl__icon">{media.cam ? <CameraIcon /> : <CameraOffIcon />}</span>
        <span className="ctrl__label">{media.cam ? t("room.controls.camLabel") : t("room.controls.camOffLabel")}</span>
        <Kbd>C</Kbd>
      </button>

      <button
        className={`ctrl ${screenActive ? "ctrl--active" : ""}`}
        onClick={() => void onScreen()}
        disabled={disabled}
        title={t("room.controls.screenTitle")}
        aria-label={t("room.controls.screenAria")}
        aria-keyshortcuts="s"
      >
        <span className="ctrl__icon"><ScreenIcon /></span>
        <span className="ctrl__label">{screenActive ? t("room.controls.screenSharingLabel") : t("room.controls.screenLabel")}</span>
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
              title={t("room.controls.recordStartTitle")}
              aria-label={t("room.controls.recordStartAria")}
              aria-keyshortcuts="r"
            >
              <span className="ctrl__icon"><RecordIcon /></span>
              <span className="ctrl__label">{t("room.controls.recordStartLabel")}</span>
              <Kbd>R</Kbd>
            </button>
          )}
          {recordingState === "recording" && (
            <button
              className="ctrl ctrl--record ctrl--recording"
              onClick={onRecordPause}
              disabled={disabled}
              title={t("room.controls.recordPauseTitle")}
              aria-label={t("room.controls.recordPauseAria")}
            >
              <span className="ctrl__icon"><RecordIcon /></span>
              <span className="ctrl__label">
                <span className="rec-dot" aria-hidden="true" /> {t("room.controls.recordingLabel")} {formatMs(recordingDurationMs ?? 0)}
              </span>
            </button>
          )}
          {recordingState === "paused" && (
            <button
              className="ctrl ctrl--record ctrl--paused"
              onClick={onRecordResume}
              disabled={disabled}
              title={t("room.controls.recordResumeTitle")}
              aria-label={t("room.controls.recordResumeAria")}
            >
              <span className="ctrl__icon"><RecordOffIcon /></span>
              <span className="ctrl__label">{t("room.controls.recordPausedLabel")}</span>
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
          title={transcriptActive ? t("room.controls.transcriptStopTitle") : t("room.controls.transcriptStartTitle")}
          aria-label={transcriptActive ? t("room.controls.transcriptStopAria") : t("room.controls.transcriptStartAria")}
          aria-keyshortcuts="t"
        >
          <span className="ctrl__icon"><TranscriptIcon /></span>
          <span className="ctrl__label">{transcriptActive ? t("room.controls.transcriptActiveLabel") : t("room.controls.transcriptLabel")}</span>
          <Kbd>T</Kbd>
        </button>
      )}

      <span className="controls__count" title={t("room.controls.participantsTitle")}>
        <UsersIcon size={16} />
        <span>{participants}</span>
      </span>

      {onToggleSide && (
        <button className="ctrl ctrl--side" onClick={onToggleSide} title={t("room.controls.panelTitle")} aria-label={t("room.controls.panelAria")} aria-keyshortcuts="p">
          <span className="ctrl__icon"><PanelIcon /></span>
          <span className="ctrl__label">{sideLabel ?? t("room.controls.panelAria")}</span>
          <Kbd>P</Kbd>
        </button>
      )}

      <button className="ctrl ctrl--leave" onClick={onLeave} title={t("room.controls.leaveTitle")} aria-label={t("room.controls.leaveAria")}>
        <span className="ctrl__icon"><LeaveIcon /></span>
        <span className="ctrl__label">{t("room.controls.leaveLabel")}</span>
      </button>
    </div>
  );
}
