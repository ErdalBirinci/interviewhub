import { useEffect, useRef, useState } from "react";

export type MediaRequestState = "idle" | "requesting" | "ready" | "partial" | "blocked";

export function humanMediaError(err: unknown): string {
  const name = (err as { name?: string } | null)?.name ?? "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Kamera/mikrofon izni verilmedi. Tarayıcı adres çubuğundaki kamera simgesinden izin verebilirsiniz.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Kamera veya mikrofon bulunamadı. Yine de katılabilirsiniz.";
    case "NotReadableError":
      return "Cihaz başka bir uygulama tarafından kullanılıyor.";
    case "AbortError":
      return "Medya isteği iptal edildi.";
    default:
      return (err as Error)?.message ?? "Medya cihazlarına erişilemedi.";
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
      setError("Tarayıcı medya cihazı erişimini desteklemiyor. HTTPS veya localhost gereklidir.");
      return;
    }

    setState("requesting");

    // Guvenlik agaci: bazi ortamlarda getUserMedia hic donmez (izn veya surucu
    // beklemede kalir). Sure dolarsa medyasiz katilabilsin.
    const watchdog = setTimeout(() => {
      if (cancelled) return;
      setState((s) => (s === "requesting" ? "blocked" : s));
      setError((prev) => prev ?? "Kamera/mikrofon hazırlanmadı. Medyasız da katılabilirsiniz.");
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
                ? "Kamera açılamadı - sadece sesle katılacaksınız."
                : "Mikrofon açılamadı - sesiniz karşı tarafa gitmeyecek.",
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
