import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useTranslation } from "../i18n/useTranslation";

/* --------------------------------- ikonlar -------------------------------- */

function Icon({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      className="lp-ico"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const IconProfile = () => (
  <Icon>
    <path d="M20 21v-1.6A4.4 4.4 0 0 0 15.6 15H8.4A4.4 4.4 0 0 0 4 19.4V21" />
    <circle cx="12" cy="7.5" r="3.8" />
    <path d="M17.5 4.2h3M17.5 7.2h3" />
  </Icon>
);

const IconVideo = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <rect x="2.5" y="6" width="13" height="12" rx="3" />
    <path d="M15.5 11.2 21 8.2v7.6l-5.5-3" />
  </Icon>
);

const IconScreen = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <rect x="2.5" y="4.5" width="19" height="12.5" rx="2.4" />
    <path d="M8.5 21h7M12 17v4" />
    <path d="M12 8.4v3.6M10.3 10.1 12 8.4l1.7 1.7" />
  </Icon>
);

const IconChat = () => (
  <Icon>
    <path d="M20.5 14.5a3 3 0 0 1-3 3H9l-4.5 3.2V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3z" />
    <path d="M8.5 9.5h7M8.5 13h4.5" />
  </Icon>
);

const IconBlocks = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    <path d="M13.5 6.8h4a2.7 2.7 0 0 1 2.7 2.7v1.4M10.5 17.2h-4A2.7 2.7 0 0 1 3.8 14.5v-1.4" />
  </Icon>
);

const IconShield = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M12 3.2 19 6v5.2c0 4.4-2.9 8.1-7 9.6-4.1-1.5-7-5.2-7-9.6V6z" />
    <path d="M9.2 12.2 11.2 14l3.7-4" />
  </Icon>
);

const IconLink = () => (
  <Icon>
    <path d="M10.3 13.7a3.8 3.8 0 0 0 5.4.3l2.7-2.7a3.8 3.8 0 0 0-5.4-5.4l-1.2 1.2" />
    <path d="M13.7 10.3a3.8 3.8 0 0 0-5.4-.3l-2.7 2.7a3.8 3.8 0 0 0 5.4 5.4l1.2-1.2" />
  </Icon>
);

const IconUsers = () => (
  <Icon>
    <path d="M15.5 20v-1.8a3.7 3.7 0 0 0-3.7-3.7H6.7A3.7 3.7 0 0 0 3 18.2V20" />
    <circle cx="9.2" cy="7.6" r="3.4" />
    <path d="M21 20v-1.8a3.7 3.7 0 0 0-2.8-3.6M15.6 4.4a3.4 3.4 0 0 1 0 6.4" />
  </Icon>
);

const IconMic = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <rect x="9.2" y="3" width="5.6" height="10.4" rx="2.8" />
    <path d="M5.5 11.4a6.5 6.5 0 0 0 13 0M12 17.9V21" />
  </Icon>
);

const IconCheck = () => (
  <Icon size={18}>
    <path d="M5 12.6 9.2 16.8 19 7" />
  </Icon>
);

/* ------------------------------- giriş bloğu ------------------------------- */

function SignIn() {
  const { me, linkedinEnabled, demoEnabled, login, demoLogin } = useAuth();
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(false);

  if (me) {
    return (
      <div className="signin">
        <Link to="/dashboard" className="btn btn--primary btn--lg">
          {t("auth.editProfile")}
        </Link>
        <span className="signin__as">
          <b>{me.name}</b> {t("auth.loginNote")}
        </span>
      </div>
    );
  }

  const onLinkedIn = () => {
    if (linkedinEnabled) {
      login();
      return;
    }
    setNote(true);
  };

  const onDemo = (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    void demoLogin(name.trim() || t("auth.demoName"))
      .then(() => setNote(false))
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };

  return (
    <div className="signin">
      <button className="btn btn--linkedin btn--lg signin__li" onClick={onLinkedIn}>
        <span className="li-mark" aria-hidden="true">
          in
        </span>
        {t("auth.linkedInBtn")}
      </button>

      {note && !linkedinEnabled && (
        <p className="signin__note">
          {t("auth.oauthNotConfigured")}
        </p>
      )}

      {demoEnabled && (
        <form className="hero__demo signin__demo" onSubmit={onDemo}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("auth.demoPlaceholder")}
            maxLength={40}
            aria-label={t("auth.demoName")}
          />
          <button className="btn btn--secondary" type="submit" disabled={busy}>
            {busy ? "…" : t("auth.demoBtn")}
          </button>
        </form>
      )}
    </div>
  );
}

/* ---------------------------------- sayfa ---------------------------------- */

export default function Landing() {
  const { me } = useAuth();
  const { t } = useTranslation();

  const ROLES = [
    t("landing.features.items[0].title"), // We'll use a simpler approach for roles
  ];

  // For the marquee, we need static roles - use translation keys
  const ROLES_STATIC = [
    "Senior Frontend Developer",
    "Backend Engineer",
    "Product Manager",
    "DevOps Engineer",
    "UX Designer",
    "Data Scientist",
    "Sales Representative",
    "QA Engineer",
  ];

  const FEATURES = [
    {
      icon: <IconProfile />,
      title: t("landing.features.items[0].title"),
      text: t("landing.features.items[0].desc"),
    },
    {
      icon: <IconVideo />,
      title: t("landing.features.items[1].title"),
      text: t("landing.features.items[1].desc"),
    },
    {
      icon: <IconScreen />,
      title: t("landing.features.items[2].title"),
      text: t("landing.features.items[2].desc"),
    },
    {
      icon: <IconChat />,
      title: t("landing.features.items[3].title"),
      text: t("landing.features.items[3].desc"),
    },
    {
      icon: <IconBlocks />,
      title: t("landing.features.items[4].title"),
      text: t("landing.features.items[4].desc"),
    },
    {
      icon: <IconShield />,
      title: t("landing.features.items[5].title"),
      text: t("landing.features.items[5].desc"),
    },
  ];

  const STEPS = [
    {
      n: "01",
      icon: <IconLink />,
      title: t("landing.steps.steps[0]").split(",")[0], // "Connect with LinkedIn"
      text: t("landing.steps.steps[0]"),
    },
    {
      n: "02",
      icon: <IconUsers />,
      title: t("landing.steps.steps[1]").split(",")[0], // "Open room, share link"
      text: t("landing.steps.steps[1]"),
    },
    {
      n: "03",
      icon: <IconVideo />,
      title: t("landing.steps.steps[2]").split(",")[0], // "Interview, read profile"
      text: t("landing.steps.steps[2]"),
    },
  ];

  const PRIVACY = [
    t("landing.faq.items[0].a").split(". ")[0], // First sentence
    t("landing.faq.items[1].a").split(". ")[0],
    t("landing.faq.items[3].a"),
  ];

  const FAQ = [
    {
      q: t("landing.faq.items[0].q"),
      a: t("landing.faq.items[0].a"),
    },
    {
      q: t("landing.faq.items[1].q"),
      a: t("landing.faq.items[1].a"),
    },
    {
      q: t("landing.faq.items[2].q"),
      a: t("landing.faq.items[2].a"),
    },
    {
      q: t("landing.faq.items[3].q"),
      a: t("landing.faq.items[3].a"),
    },
  ];

  return (
    <main className="lp">
      {/* ------------------------------- HERO ------------------------------- */}
      <section className="lp-hero">
        <div className="lp-hero__text">
          <span className="lp-badge">
            <span className="lp-badge__dot" /> {t("landing.hero.description")}
          </span>

          <h1>
            {t("landing.hero.title")} <span className="grad">{t("landing.hero.subtitle")}</span>
          </h1>

          <p className="lead">
            {t("landing.hero.description")}
          </p>

          <div className="hero__cta">
            <SignIn />
          </div>

          <ul className="lp-stats">
            <li>
              <b>~2 min</b>
              <span>{t("landing.cta.button")}</span>
            </li>
            <li>
              <b>E2E</b>
              <span>encrypted audio & video</span>
            </li>
            <li>
              <b>0</b>
              <span>profile data pulled from LinkedIn</span>
            </li>
          </ul>
        </div>

        <div className="lp-hero__visual">
          <HeroVisual />
        </div>
      </section>

      {/* ------------------------------ ROLE STRIP --------------------------- */}
      <section className="lp-strip" aria-label={t("landing.features.title")}>
        <p className="lp-strip__label">{t("landing.features.title")}</p>
        <div className="lp-marquee">
          <div className="lp-marquee__track">
            {[...ROLES_STATIC, ...ROLES_STATIC].map((r, i) => (
              <span key={`${r}-${i}`}>{r}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ FEATURES --------------------------- */}
      <section className="lp-section" id="ozellikler">
        <header className="lp-head">
          <p className="eyebrow">{t("landing.features.title")}</p>
          <h2>{t("landing.features.title")}</h2>
          <p className="lead">
            {t("landing.features.items[0].desc").split(".")[0]}. {t("landing.features.items[1].desc").split(".")[0]}.
          </p>
        </header>

        <div className="lp-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className="lp-card">
              <span className="lp-card__icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* --------------------------- HOW IT WORKS --------------------------- */}
      <section className="lp-section lp-section--alt" id="nasil">
        <header className="lp-head">
          <p className="eyebrow">{t("landing.steps.title")}</p>
          <h2>{t("landing.steps.title")}</h2>
        </header>

        <ol className="lp-steps">
          {STEPS.map((s) => (
            <li key={s.n} className="lp-step">
              <div className="lp-step__top">
                <span className="lp-step__n">{s.n}</span>
                <span className="lp-step__icon">{s.icon}</span>
              </div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* --------------------------- REAL UI SCREENSHOT ------------------------- */}
      <section className="lp-section">
        <div className="lp-split">
          <div className="lp-split__text">
            <p className="eyebrow">{t("landing.features.items[0].title")}</p>
            <h2>{t("landing.features.items[0].desc").split(".")[0]}</h2>
            <p className="lead">
              {t("landing.features.items[0].desc")} {t("landing.features.items[1].desc").split(".")[0]}.
            </p>
            <ul className="lp-checks">
              <li>
                <IconCheck /> {t("landing.features.items[0].desc").split(";")[0]}
              </li>
              <li>
                <IconCheck /> {t("landing.features.items[3].desc").split(";")[0]}
              </li>
              <li>
                <IconCheck /> {t("landing.features.items[1].desc").split(".")[0]} {t("landing.features.items[2].desc").split(".")[0]}
              </li>
            </ul>
            {me ? (
              <Link to="/dashboard" className="btn btn--secondary">
                {t("nav.dashboard")} →
              </Link>
            ) : (
              <a href="#giris" className="btn btn--secondary">
                {t("landing.hero.ctaSecondary")}
              </a>
            )}
          </div>

          <figure className="lp-shot">
            <div className="lp-shot__frame">
              <span className="lp-shot__bar">
                <i /> <i /> <i />
                <em>localhost:4000/room/s_r7xjb_UQ</em>
              </span>
              <img
                src="/showcase-room.png"
                alt={t("landing.features.items[0].desc")}
                loading="lazy"
                width={2000}
                height={1125}
              />
            </div>
            <figcaption>
              {t("landing.features.items[0].desc")}
            </figcaption>
          </figure>
        </div>
      </section>

      {/* -------------------------- PRIVACY / WEBRTC ------------------------ */}
      <section className="lp-section lp-section--alt" id="guvenlik">
        <div className="lp-split lp-split--rev">
          <div className="lp-split__text">
            <p className="eyebrow">{t("landing.faq.title")}</p>
            <h2>{t("landing.faq.items[1].q")}</h2>
            <p className="lead">
              {t("landing.faq.items[1].a").split(".")[0]}. {t("landing.faq.items[1].a").split(".")[1]}.
            </p>
            <ul className="lp-checks">
              {PRIVACY.map((p) => (
                <li key={p}>
                  <IconCheck /> {p}
                </li>
              ))}
            </ul>
          </div>

          <div className="lp-dia" aria-hidden="true">
            <div className="lp-dia__server">
              <b>{t("landing.features.items[1].desc").split(".")[1]}</b>
              <em>{t("landing.faq.items[1].a").split(".")[2]}</em>
            </div>
            <div className="lp-dia__drop" />
            <div className="lp-dia__row">
              <div className="lp-dia__node">
                <span className="lp-dia__ava">A</span>
                <b>{t("landing.features.items[0].title")}</b>
                <em>{t("landing.features.items[1].desc").split(".")[1]}</em>
              </div>
              <div className="lp-dia__pipe">
                <b>↔</b>
                <em>{t("landing.faq.items[1].a").split(".")[3]}</em>
              </div>
              <div className="lp-dia__node">
                <span className="lp-dia__ava lp-dia__ava--b">İ</span>
                <b>{t("landing.features.items[0].title")}</b>
                <em>{t("landing.features.items[0].desc").split(";")[0]}</em>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------ EXTENSION ----------------------------- */}
      <section className="lp-section">
        <div className="lp-split">
          <div className="lp-split__text">
            <p className="eyebrow">{t("landing.features.items[4].title")}</p>
            <h2>{t("landing.features.items[4].desc").split(".")[0]}</h2>
            <p className="lead">
              {t("landing.features.items[4].desc")}
            </p>
            <ul className="lp-checks">
              <li>
                <IconCheck /> {t("landing.faq.items[3].a").split(".")[0]}
              </li>
              <li>
                <IconCheck /> {t("landing.faq.items[3].a").split(".")[1]}
              </li>
              <li>
                <IconCheck /> {t("landing.faq.items[3].a").split(".")[2]}
              </li>
            </ul>
          </div>
          <div className="lp-split__visual">
            <ExtensionMock />
          </div>
        </div>
      </section>

      {/* --------------------------------- FAQ ------------------------------- */}
      <section className="lp-section lp-section--alt" id="sss">
        <header className="lp-head">
          <p className="eyebrow">{t("landing.faq.title")}</p>
          <h2>{t("landing.faq.title")}</h2>
        </header>

        <div className="lp-faq">
          {FAQ.map((f) => (
            <details key={f.q} className="lp-faq__item">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* -------------------------------- CTA -------------------------------- */}
      <section className="lp-final" id="giris">
        <div>
          <p className="eyebrow">{t("landing.cta.title")}</p>
          <h2>{t("landing.cta.title")}</h2>
          <p className="lead">
            {t("landing.cta.button")}
          </p>
        </div>
        <SignIn />
      </section>

      <footer className="lp-footer">
        <p>
          {t("landing.footer.candidateProfile")}. {t("landing.footer.webrtc")}. {t("landing.footer.extension")}.
        </p>
        <span>© {new Date().getFullYear()} InterviewHub</span>
      </footer>
    </main>
  );
}

/* --------------------------------- components ------------------------------- */

function HeroVisual() {
  const { t } = useTranslation();
  return (
    <div className="hv" aria-hidden="true">
      <div className="hv__window">
        <div className="hv__bar">
          <span className="hv__dots">
            <i /> <i /> <i />
          </span>
          <em>{t("landing.hero.title")} · {t("landing.features.items[0].title")}</em>
          <b className="hv__live">
            <i /> {t("room.states.micReady")}
          </b>
        </div>

        <div className="hv__body">
          <div className="hv__stage">
            <div className="hv__tile">
              <span className="hv__role">{t("room.sidePanel.tabs.profile")}</span>
              <span className="hv__avatar">AY</span>
              <span className="hv__wave">
                <i /> <i /> <i /> <i /> <i />
              </span>
              <span className="hv__name">
                <b>Ayşe Yılmaz</b>
                <em>{t("landing.features.items[0].title")}</em>
              </span>
            </div>

            <div className="hv__tile hv__tile--me">
              <span className="hv__role hv__role--me">{t("auth.demoName")}</span>
              <span className="hv__avatar hv__avatar--me">MK</span>
              <span className="hv__name">
                <b>Mehmet Kaya</b>
                <em>{t("landing.features.items[1].title")}</em>
              </span>
            </div>

            <div className="hv__ctrls">
              <span className="hv__ctrl">
                <IconMic size={15} />
                {t("room.controls.mic")}
              </span>
              <span className="hv__ctrl">
                <IconVideo size={15} />
                {t("room.controls.cam")}
              </span>
              <span className="hv__ctrl">
                <IconScreen size={15} />
                {t("room.controls.screen")}
              </span>
              <span className="hv__ctrl hv__ctrl--leave">{t("room.controls.leave")}</span>
            </div>
          </div>

          <aside className="hv__panel">
            <div className="hv__tabs">
              <b>{t("room.sidePanel.tabs.profile")}</b>
              <span>{t("room.sidePanel.tabs.chat")}</span>
            </div>
            <div className="hv__person">
              <span className="hv__pic">AY</span>
              <div>
                <strong>Ayşe Yılmaz</strong>
                <em>{t("landing.features.items[0].title")}</em>
                <i>İstanbul, Türkiye</i>
              </div>
            </div>
            <div className="hv__actions">
              <span className="hv__open">{t("profileBody.linkedInBtn")}</span>
              <span className="hv__copy">{t("profileBody.copyLink")}</span>
            </div>
            <p className="hv__label">{t("profileBody.summary")}</p>
            <span className="hv__line" style={{ width: "92%" }} />
            <span className="hv__line" style={{ width: "74%" }} />
            <p className="hv__label">{t("profileBody.skills")}</p>
            <div className="hv__tags">
              <span>React</span>
              <span>TypeScript</span>
              <span>WebRTC</span>
            </div>
            <p className="hv__note">{t("profileBody.note")}</p>
          </aside>
        </div>
      </div>

      <span className="hv__float hv__float--1">
        <IconShield size={16} /> {t("landing.footer.webrtc")}
      </span>
      <span className="hv__float hv__float--2">
        <IconScreen size={16} /> {t("landing.features.items[2].title")}
      </span>
      <span className="hv__float hv__float--3">
        <IconBlocks size={16} /> {t("landing.features.items[4].title")}
      </span>
    </div>
  );
}

function ExtensionMock() {
  const { t } = useTranslation();
  return (
    <div className="ext" aria-hidden="true">
      <div className="ext__bar">
        <span className="hv__dots">
          <i /> <i /> <i />
        </span>
        <em>linkedin.com/in/candidate-profile</em>
      </div>
      <div className="ext__body">
        <div className="ext__page">
          <span className="ext__cover" />
          <span className="ext__ava">AY</span>
          <span className="hv__line" style={{ width: "52%" }} />
          <span className="hv__line" style={{ width: "78%" }} />
          <span className="hv__line" style={{ width: "66%" }} />
          <span className="hv__line" style={{ width: "84%" }} />
          <span className="hv__line" style={{ width: "44%" }} />
        </div>
        <aside className="ext__panel">
          <header>
            <b>IH InterviewHub</b>
            <em>{t("room.sidePanel.tabs.profile")}</em>
          </header>
          <div className="ext__room">
            <span className="ext__dot" />
            <div>
              <strong>{t("landing.features.items[0].title")}</strong>
              <em>{t("room.stage.participants")}</em>
            </div>
          </div>
          <span className="ext__join">{t("room.joinScreen.join")}</span>
          <div className="ext__tiles">
            <span>AY</span>
            <span>MK</span>
          </div>
          <span className="ext__mini">{t("room.sidePanel.tabs.profile")} · {t("room.sidePanel.tabs.chat")}</span>
        </aside>
      </div>
      <span className="ext__fab">IH</span>
    </div>
  );
}