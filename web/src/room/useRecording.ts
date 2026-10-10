import { useCallback, useEffect, useRef, useState } from "react";
import { translate } from "../i18n";

/* ---------------------- Web Speech API tipleri (global d.clarations) ---------------------- */

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (e: SpeechRecognitionEvent) => void;
  onerror: (e: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  onstart: () => void;
}

interface Window {
  SpeechRecognition: new () => SpeechRecognition;
  webkitSpeechRecognition: new () => SpeechRecognition;
}

/** Kayıt durumu */
export type RecordingState = "idle" | "recording" | "paused";

export interface RecordingResult {
  blob: Blob;
  url: string;
  durationMs: number;
  mimeType: string;
}

/**
 * MediaRecorder ile görüntü/ses kaydı.
 * Yerel tarayıcıda çalışır; sunucuya veri göndermez.
 */
export function useRecording(stream: MediaStream | null) {
  const [state, setState] = useState<RecordingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecordingResult | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearResult = useCallback(() => setResult(null), []);

  const start = useCallback(async () => {
    if (!stream) {
      setError(translate("recording.noStream"));
      return;
    }
    try {
      setError(null);
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
        ? "video/webm;codecs=vp8"
        : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const durationMs = Date.now() - startTimeRef.current;
        setResult({ blob, url, durationMs, mimeType });
        setState("idle");
        stopTimer();
      };
      recorder.onerror = (e) => {
        console.error("[recording]", e);
        setError(translate("recording.error"));
        setState("idle");
        stopTimer();
      };

      startTimeRef.current = Date.now();
      recorder.start(1000); // her saniye chunk
      setState("recording");

      timerRef.current = window.setInterval(() => {
        // timer tick - UI sure guncellemesi icin
      }, 1000);
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
    }
  }, [stream, stopTimer]);

  const pause = useCallback(() => {
    if (recorderRef.current && state === "recording") {
      recorderRef.current.pause();
      setState("paused");
      stopTimer();
    }
  }, [state, stopTimer]);

  const resume = useCallback(() => {
    if (recorderRef.current && state === "paused") {
      recorderRef.current.resume();
      setState("recording");
      timerRef.current = window.setInterval(() => {}, 1000);
    }
  }, [state]);

  const stop = useCallback(() => {
    if (recorderRef.current && state !== "idle") {
      recorderRef.current.stop();
      // onstop callback sonucu setResult yapacak
    }
  }, [state]);

  const download = useCallback(() => {
    if (result) {
      const a = document.createElement("a");
      a.href = result.url;
      const ext = result.mimeType.includes("webm") ? "webm" : "mp4";
      a.download = `interviewhub-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }, [result]);

  useEffect(() => {
    return () => {
      stopTimer();
      if (recorderRef.current && state !== "idle") {
        try {
          recorderRef.current.stop();
        } catch {
          /* yoksay */
        }
      }
      if (result?.url) URL.revokeObjectURL(result.url);
    };
  }, [state, result, stopTimer]);

  return {
    state,
    error,
    result,
    durationMs: state !== "idle" ? Date.now() - startTimeRef.current : result?.durationMs ?? 0,
    start,
    pause,
    resume,
    stop,
    download,
    clearResult,
  };
}

/* ------------------------------------------------------------- */
/* ------------------- CANLI TRANSKRİPSİYON -------------------- */
/* ------------------------------------------------------------- */

export type TranscriptSegment = {
  id: string;
  text: string;
  timestamp: number; // epoch ms
  isFinal: boolean;
};

export function useTranscription() {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState("tr-TR");

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalSegmentsRef = useRef<TranscriptSegment[]>([]);

  useEffect(() => {
    const SpeechRecognitionCtor = (window as unknown as { SpeechRecognition?: { new (): SpeechRecognition }; webkitSpeechRecognition?: { new (): SpeechRecognition } }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: { new (): SpeechRecognition } }).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setError(translate("transcription.unsupported"));
      return;
    }

    const rec = new SpeechRecognitionCtor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const interim: TranscriptSegment[] = [];
      const finals: TranscriptSegment[] = [];
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = res[0]?.transcript?.trim() ?? "";
        if (!text) continue;
        const seg: TranscriptSegment = {
          id: `${Date.now()}-${i}`,
          text,
          timestamp: Date.now(),
          isFinal: res.isFinal,
        };
        if (res.isFinal) finals.push(seg);
        else interim.push(seg);
      }
      if (finals.length) {
        finalSegmentsRef.current = [...finalSegmentsRef.current, ...finals];
        setSegments([...finalSegmentsRef.current, ...interim]);
      } else if (interim.length) {
        setSegments([...finalSegmentsRef.current, ...interim]);
      }
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== "no-speech" && e.error !== "aborted") {
        console.warn("[transcription]", e.error);
        setError(`translate("transcription.error", { error: e.error })`);
      }
    };

    rec.onend = () => {
      if (isListening) {
        // Otomatik yeniden baslat (bazı tarayicilarda gerekli)
        try {
          rec.start();
        } catch {
          setIsListening(false);
        }
      }
    };

    recognitionRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {
        /* yoksay */
      }
    };
  }, [lang, isListening]);

  const start = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setError(null);
      finalSegmentsRef.current = [];
      setSegments([]);
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        setError((err as Error).message);
      }
    }
  }, [isListening]);

  const stop = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* yoksay */
      }
      setIsListening(false);
    }
  }, [isListening]);

  const clear = useCallback(() => {
    finalSegmentsRef.current = [];
    setSegments([]);
  }, []);

  const setLanguage = useCallback((l: string) => {
    setLang(l);
    if (isListening) {
      stop();
      // dil degisince tekrar baslat
      setTimeout(() => start(), 200);
    }
  }, [isListening, start, stop]);

  const fullText = segments.map((s) => s.text).join(" ").trim();

  return {
    segments,
    fullText,
    isListening,
    error,
    lang,
    start,
    stop,
    clear,
    setLanguage,
  };
}