import { useEffect, useRef, useState } from "react";
import { translate } from "../i18n";

export type MediaRequestState = "idle" | "requesting" | "ready" | "partial" | "blocked";

export function humanMediaError(err: unknown): string {
  const name = (err as { name?: string } | null)?.name ?? "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return translate("media.permissionDenied");
    case "NotFoundError":
    case "OverconstrainedError":
      return translate("media.notFound");
    case "NotReadableError":
      return translate("media.inUse");
    case "AbortError":
      return translate("media.aborted");
    default:
      return (err as Error)?.message ?? translate("media.accessFailed");
  }
}

export interface MediaResult {
  stream: MediaStream | null;
  state: MediaRequestState;
  error: string | null;
}

/**
 * Kamera + mikrofonu acar. Kamera yoksa ses, ses yoksa kamera ile devam eder.
 * Bilesen unmount olunca izleri durdurur.
 */
export function useMedia(): MediaResult {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [state, setState] = useState<MediaRequestState>("idle");
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      setState("blocked");
      setError(translate("media.unsupported"));
      return;
    }

    setState("requesting");

    // Guvenlik agaci: bazi ortamlarda getUserMedia hic donmez (izn veya surucu
    // beklemede kalir). Sure dolarsa medyasiz katilabilsin.
    const watchdog = setTimeout(() => {
      if (cancelled) return;
      setState((s) => (s === "requesting" ? "blocked" : s));
      setError((prev) => prev ?? translate("media.notReady"));
    }, 8000);

    const attempts: MediaStreamConstraints[] = [
      {
        audio: { echoCancellation: true, noiseSuppression: true },
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      },
      { audio: { echoCancellation: true, noiseSuppression: true } },
      { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } },
    ];

    (async () => {
      let lastError: unknown = null;
      for (const constraints of attempts) {
        try {
          const media = await navigator.mediaDevices.getUserMedia(constraints);
          if (cancelled) {
            media.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = media;
          setStream(media);
          clearTimeout(watchdog);
          const hasAudio = media.getAudioTracks().length > 0;
          const hasVideo = media.getVideoTracks().length > 0;
          setState(hasAudio && hasVideo ? "ready" : "partial");
          setError(
            hasAudio && hasVideo
              ? null
              : hasAudio
                ? translate("media.cameraOnly")
                : translate("media.micOnly"),
          );
          return;
        } catch (err) {
          lastError = err;
        }
      }
      if (cancelled) return;
      clearTimeout(watchdog);
      setState("blocked");
      setError(humanMediaError(lastError));
    })();

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  return { stream, state, error };
}
