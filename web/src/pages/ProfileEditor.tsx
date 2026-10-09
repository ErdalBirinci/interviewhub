import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  EMPTY_PROFILE,
  normalizeProfile,
  type LinkedInProfile,
  type ProfileEducation,
  type ProfileExperience,
} from "@ih/shared";
import LoginCard from "../components/LoginCard";
import { api, put } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function ProfileEditor() {
  const { me, loading, refresh } = useAuth();
  const [profile, setProfile] = useState<LinkedInProfile>(EMPTY_PROFILE);
  const [skillsText, setSkillsText] = useState("");
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Giris yokken fetch asla donmezdi -> fetching sonsuza kadar true kalir ve
    // spinner sonsuzdonerdi. Burada mutlaka kapatilir.
    if (!me) {
      setFetching(false);
      return;
    }
    let alive = true;
    setFetching(true);
    setError(null);
    (async () => {
      try {
        const data = await api<{ profile: LinkedInProfile }>("/api/me/profile");
        if (!alive) return;
        const normalized = normalizeProfile(data.profile);
        setProfile(normalized);
        setSkillsText(normalized.skills.join(", "));
      } catch (err) {
        if (alive) setError((err as Error).message);
      } finally {
        if (alive) setFetching(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [me]);

  const set = <K extends keyof LinkedInProfile>(key: K, value: LinkedInProfile[K]) =>
    setProfile((p) => ({ ...p, [key]: value }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const payload: LinkedInProfile = {
        ...profile,
        skills: skillsText
          .split(/[,\n]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 40),
      };
      const data = await put<{ profile: LinkedInProfile }>("/api/me/profile", payload);
      setProfile(data.profile);
      setSaved(true);
      await refresh();
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const addExperience = () =>
    setProfile((p) => ({
      ...p,
      experience: [...p.experience, { title: "", company: "", period: "", description: "" }],
    }));
  const addEducation = () =>
    setProfile((p) => ({ ...p, education: [...p.education, { school: "", degree: "", period: "" }] }));

  const updateExperience = (i: number, patch: Partial<ProfileExperience>) =>
    setProfile((p) => ({
      ...p,
      experience: p.experience.map((x, idx) => (idx === i ? { ...x, ...patch } : x)),
    }));
  const updateEducation = (i: number, patch: Partial<ProfileEducation>) =>
    setProfile((p) => ({
      ...p,
      education: p.education.map((x, idx) => (idx === i ? { ...x, ...patch } : x)),
    }));

  if (loading) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="center-screen">
        <LoginCard title="Profilinizi düzenlemek için giriş yapın" />
      </div>
    );
  }

  if (fetching) {
    return (
      <main className="page page--narrow">
        <div className="skeleton skeleton--title" style={{ width: "40%" }} />
        <div className="skeleton skeleton--text" style={{ width: "75%", marginTop: "0.6rem" }} />
        <div className="banner" style={{ marginTop: "1.25rem" }}>
          <div className="skeleton skeleton--text" style={{ width: "85%" }} />
          <div className="skeleton skeleton--text" style={{ width: "60%", marginTop: "0.4rem" }} />
        </div>
        <form className="profile-form">
          <section className="card">
            <div className="skeleton skeleton--title" style={{ width: "30%" }} />
            <div className="grid2" style={{ marginTop: "1rem" }}>
              <div className="skeleton skeleton--text" style={{ height: "44px" }} />
              <div className="skeleton skeleton--text" style={{ height: "44px" }} />
              <div className="skeleton skeleton--text" style={{ height: "44px" }} />
            </div>
            <div className="skeleton skeleton--text" style={{ height: "140px", marginTop: "1rem" }} />
          </section>
          <section className="card" style={{ marginTop: "1.5rem" }}>
            <div className="skeleton skeleton--title" style={{ width: "35%" }} />
            <div className="skeleton skeleton--text" style={{ height: "44px", marginTop: "1rem" }} />
            <div className="skeleton skeleton--text" style={{ height: "44px", marginTop: "0.75rem" }} />
            <div className="skeleton skeleton--text" style={{ height: "44px", marginTop: "0.75rem" }} />
          </section>
        </form>
      </main>
    );
  }

  return (
    <main className="page page--narrow">
      <header className="page__head">
        <div>
          <p className="eyebrow">Görüşmede görünecek bilgiler</p>
          <h1>LinkedIn profil kartım</h1>
        </div>
        <Link className="btn btn--ghost" to="/dashboard">
          ← Panel
        </Link>
      </header>

      <div className="banner">
        <span>
          Bu alanları <strong>siz</strong> doldurursunuz. InterviewHub, LinkedIn API'sinden profil
          verisi çekmez; kimliğinizi yalnızca LinkedIn girişi doğrular. Görüşmede bu bilgiler
          karşı tarafa yalnızca <strong>paylaşımı açıkken</strong> gösterilir.
        </span>
      </div>

      <form onSubmit={save} className="profile-form">
        <section className="card">
          <h2>Kimlik</h2>
          <div className="grid2">
            <label className="field">
              <span>Ad Soyad *</span>
              <input
                value={profile.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                required
                maxLength={120}
              />
            </label>
            <label className="field">
              <span>Başlık (unvan)</span>
              <input
                value={profile.headline}
                onChange={(e) => set("headline", e.target.value)}
                placeholder="Örn. Kıdemli Frontend Developer"
                maxLength={200}
              />
            </label>
            <label className="field">
              <span>LinkedIn profil adresi</span>
              <input
                value={profile.linkedinUrl}
                onChange={(e) => set("linkedinUrl", e.target.value)}
                placeholder="https://www.linkedin.com/in/kullanici"
                maxLength={300}
              />
            </label>
            <label className="field">
              <span>Konum</span>
              <input
                value={profile.location ?? ""}
                onChange={(e) => set("location", e.target.value)}
                placeholder="İstanbul, Türkiye"
                maxLength={120}
              />
            </label>
          </div>
          <label className="field">
            <span>Özet</span>
            <textarea
              value={profile.summary ?? ""}
              onChange={(e) => set("summary", e.target.value)}
              rows={4}
              maxLength={3000}
              placeholder="Kısa profil özeti…"
            />
          </label>
        </section>

        <section className="card">
          <div className="card__head">
            <h2>Deneyim</h2>
            <button className="btn btn--secondary btn--sm" type="button" onClick={addExperience}>
              + Ekle
            </button>
          </div>
          {profile.experience.length === 0 && <p className="hint">Henüz deneyim eklenmedi.</p>}
          {profile.experience.map((exp, i) => (
            <div key={i} className="repeater">
              <div className="grid2">
                <label className="field">
                  <span>Pozisyon</span>
                  <input
                    value={exp.title}
                    onChange={(e) => updateExperience(i, { title: e.target.value })}
                    maxLength={140}
                  />
                </label>
                <label className="field">
                  <span>Şirket</span>
                  <input
                    value={exp.company}
                    onChange={(e) => updateExperience(i, { company: e.target.value })}
                    maxLength={140}
                  />
                </label>
              </div>
              <div className="grid2">
                <label className="field">
                  <span>Dönem</span>
                  <input
                    value={exp.period}
                    onChange={(e) => updateExperience(i, { period: e.target.value })}
                    placeholder="2021 - Halen"
                    maxLength={60}
                  />
                </label>
                <label className="field">
                  <span>Açıklama</span>
                  <input
                    value={exp.description ?? ""}
                    onChange={(e) => updateExperience(i, { description: e.target.value })}
                    maxLength={800}
                  />
                </label>
              </div>
              <button
                type="button"
                className="btn btn--ghost btn--sm danger"
                onClick={() =>
                  setProfile((p) => ({ ...p, experience: p.experience.filter((_, idx) => idx !== i) }))
                }
              >
                Sil
              </button>
            </div>
          ))}
        </section>

        <section className="card">
          <div className="card__head">
            <h2>Eğitim</h2>
            <button className="btn btn--secondary btn--sm" type="button" onClick={addEducation}>
              + Ekle
            </button>
          </div>
          {profile.education.length === 0 && <p className="hint">Henüz eğitim eklenmedi.</p>}
          {profile.education.map((edu, i) => (
            <div key={i} className="repeater">
              <div className="grid2">
                <label className="field">
                  <span>Okul</span>
                  <input
                    value={edu.school}
                    onChange={(e) => updateEducation(i, { school: e.target.value })}
                    maxLength={160}
                  />
                </label>
                <label className="field">
                  <span>Bölüm / Derece</span>
                  <input
                    value={edu.degree ?? ""}
                    onChange={(e) => updateEducation(i, { degree: e.target.value })}
                    maxLength={140}
                  />
                </label>
              </div>
              <label className="field">
                <span>Dönem</span>
                <input
                  value={edu.period}
                  onChange={(e) => updateEducation(i, { period: e.target.value })}
                  placeholder="2015 - 2019"
                  maxLength={60}
                />
              </label>
              <button
                type="button"
                className="btn btn--ghost btn--sm danger"
                onClick={() => setProfile((p) => ({ ...p, education: p.education.filter((_, idx) => idx !== i) }))}
              >
                Sil
              </button>
            </div>
          ))}
        </section>

        <section className="card">
          <h2>Yetenekler</h2>
          <label className="field">
            <span>Virgülle ayırın</span>
            <textarea
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="React, TypeScript, WebRTC…"
            />
          </label>

          <label className="switch">
            <input
              type="checkbox"
              checked={profile.shareProfile}
              onChange={(e) => set("shareProfile", e.target.checked)}
            />
            <span>
              Görüşmede bu profili karşı tarafa göster <em>(paylaşımı açık)</em>
            </span>
          </label>
        </section>

        <div className="form-actions">
          <button className="btn btn--primary btn--lg" type="submit" disabled={saving}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
          {saved && <span className="ok">Kaydedildi ✓</span>}
          {error && <span className="error">{error}</span>}
        </div>
      </form>
    </main>
  );
}
