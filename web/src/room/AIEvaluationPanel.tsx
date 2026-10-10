import { useState, type FormEvent } from "react";
import type { EvaluationResult } from "@ih/shared";
import { ApiFailure, api } from "../lib/api";
import { useTranslation } from "../i18n/useTranslation";
import { BotIcon, SparklesIcon, DownloadIcon, CopyIcon, AlertIcon } from "../components/icons";

interface AIEvaluationPanelProps {
  roomId: string;
  hostName: string;
  candidateProfile: unknown | null;
  position: string;
  notes: string;
  onNotesChange: (notes: string) => void;
  onPositionChange: (position: string) => void;
  onClose: () => void;
}

export default function AIEvaluationPanel({
  roomId,
  hostName,
  candidateProfile,
  position,
  notes,
  onNotesChange,
  onPositionChange,
  onClose,
}: AIEvaluationPanelProps) {
  const { t } = useTranslation();
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const handleEvaluate = async (e: FormEvent) => {
    e.preventDefault();
    if (!notes.trim() || loading) return;
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    try {
      const res = await api<{ evaluation: EvaluationResult }>(
        `/api/rooms/${encodeURIComponent(roomId)}/evaluate`,
        {
          method: "POST",
          body: JSON.stringify({
            notes,
            candidateProfile,
            position: position.trim() || undefined,
          }),
        },
      );
      setEvaluation(res.evaluation);
    } catch (err) {
      const apiErr = err as ApiFailure;
      if (apiErr.status === 501) setNotConfigured(true);
      else if (apiErr.status === 403) setError(t("room.sidePanel.ai.forbidden"));
      else setError(apiErr.message || t("room.sidePanel.ai.failed"));
    } finally {
      setLoading(false);
    }
  };

  /** Raporu düz metin olarak üretir (kopyala + indir paylaşır). */
  const buildReport = (): string => {
    const recLabel =
      evaluation?.recommendation === "hire"
        ? t("room.sidePanel.ai.reportHire")
        : evaluation?.recommendation === "no_hire"
          ? t("room.sidePanel.ai.reportNoHire")
          : t("room.sidePanel.ai.reportUncertain");
    return [
      t("room.sidePanel.ai.reportTitle"),
      `${t("room.sidePanel.ai.reportRoom")}: ${hostName}`,
      `${t("room.sidePanel.ai.reportPosition")}: ${position || t("common.optional")}`,
      `${t("room.sidePanel.ai.reportCandidate")}: ${(candidateProfile as { fullName?: string } | null)?.fullName || "—"}`,
      `${t("room.sidePanel.ai.reportDate")}: ${new Date().toLocaleString()}`,
      "",
      `${t("room.sidePanel.ai.reportScore")}: ${evaluation?.score}/100`,
      `${t("room.sidePanel.ai.reportRecommendation")}: ${recLabel}`,
      "",
      t("room.sidePanel.ai.reportRubric"),
      ...(evaluation?.rubric ?? []).map((r) => `${r.area}: ${r.score}/100 — ${r.comment}`),
      "",
      `${t("room.sidePanel.ai.reportStrengths")}`,
      ...(evaluation?.strengths ?? []).map((s) => `• ${s}`),
      "",
      `${t("room.sidePanel.ai.reportConcerns")}`,
      ...(evaluation?.concerns ?? []).map((c) => `• ${c}`),
      "",
      `${t("room.sidePanel.ai.reportSummary")}`,
      evaluation?.summary ?? "",
    ].join("\n");
  };

  const copyReport = async () => {
    await navigator.clipboard.writeText(buildReport());
  };

  const downloadReport = () => {
    const blob = new Blob([buildReport()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evaluation-${roomId}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const scoreColor = (score: number) =>
    score >= 70 ? "var(--ok)" : score >= 40 ? "var(--warn)" : "var(--danger)";

  return (
    <div className="ai-panel">
      <div className="ai-panel__header">
        <div className="ai-panel__title">
          <SparklesIcon size={18} style={{ marginRight: 6 }} />
          <strong>{t("room.sidePanel.ai.title")}</strong>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={onClose} title={t("common.close")} aria-label={t("common.close")}>
          <span>✕</span>
        </button>
      </div>

      <form onSubmit={handleEvaluate} className="ai-panel__form">
        <div className="field">
          <label htmlFor="ai-position">{t("room.sidePanel.ai.position")}</label>
          <input
            id="ai-position"
            type="text"
            value={position}
            onChange={(e) => onPositionChange(e.target.value)}
            placeholder={t("room.sidePanel.ai.positionPlaceholder")}
            maxLength={120}
          />
        </div>

        <div className="field">
          <label htmlFor="ai-notes">{t("room.sidePanel.ai.notes")}</label>
          <textarea
            id="ai-notes"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder={t("room.sidePanel.ai.notesPlaceholder")}
            rows={6}
            maxLength={4000}
            required
          />
          <p className="hint">{notes.length}/4000</p>
        </div>

        {error && <div className="error" style={{ marginTop: 8 }}>{error}</div>}

        <div className="ai-panel__actions">
          <button
            type="submit"
            className="btn btn--primary"
            disabled={loading || !notes.trim()}
          >
            {loading ? t("room.sidePanel.ai.evaluating") : t("room.sidePanel.ai.evaluate")}
          </button>
        </div>
      </form>

      {notConfigured && (
        <div className="ai-panel__not-configured">
          <AlertIcon size={16} />
          <span>{t("room.sidePanel.ai.notConfigured")}</span>
        </div>
      )}

      {evaluation && (
        <div className="ai-panel__result">
          <div className="ai-panel__score" style={{ "--score-color": scoreColor(evaluation.score) } as React.CSSProperties}>
            <span className="ai-panel__score-value">{evaluation.score}</span>
            <span className="ai-panel__score-label">/100</span>
          </div>

          <div className="ai-panel__recommendation">
            <span className={`rec-badge rec-badge--${evaluation.recommendation}`}>
              {evaluation.recommendation === "hire"
                ? t("room.sidePanel.ai.result.recommendation.hire")
                : evaluation.recommendation === "no_hire"
                  ? t("room.sidePanel.ai.result.recommendation.no_hire")
                  : t("room.sidePanel.ai.result.recommendation.uncertain")}
            </span>
          </div>

          <div className="ai-panel__rubric">
            <h4>{t("room.sidePanel.ai.result.rubric")}</h4>
            {evaluation.rubric.map((r, i) => (
              <div key={i} className="rubric-item">
                <div className="rubric-item__head">
                  <strong>{r.area}</strong>
                  <span className="rubric-item__score" style={{ color: scoreColor(r.score) }}>
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
                  <h4>{t("room.sidePanel.ai.result.strengths")}</h4>
                  <ul>
                    {evaluation.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {evaluation.concerns.length > 0 && (
                <div className="cons">
                  <h4>{t("room.sidePanel.ai.result.concerns")}</h4>
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
              <h4>{t("room.sidePanel.ai.result.summary")}</h4>
              <p className="prewrap">{evaluation.summary}</p>
            </div>
          )}

          <div className="ai-panel__result-actions">
            <button className="btn btn--ghost btn--sm" onClick={copyReport} title={t("room.sidePanel.ai.actions.copy")}>
              <CopyIcon size={16} />
              {t("room.sidePanel.ai.actions.copy")}
            </button>
            <button className="btn btn--ghost btn--sm" onClick={downloadReport} title={t("room.sidePanel.ai.actions.download")}>
              <DownloadIcon size={16} />
              {t("room.sidePanel.ai.actions.download")}
            </button>
          </div>

          {evaluation.model && (
            <p className="hint" style={{ marginTop: 12 }}>
              {t("room.sidePanel.ai.result.model")}: {evaluation.model}
            </p>
          )}
        </div>
      )}

      <div className="ai-panel__hint">
        <BotIcon size={14} />
        <span>{t("room.sidePanel.ai.disclaimer")}</span>
      </div>
    </div>
  );
}