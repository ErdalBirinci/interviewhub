import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useTranslation } from "../i18n/useTranslation";
import LanguageSelector from "./LanguageSelector";
import {
  SunIcon,
  MoonIcon,
  MenuIcon,
  XIcon,
  BellIcon,
  SearchIcon,
  SettingsIcon,
  LogOutIcon,
  UserIcon,
  ChevronDownIcon,
} from "../components/icons";

const THEME_KEY = "ih_theme";

export default function Nav() {
  const { me, loading, logout, demoEnabled } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onLanding = pathname === "/" && !me;

  const [theme, setTheme] = useState<"dark" | "light">(() =>
    document.documentElement.dataset.theme === "light" ? "light" : "dark",
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    setUserMenuOpen(false);
    navigate("/");
  }, [logout, navigate]);

  const notifications = [
    { id: 1, title: "New message", text: "Ayse Yilmaz sent you a message", time: "2m ago", unread: true },
    { id: 2, title: "Interview scheduled", text: "Frontend Developer interview tomorrow 10:00", time: "1h ago", unread: true },
    { id: 3, title: "Room created", text: "Your room 'Senior React Interview' is ready", time: "3h ago", unread: false },
  ];

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <header className="nav" role="banner">
      {/* Mobile menu button */}
      <button
        className="nav__mobile-toggle"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-expanded={mobileMenuOpen}
        aria-controls="nav-menu"
        aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
      >
        {mobileMenuOpen ? <XIcon size={24} /> : <MenuIcon size={24} />}
      </button>

      {/* Brand */}
      <Link to="/" className="nav__brand" aria-label={`${t("app.name")} - Home`}>
        <span className="nav__logo" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" role="img" aria-label="InterviewHub">
            <defs>
              <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4f8cff" />
                <stop offset="100%" stopColor="#7c5cff" />
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="8" fill="url(#logoGradient)" />
            <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="system-ui, sans-serif">IH</text>
          </svg>
        </span>
        <span className="nav__brand-text">
          <strong>{t("app.name")}</strong>
          <span className="nav__tagline">{t("app.tagline")}</span>
        </span>
      </Link>

      {/* Desktop Navigation */}
      <nav className="nav__links" id="nav-menu" role="navigation" aria-label="Main navigation">
        {onLanding ? (
          <>
            <a href="#ozellikler" className="nav__link">{t("landing.features.title")}</a>
            <a href="#nasil" className="nav__link">{t("landing.steps.title")}</a>
            <a href="#guvenlik" className="nav__link">{t("landing.faq.title")}</a>
            <a href="#sss" className="nav__link">{t("landing.faq.title")}</a>
          </>
        ) : (
          <>
            <Link to="/dashboard" className={`nav__link ${pathname === "/dashboard" ? "nav__link--active" : ""}`}>
              {t("nav.dashboard")}
            </Link>
            <Link to="/profile" className={`nav__link ${pathname === "/profile" ? "nav__link--active" : ""}`}>
              {t("nav.profile")}
            </Link>
          </>
        )}
      </nav>

      {/* Right side actions */}
      <div className="nav__actions">
        {/* Search (desktop only) */}
        <div className="nav__search">
          <SearchIcon size={18} />
          <input
            type="search"
            placeholder={t("common.search")}
            className="nav__search-input"
            aria-label={t("common.search")}
          />
        </div>

        {/* Notifications */}
        <div className="nav__notifications" ref={notificationsRef}>
          <button
            className="nav__icon-btn nav__bell"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            aria-expanded={notificationsOpen}
            aria-label="Notifications"
            aria-haspopup="true"
          >
            <BellIcon size={22} />
            {unreadCount > 0 && (
              <span className="nav__badge" aria-label={`${unreadCount} unread notifications`}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="nav__dropdown nav__dropdown--notifications" role="menu">
              <div className="nav__dropdown-header">
                <h3>{t("common.notifications")}</h3>
                {unreadCount > 0 && (
                  <button className="nav__mark-all-read" onClick={() => { /* mark all read */ }}>
                    {t("common.markAllRead")}
                  </button>
                )}
              </div>
              <div className="nav__notification-list" role="list">
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    className={`nav__notification ${n.unread ? "nav__notification--unread" : ""}`}
                    role="menuitem"
                  >
                    <div className="nav__notification-icon">
                      {n.title === "New message" && <UserIcon size={18} />}
                      {n.title === "Interview scheduled" && <SettingsIcon size={18} />}
                      {n.title === "Room created" && <BellIcon size={18} />}
                    </div>
                    <div className="nav__notification-content">
                      <strong>{n.title}</strong>
                      <span>{n.text}</span>
                      <time className="nav__notification-time">{n.time}</time>
                    </div>
                  </button>
                ))}
              </div>
              <div className="nav__dropdown-footer">
                <a href="/dashboard" className="nav__view-all">
                  {t("common.viewAll")}
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Language Selector */}
        <LanguageSelector />

        {/* Theme Toggle */}
        <button
          className="nav__icon-btn nav__theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? t("accessibility.toggleTheme") + " (Light)" : t("accessibility.toggleTheme") + " (Dark)"}
          title={theme === "dark" ? t("accessibility.toggleTheme") + " (Light)" : t("accessibility.toggleTheme") + " (Dark)"}
        >
          {theme === "dark" ? <SunIcon size={22} /> : <MoonIcon size={22} />}
        </button>

        {/* User Menu / Auth */}
        <div className="nav__user-area" ref={userMenuRef}>
          {loading ? (
            <div className="nav__loading" aria-live="polite">
              <span className="nav__loading-dots"><span>.</span><span>.</span><span>.</span></span>
            </div>
          ) : me ? (
            <>
              <button
                className="nav__user-trigger"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                aria-label={me.name}
              >
                {me.avatarUrl ? (
                  <img src={me.avatarUrl} alt="" className="nav__avatar" />
                ) : (
                  <div className="nav__avatar nav__avatar--initials">
                    {me.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="nav__user-name">{me.name}</span>
                <ChevronDownIcon size={16} />
                {demoEnabled && me.provider === "demo" && (
                  <span className="nav__demo-badge">{t("common.demo")}</span>
                )}
              </button>

              {userMenuOpen && (
                <div className="nav__dropdown nav__dropdown--user" role="menu">
                  <div className="nav__user-header">
                    {me.avatarUrl ? (
                      <img src={me.avatarUrl} alt="" className="nav__user-avatar" />
                    ) : (
                      <div className="nav__user-avatar nav__user-avatar--initials">
                        {me.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="nav__user-info">
                      <strong>{me.name}</strong>
                      <span>{me.email || (me.provider === "demo" ? t("common.demo") : "LinkedIn")}</span>
                    </div>
                  </div>
                  <div className="nav__dropdown-divider" />
                  <Link to="/dashboard" className="nav__dropdown-item" role="menuitem" onClick={() => setUserMenuOpen(false)}>
                    <UserIcon size={18} />
                    {t("nav.dashboard")}
                  </Link>
                  <Link to="/profile" className="nav__dropdown-item" role="menuitem" onClick={() => setUserMenuOpen(false)}>
                    <SettingsIcon size={18} />
                    {t("nav.profile")}
                  </Link>
                  <div className="nav__dropdown-divider" />
                  <button className="nav__dropdown-item nav__dropdown-item--danger" role="menuitem" onClick={handleLogout}>
                    <LogOutIcon size={18} />
                    {t("nav.logout")}
                  </button>
                </div>
              )}
            </>
          ) : onLanding ? (
            <a href="#giris" className="btn btn--primary nav__cta">
              {t("nav.login")}
            </a>
          ) : (
            <Link to="/dashboard" className="btn btn--primary nav__cta">
              {t("nav.login")}
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="nav__mobile-overlay" onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />
      )}
    </header>
  );
}
