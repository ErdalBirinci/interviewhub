import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { useTranslation } from "../i18n/useTranslation";

export default function LoginCard({ title, note }: { title?: string; note?: string }) {
  const { login, demoLogin, linkedinEnabled, demoEnabled } = useAuth();
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDemo = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await demoLogin(name.trim() || t("auth.demoFallbackName"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!linkedinEnabled && !demoEnabled) {
    return (
      <div className="card login-card">
        <h2>{t("auth.cannotLogin")}</h2>
        <p className="muted">{t("auth.notConfigured")}</p>
      </div>
    );
  }

  return (
    <div className="card login-card">
      <h2>{title ?? t("auth.loginTitle")}</h2>
      {note && <p className="muted">{note}</p>}

      {linkedinEnabled && (
        <button className="btn btn--linkedin btn--block" onClick={login}>
          {t("auth.linkedInBtn")}
        </button>
      )}

      {linkedinEnabled && demoEnabled && <div className="divider">{t("auth.or")}</div>}

      {demoEnabled && (
        <form onSubmit={onDemo} className="demo-form">
          <label className="field">
            <span>{t("auth.nameLabel")}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("auth.namePlaceholder")}
              maxLength={60}
              aria-label={t("auth.nameLabel")}
            />
          </label>
          <button className="btn btn--secondary btn--block" disabled={busy} type="submit">
            {busy ? t("auth.demoSubmitting") : t("auth.demoSubmit")}
          </button>
          <p className="hint">{t("auth.demoHint")}</p>
        </form>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}