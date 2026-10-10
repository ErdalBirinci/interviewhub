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
import { useTranslation } from "../i18n/useTranslation";

export default function ProfileEditor() {
  const { me, loading, refresh } = useAuth();
  const { t } = useTranslation();
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
        <LoginCard title={t("profileEditor.loginTitle")} />
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
          <p className="eyebrow">{t("profileEditor.eyebrow")}</p>
          <h1>{t("profileEditor.title")}</h1>
        </div>
        <Link className="btn btn--ghost" to="/dashboard">
          {t("profileEditor.backToDashboard")}
        </Link>
      </header>

      <div className="banner">
        <span>{t("profileEditor.bannerText")}</span>
      </div>

      <form onSubmit={save} className="profile-form">
        <section className="card">
          <h2>{t("profileEditor.identity")}</h2>
          <div className="grid2">
            <label className="field">
              <span>{t("profileEditor.fullName")}</span>
              <input
                value={profile.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                required
                maxLength={120}
              />
            </label>
            <label className="field">
              <span>{t("profileEditor.headline")}</span>
              <input
                value={profile.headline}
                onChange={(e) => set("headline", e.target.value)}
                placeholder={t("profileEditor.headlinePlaceholder")}
                maxLength={200}
              />
            </label>
            <label className="field">
              <span>{t("profileEditor.linkedinUrl")}</span>
              <input
                value={profile.linkedinUrl}
                onChange={(e) => set("linkedinUrl", e.target.value)}
                placeholder={t("profileEditor.linkedinUrlPlaceholder")}
                maxLength={300}
              />
            </label>
            <label className="field">
              <span>{t("profileEditor.location")}</span>
              <input
                value={profile.location ?? ""}
                onChange={(e) => set("location", e.target.value)}
                placeholder={t("profileEditor.locationPlaceholder")}
                maxLength={120}
              />
            </label>
          </div>
          <label className="field">
            <span>{t("profileEditor.summary")}</span>
            <textarea
              value={profile.summary ?? ""}
              onChange={(e) => set("summary", e.target.value)}
              rows={4}
              maxLength={3000}
              placeholder={t("profileEditor.summaryPlaceholder")}
            />
          </label>
        </section>

        <section className="card">
          <div className="card__head">
            <h2>{t("profileEditor.experience")}</h2>
            <button className="btn btn--secondary btn--sm" type="button" onClick={addExperience}>
              {t("profileEditor.add")}
            </button>
          </div>
          {profile.experience.length === 0 && <p className="hint">{t("profileEditor.noExperience")}</p>}
          {profile.experience.map((exp, i) => (
            <div key={i} className="repeater">
              <div className="grid2">
                <label className="field">
                  <span>{t("profileEditor.position")}</span>
                  <input
                    value={exp.title}
                    onChange={(e) => updateExperience(i, { title: e.target.value })}
                    maxLength={140}
                  />
                </label>
                <label className="field">
                  <span>{t("profileEditor.company")}</span>
                  <input
                    value={exp.company}
                    onChange={(e) => updateExperience(i, { company: e.target.value })}
                    maxLength={140}
                  />
                </label>
              </div>
              <div className="grid2">
                <label className="field">
                  <span>{t("profileEditor.period")}</span>
                  <input
                    value={exp.period}
                    onChange={(e) => updateExperience(i, { period: e.target.value })}
                    placeholder={t("profileEditor.periodPlaceholder")}
                    maxLength={60}
                  />
                </label>
                <label className="field">
                  <span>{t("profileEditor.description")}</span>
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
                {t("common.delete")}
              </button>
            </div>
          ))}
        </section>

        <section className="card">
          <div className="card__head">
            <h2>{t("profileEditor.education")}</h2>
            <button className="btn btn--secondary btn--sm" type="button" onClick={addEducation}>
              {t("profileEditor.add")}
            </button>
          </div>
          {profile.education.length === 0 && <p className="hint">{t("profileEditor.noEducation")}</p>}
          {profile.education.map((edu, i) => (
            <div key={i} className="repeater">
              <div className="grid2">
                <label className="field">
                  <span>{t("profileEditor.school")}</span>
                  <input
                    value={edu.school}
                    onChange={(e) => updateEducation(i, { school: e.target.value })}
                    maxLength={160}
                  />
                </label>
                <label className="field">
                  <span>{t("profileEditor.degree")}</span>
                  <input
                    value={edu.degree ?? ""}
                    onChange={(e) => updateEducation(i, { degree: e.target.value })}
                    maxLength={140}
                  />
                </label>
              </div>
              <label className="field">
                <span>{t("profileEditor.period")}</span>
                <input
                  value={edu.period}
                  onChange={(e) => updateEducation(i, { period: e.target.value })}
                  placeholder={t("profileEditor.eduPeriodPlaceholder")}
                  maxLength={60}
                />
              </label>
              <button
                type="button"
                className="btn btn--ghost btn--sm danger"
                onClick={() => setProfile((p) => ({ ...p, education: p.education.filter((_, idx) => idx !== i) }))}
              >
                {t("common.delete")}
              </button>
            </div>
          ))}
        </section>

        <section className="card">
          <h2>{t("profileEditor.skills")}</h2>
          <label className="field">
            <span>{t("profileEditor.skillsHint")}</span>
            <textarea
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder={t("profileEditor.skillsPlaceholder")}
            />
          </label>

          <label className="switch">
            <input
              type="checkbox"
              checked={profile.shareProfile}
              onChange={(e) => set("shareProfile", e.target.checked)}
            />
            <span>{t("profileEditor.shareLabel")}</span>
          </label>
        </section>

        <div className="form-actions">
          <button className="btn btn--primary btn--lg" type="submit" disabled={saving}>
            {saving ? t("profileEditor.saving") : t("profileEditor.save")}
          </button>
          {saved && <span className="ok">{t("profileEditor.saved")}</span>}
          {error && <span className="error">{error}</span>}
        </div>
      </form>
    </main>
  );
}
