import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useTranslation } from "../i18n/useTranslation";
import LanguageSelector from "./LanguageSelector";

const THEME_KEY = "ih_theme";

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

export default function Nav() {
  const { me, loading, logout, demoEnabled } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onLanding = pathname === "/" && !me;

  const [theme, setTheme] = useState<"dark" | "light">(() =>
    document.documentElement.dataset.theme === "light" ? "light" : "dark",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* yoksay */
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#0b0f1a" : "#f4f6fb");
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return (
    <header className="nav">
      <Link to="/" className="nav__brand">
        <span className="nav__logo">IH</span>
        <span>
          {t("app.name")}
          <small>{t("app.tagline")}</small>
        </span>
      </Link>

      <nav className="nav__links">
        {onLanding ? (
          <>
            <a href="#ozellikler">{t("landing.features.title")}</a>
            <a href="#nasil">{t("landing.steps.title")}</a>
            <a href="#guvenlik">{t("landing.faq.title")}</a>
            <a href="#sss">{t("landing.faq.title")}</a>
          </>
        ) : (
          <>
            <Link to="/dashboard">{t("nav.dashboard")}</Link>
            <Link to="/profile">{t("nav.profile")}</Link>
          </>
        )}
      </nav>

      <div className="nav__user">
        {loading ? (
          <span className="muted">…</span>
        ) : me ? (
          <>
            <span className="chip" title={me.email ?? me.provider}>
              {me.avatarUrl ? (
                <img src={me.avatarUrl} alt="" className="chip__avatar" />
              ) : (
                <span className="chip__initials">{me.name.slice(0, 1).toUpperCase()}</span>
              )}
              {me.name}
              {demoEnabled && me.provider === "demo" && <em className="chip__tag">demo</em>}
            </span>
            <LanguageSelector />
            <button
              className="btn btn--ghost nav__theme"
              onClick={toggleTheme}
              title={theme === "dark" ? t("accessibility.toggleTheme") + " (Açık)" : t("accessibility.toggleTheme") + " (Koyu)"}
              aria-label={theme === "dark" ? t("accessibility.toggleTheme") : t("accessibility.toggleTheme")}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => {
                void logout().then(() => navigate("/"));
              }}
            >
              {t("nav.logout")}
            </button>
          </>
        ) : onLanding ? (
          <a href="#giris" className="btn btn--primary">
            {t("nav.login")}
          </a>
        ) : (
          <Link to="/dashboard" className="btn btn--primary">
            {t("nav.login")}
          </Link>
        )}
      </div>
    </header>
  );
}
