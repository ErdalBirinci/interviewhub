import { useState, FormEvent } from "react";
import { api, type ApiFailure } from "../lib/api";
import { BotIcon, SparklesIcon, DownloadIcon, CopyIcon, AlertIcon } from "../components/icons";
import type { EvaluationResult } from "@ih/shared";

interface AIEvaluationPanelProps {
  roomId: string;
  hostName: string;
  candidateProfile: LinkedInProfile | null;
  position: string;
  notes: string;
  onNotesChange: (notes: string) => void;
  onClose: () => void;
}

interface LinkedInProfile {
  fullName: string;
  headline: string;
  location?: string;
  summary?: string;
  experience: { title: string; company?: string; period?: string; description?: string }[];
  education: { school: string; degree?: string; period?: string }[];
  skills: string[];
}

export default function AIEvaluationPanel({
  roomId,
  hostName,
  candidateProfile,
  position,
  notes,
  onNotesChange,
  onClose,
}: AIEvaluationPanelProps) {
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localNotes, setLocalNotes] = useState(notes);

  const handleEvaluate = async (e: FormEvent) => {
    e.preventDefault();
    if (!localNotes.trim()) {
      setError("Mülakat notları boş olamaz.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ evaluation: EvaluationResult }>(
        `/api/rooms/${encodeURIComponent(roomId)}/evaluate`,
        {
          method: "POST",
          body: JSON.stringify({
            notes: localNotes,
            candidateProfile,
            position: position.trim() || undefined,
          }),
        },
      );
      setEvaluation(res.evaluation);
    } catch (err) {
      const apiErr = err as ApiFailure;
      if (apiErr.status === 501) {
        setError("AI değerlendirme yapılandırılmamış (AI_API_KEY gerekli).");
      } else if (apiErr.status === 403) {
        setError("Bu işlem için yetkiniz yok (sadece oda sahibi).");
      } else {
        setError(apiErr.message || "Değerlendirme başarısız.");
      }
    } finally {
      setLoading(false);
    }
  };

  const copyReport = async () => {
    if (!evaluation) return;
    const report = [
      `InterviewHub — AI Değerlendirme Raporu`,
      `Oda: ${hostName}`,
      `Pozisyon: ${position || "belirtilmedi"}`,
      `Aday: ${candidateProfile?.fullName || "bilinmiyor"}`,
      `Tarih: ${new Date().toLocaleString("tr-TR")}`,
      "",
      `Genel Puan: ${evaluation.score}/100`,
      `Öneri: ${evaluation.recommendation === "hire" ? "İşe al" : evaluation.recommendation === "no_hire" ? "İşe alma" : "Kararsız"}`,
      "",
      "--- Rubrik ---",
      ...evaluation.rubric.map((r) => `${r.area}: ${r.score}/100 — ${r.comment}`),
      "",
      "Güçlü Yönler:",
      ...evaluation.strengths.map((s) => `• ${s}`),
      "",
      "Geliştirilecek Yönler:",
      ...evaluation.concerns.map((c) => `• ${c}`),
      "",
      "Özet:",
      evaluation.summary,
    ].join("\n");
    await navigator.clipboard.writeText(report);
  };

  const downloadReport = () => {
    if (!evaluation) return;
    const report = [
      `InterviewHub — AI Değerlendirme Raporu`,
      `Oda: ${hostName}`,
      `Pozisyon: ${position || "belirtilmedi"}`,
      `Aday: ${candidateProfile?.fullName || "bilinmiyor"}`,
      `Tarih: ${new Date().toISOString()}`,
      "",
      `Genel Puan: ${evaluation.score}/100`,
      `Öneri: ${evaluation.recommendation}`,
      "",
      "--- Rubrik ---",
      ...evaluation.rubric.map((r) => `${r.area}: ${r.score}/100 — ${r.comment}`),
      "",
      "Güçlü Yönler:",
      ...evaluation.strengths.map((s) => `• ${s}`),
      "",
      "Geliştirilecek Yönler:",
      ...evaluation.concerns.map((c) => `• ${c}`),
      "",
      "Özet:",
      evaluation.summary,
    ].join("\n");
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `degerlendirme-${roomId}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const recColor = (score: number) =>
    score >= 70 ? "var(--ok)" : score >= 40 ? "var(--warn)" : "var(--danger)";

  return (
    <div className="ai-panel">
      <div className="ai-panel__header">
        <div className="ai-panel__title">
          <SparklesIcon size={18} style={{ marginRight: 6 }} />
          <strong>AI Değerlendirme Asistanı</strong>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={onClose} title="Kapat">
          <span>✕</span>
        </button>
      </div>

      <form onSubmit={handleEvaluate} className="ai-panel__form">
        <div className="field">
          <label htmlFor="ai-position">Pozisyon (isteğe bağlı)</label>
          <input
            id="ai-position"
            type="text"
            value={position}
            onChange={(e) => onNotesChange(e.target.value)} // Pozisyon ayrı input olarak da olabilir; basit tutuyoruz
            placeholder="Örn: Senior Frontend Developer"
            maxLength={120}
          />
        </div>

        <div className="field">
          <label htmlFor="ai-notes">Mülakat Notlarınız</label>
          <textarea
            id="ai-notes"
            value={localNotes}
            onChange={(e) => setLocalNotes(e.target.value)}
            placeholder="Adayın cevapları, izlenimleriniz, teknik detaylar..."
            rows={6}
            maxLength={4000}
            required
          />
          <p className="hint">{localNotes.length}/4000 karakter</p>
        </div>

        {error && <div className="error" style={{ marginTop: 8 }}>{error}</div>}

        <div className="ai-panel__actions">
          <button
            type="submit"
            className="btn btn--primary"
            disabled={loading || !localNotes.trim()}
          >
            {loading ? "Değerlendiriliyor…" : "Değerlendir"}
          </button>
        </div>
      </form>

      {evaluation && (
        <div className="ai-panel__result">
          <div className="ai-panel__score" style={{ "--score-color": recColor(evaluation.score) } as React.CSSProperties}>
            <span className="ai-panel__score-value">{evaluation.score}</span>
            <span className="ai-panel__score-label">/100</span>
          </div>

          <div className="ai-panel__recommendation">
            <span
              className={`rec-badge rec-badge--${evaluation.recommendation}`}
            >
              {evaluation.recommendation === "hire"
                ? "✓ İşe al"
                : evaluation.recommendation === "no_hire"
                ? "✗ İşe alma"
                : "? Kararsız"}
            </span>
          </div>

          <div className="ai-panel__rubric">
            <h4>Kriterler</h4>
            {evaluation.rubric.map((r, i) => (
              <div key={i} className="rubric-item">
                <div className="rubric-item__head">
                  <strong>{r.area}</strong>
                  <span className="rubric-item__score" style={{ color: recColor(r.score) }}>
                    {r.score}/100
                  </span>
                </div>
                {r.comment && <p className="rubric-item__comment">{r.comment}</p>}
              </div>
            ))}
          </div>

          {(evaluation.strengths.length || evaluation.concerns.length) && (
            <div className="ai-panel__pros-cons">
              {evaluation.strengths.length > 0 && (
                <div className="pros">
                  <h4>✓ Güçlü Yönler</h4>
                  <ul>
                    {evaluation.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {evaluation.concerns.length > 0 && (
                <div className="cons">
                  <h4>⚠ Geliştirilecek Yönler</h4>
                  <ul>
                    {evaluation.concerns.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {evaluation.summary && (
            <div className="ai-panel__summary">
              <h4>Özet</h4>
              <p className="prewrap">{evaluation.summary}</p>
            </div>
          )}

          <div className="ai-panel__result-actions">
            <button className="btn btn--ghost btn--sm" onClick={copyReport} title="Raporu kopyala">
              <CopyIcon size={16} />
              Kopyala
            </button>
            <button className="btn btn--ghost btn--sm" onClick={downloadReport} title="Raporu indir (.txt)">
              <DownloadIcon size={16} />
              İndir
            </button>
          </div>

          {evaluation.model && (
            <p className="hint" style={{ marginTop: 12 }}>
              Model: {evaluation.model}
            </p>
          )}
        </div>
      )}

      <div className="ai-panel__hint">
        <AlertIcon size={14} />
        <span>
          Not: Değerlendirme yalnızca yazdığınız notlar ve adayın paylaştığı profil
          bilgisiyle yapılır. Ses/video kaydı asla AI'a gönderilmez.
        </span>
      </div>
    </div>
  );
}