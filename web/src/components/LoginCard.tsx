import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";

export default function LoginCard({ title, note }: { title?: string; note?: string }) {
  const { login, demoLogin, linkedinEnabled, demoEnabled } = useAuth();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDemo = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await demoLogin(name.trim() || "Demo Kullanıcı");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!linkedinEnabled && !demoEnabled) {
    return (
      <div className="card login-card">
        <h2>Giriş yapılamıyor</h2>
        <p className="muted">
          Sunucuda LinkedIn OAuth yapılandırılmamış ve demo girişi kapalı. Sunucu klasöründeki{" "}
          <code>.env</code> dosyasına <code>LINKEDIN_CLIENT_ID</code> ve{" "}
          <code>LINKEDIN_CLIENT_SECRET</code> ekleyin.
        </p>
      </div>
    );
  }

  return (
    <div className="card login-card">
      <h2>{title ?? "Devam etmek için giriş yapın"}</h2>
      {note && <p className="muted">{note}</p>}

      {linkedinEnabled && (
        <button className="btn btn--linkedin btn--block" onClick={login}>
          LinkedIn ile giriş yap
        </button>
      )}

      {linkedinEnabled && demoEnabled && <div className="divider">veya</div>}

      {demoEnabled && (
        <form onSubmit={onDemo} className="demo-form">
          <label className="field">
            <span>Adınız (demo girişi)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Ayşe Yılmaz"
              maxLength={60}
            />
          </label>
          <button className="btn btn--secondary btn--block" disabled={busy} type="submit">
            {busy ? "Giriş yapılıyor…" : "Demo olarak devam et"}
          </button>
          <p className="hint">
            Demo girişi, gerçek LinkedIn hesabı bağlamadan tüm akışı test etmenizi sağlar.
          </p>
        </form>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
