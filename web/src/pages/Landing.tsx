import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";

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

/* --------------------------------- içerik --------------------------------- */

const ROLES = [
  "Kıdemli Frontend Developer",
  "Backend Mühendisi",
  "Ürün Yöneticisi",
  "DevOps Mühendisi",
  "UX Tasarımcı",
  "Veri Bilimci",
  "Satış Temsilcisi",
  "QA Mühendisi",
];

const FEATURES = [
  {
    icon: <IconProfile />,
    title: "Yan panelde LinkedIn profili",
    text: "Özet, deneyim, eğitim ve yetenekler görüşme boyunca tek bakışta durur; tek tıkla LinkedIn'de açılır.",
  },
  {
    icon: <IconVideo />,
    title: "Uçtan uca WebRTC görüntü",
    text: "Ses ve video tarayıcıdan tarayıcıya şifreli akar. Sunucu yalnızca iki tarafı tanıştırır, medyaya dokunmaz.",
  },
  {
    icon: <IconScreen />,
    title: "Ekran paylaşımı",
    text: "Teknik değerlendirme ve portfolyo sunumları için tek tıkla ekranınızı paylaşın.",
  },
  {
    icon: <IconChat />,
    title: "Görüşme içi sohbet",
    text: "Bağlantı, not ve doküman paylaşımı için odanın kalıcı sohbeti; görüşme bitince de durur.",
  },
  {
    icon: <IconBlocks />,
    title: "Chrome eklentisi",
    text: "LinkedIn'deyken tek tıkla oda açın, davet bağlantısını panelden gönderin, paneli açık tutun.",
  },
  {
    icon: <IconShield />,
    title: "Sahiplik ve gizlilik",
    text: "Profiller katılımcının kendi beyanıdır. Ne paylaşıldığını her zaman siz belirlersiniz.",
  },
];

const STEPS = [
  {
    n: "01",
    icon: <IconLink />,
    title: "LinkedIn ile bağlanın",
    text: "Giriş, LinkedIn OAuth ile doğrulanır. Profil verisi LinkedIn API'sinden çekilmez; bilgileri siz girersiniz.",
  },
  {
    n: "02",
    icon: <IconUsers />,
    title: "Odayı açın, bağlantıyı paylaşın",
    text: "Odanın davet bağlantısını LinkedIn mesajıyla adaya iletin. Ek kurulum, ek hesap, indirme yok.",
  },
  {
    n: "03",
    icon: <IconVideo />,
    title: "Görüşün, profili okuyun",
    text: "Aday katılınca video ve profili yan yana gelir. Ekran paylaşın, sohbet edin, kararı tek ekranda verin.",
  },
];

const PRIVACY = [
  "LinkedIn API'sinden profil verisi çekilmez; bilgileri kullanıcı kendi beyanıyla girer.",
  "Görüntü ve ses kaydı sunucuda saklanmaz — akış doğrudan tarayıcılar arasındadır.",
  "Odaya erişim yalnızca paylaşılan davet bağlantısıyla olur.",
  "Kaynak kod sizin sunucunuzda çalışır; veri üçüncü taraf servislere gitmez.",
];

const FAQ = [
  {
    q: "LinkedIn'den veri çekiyor musunuz?",
    a: "Hayır. Giriş için LinkedIn OAuth kullanılır, ancak profil bilgileri LinkedIn API'sinden alınmaz. Özet, deneyim, eğitim ve yetenekleri kullanıcılar kendi profillerine girer; bu bilgiler LinkedIn'e gönderilen bir formun içeriğidir, otomatik bir çekim değildir.",
  },
  {
    q: "Görüşmeler kaydediliyor mu?",
    a: "Hayır. Ses ve görüntü WebRTC ile doğrudan iki tarayıcı arasında akar; sunucu yalnızca tanışma (sinyal) bilgisini taşır. Varsayılan olarak kayıt özelliği yoktur, görüşme sonrasında hiçbir medya dosyası saklanmaz.",
  },
  {
    q: "Kurulum ne kadar sürer?",
    a: "Tek komut seti: npm install, .env ayarı, npm run build ve npm start. Ortalama iki dakika. Ardından tarayıcıdan oda açıp davet bağlantısını paylaşabilirsiniz.",
  },
  {
    q: "Chrome eklentisi zorunlu mu?",
    a: "Hayır. Tüm akış web uygulamasından çalışır. Eklenti, LinkedIn'deyken tek tıkla oda açmayı ve görüşme panelini açık tutmayı kolaylaştıran bir kısayoldur.",
  },
  {
    q: "Farklı ağlardaki katılımcılar bağlanabilir mi?",
    a: "Evet. Çoğu ağda STUN yeterlidir. Simetrik NAT gibi kısıtlı ağlar için .env içine kendi TURN sunucunuzu tanımlayabilirsiniz.",
  },
  {
    q: "Kimler kullanabilir?",
    a: "Hem işverenler hem adaylar. Davet bağlantısını açan herkes, adıyla veya LinkedIn girişiyle odaya katılabilir.",
  },
];

/* -------------------------------- giriş bloğu ------------------------------- */

function SignIn() {
  const { me, linkedinEnabled, demoEnabled, login, demoLogin } = useAuth();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(false);

  if (me) {
    return (
      <div className="signin">
        <Link to="/dashboard" className="btn btn--primary btn--lg">
          Görüşme odası aç →
        </Link>
        <span className="signin__as">
          <b>{me.name}</b> olarak giriş yaptınız
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
    void demoLogin(name.trim() || "Demo Kullanıcı")
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
        LinkedIn ile devam et
      </button>

      {note && !linkedinEnabled && (
        <p className="signin__note">
          LinkedIn girişi için sunucudaki <code>.env</code> dosyasına{" "}
          <code>LINKEDIN_CLIENT_ID</code> ve <code>LINKEDIN_CLIENT_SECRET</code> eklenmeli.
          Bağlantıyı kopyalayıp deneyebilir ya da şimdilik demo ile devam edebilirsiniz.
        </p>
      )}

      {demoEnabled && (
        <form className="hero__demo signin__demo" onSubmit={onDemo}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Adınız (demo)"
            maxLength={40}
            aria-label="Adınız (demo)"
          />
          <button className="btn btn--secondary" type="submit" disabled={busy}>
            {busy ? "…" : "Demo dene"}
          </button>
        </form>
      )}
    </div>
  );
}

/* ------------------------------- yerleşim blokları ------------------------- */

function HeroVisual() {
  return (
    <div className="hv" aria-hidden="true">
      <div className="hv__window">
        <div className="hv__bar">
          <span className="hv__dots">
            <i /> <i /> <i />
          </span>
          <em>Görüşme · Kıdemli Frontend Developer</em>
          <b className="hv__live">
            <i /> CANLI
          </b>
        </div>

        <div className="hv__body">
          <div className="hv__stage">
            <div className="hv__tile">
              <span className="hv__role">Aday</span>
              <span className="hv__avatar">AY</span>
              <span className="hv__wave">
                <i /> <i /> <i /> <i /> <i />
              </span>
              <span className="hv__name">
                <b>Ayşe Yılmaz</b>
                <em>Senior Software Engineer</em>
              </span>
            </div>

            <div className="hv__tile hv__tile--me">
              <span className="hv__role hv__role--me">Siz</span>
              <span className="hv__avatar hv__avatar--me">MK</span>
              <span className="hv__name">
                <b>Mehmet Kaya</b>
                <em>Teknik Görüşmeci</em>
              </span>
            </div>

            <div className="hv__ctrls">
              <span className="hv__ctrl">
                <IconMic size={15} />
                Mikrofon
              </span>
              <span className="hv__ctrl">
                <IconVideo size={15} />
                Kamera
              </span>
              <span className="hv__ctrl">
                <IconScreen size={15} />
                Ekran
              </span>
              <span className="hv__ctrl hv__ctrl--leave">Ayrıl</span>
            </div>
          </div>

          <aside className="hv__panel">
            <div className="hv__tabs">
              <b>LinkedIn Profili</b>
              <span>Sohbet</span>
            </div>
            <div className="hv__person">
              <span className="hv__pic">AY</span>
              <div>
                <strong>Ayşe Yılmaz</strong>
                <em>Senior Software Engineer</em>
                <i>İstanbul, Türkiye</i>
              </div>
            </div>
            <div className="hv__actions">
              <span className="hv__open">LinkedIn'de aç ↗</span>
              <span className="hv__copy">Kopyala</span>
            </div>
            <p className="hv__label">ÖZET</p>
            <span className="hv__line" style={{ width: "92%" }} />
            <span className="hv__line" style={{ width: "74%" }} />
            <p className="hv__label">YETENEKLER</p>
            <div className="hv__tags">
              <span>React</span>
              <span>TypeScript</span>
              <span>WebRTC</span>
            </div>
            <p className="hv__note">Bu bilgiler katılımcının kendi beyanıdır.</p>
          </aside>
        </div>
      </div>

      <span className="hv__float hv__float--1">
        <IconShield size={16} /> Uçtan uca şifreli
      </span>
      <span className="hv__float hv__float--2">
        <IconScreen size={16} /> Ekran paylaşımı
      </span>
      <span className="hv__float hv__float--3">
        <IconBlocks size={16} /> Chrome eklentisi
      </span>
    </div>
  );
}

function ExtensionMock() {
  return (
    <div className="ext" aria-hidden="true">
      <div className="ext__bar">
        <span className="hv__dots">
          <i /> <i /> <i />
        </span>
        <em>linkedin.com/in/aday-ozgecmisi</em>
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
            <em>yan panel</em>
          </header>
          <div className="ext__room">
            <span className="ext__dot" />
            <div>
              <strong>Kıdemli Frontend Developer</strong>
              <em>2 katılımcı · oda hazır</em>
            </div>
          </div>
          <span className="ext__join">Görüşmeye katıl</span>
          <div className="ext__tiles">
            <span>AY</span>
            <span>MK</span>
          </div>
          <span className="ext__mini">LinkedIn Profili · Sohbet</span>
        </aside>
      </div>
      <span className="ext__fab">IH</span>
    </div>
  );
}

/* ---------------------------------- sayfa ---------------------------------- */

export default function Landing() {
  const { me } = useAuth();

  return (
    <main className="lp">
      {/* ------------------------------- HERO ------------------------------- */}
      <section className="lp-hero">
        <div className="lp-hero__text">
          <span className="lp-badge">
            <span className="lp-badge__dot" /> LinkedIn'de kabul edilen başvurular için
          </span>

          <h1>
            Mülakat sırasında adayın <span className="grad">LinkedIn profili</span> hep
            ekranınızda.
          </h1>

          <p className="lead">
            InterviewHub; kabul edilmiş başvuruların görüşmelerini tek ekranda toplar — video,
            sohbet ve adayın profili yan yana. Davet bağlantısını paylaşın, iki dakikada
            görüşmeye başlayın.
          </p>

          <div className="hero__cta">
            <SignIn />
          </div>

          <ul className="lp-stats">
            <li>
              <b>~2 dk</b>
              <span>ilk odaya kadar</span>
            </li>
            <li>
              <b>Uçtan uca</b>
              <span>şifreli ses &amp; görüntü</span>
            </li>
            <li>
              <b>0</b>
              <span>LinkedIn'den çekilen profil verisi</span>
            </li>
          </ul>
        </div>

        <div className="lp-hero__visual">
          <HeroVisual />
        </div>
      </section>

      {/* ------------------------------ ROL ŞERİDİ --------------------------- */}
      <section className="lp-strip" aria-label="Hazır olduğunuz roller">
        <p className="lp-strip__label">Her rol için hazır bir oda</p>
        <div className="lp-marquee">
          <div className="lp-marquee__track">
            {[...ROLES, ...ROLES].map((r, i) => (
              <span key={`${r}-${i}`}>{r}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ ÖZELLİKLER --------------------------- */}
      <section className="lp-section" id="ozellikler">
        <header className="lp-head">
          <p className="eyebrow">Özellikler</p>
          <h2>Görüşme için gereken her şey tek ekranda</h2>
          <p className="lead">
            Videoyu, profili ve notları ayrı sekmeler arasında kaybetmeyin. InterviewHub görüşmeyi
            ve adayın geçmişini aynı yüzeyde tutar.
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

      {/* --------------------------- NASIL ÇALIŞIR --------------------------- */}
      <section className="lp-section lp-section--alt" id="nasil">
        <header className="lp-head">
          <p className="eyebrow">Nasıl çalışır?</p>
          <h2>Üç adımda canlı görüşme</h2>
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

      {/* ---------------------------- GERÇEK GÖRÜNTÜ ------------------------- */}
      <section className="lp-section">
        <div className="lp-split">
          <div className="lp-split__text">
            <p className="eyebrow">Gerçek arayüz</p>
            <h2>Aday sizinle görüşürken profili de yanında</h2>
            <p className="lead">
              Solda iki video alanı ve altta kontrol çubuğu, sağda karşı tarafın LinkedIn profili:
              özet, deneyim, eğitim ve yetenekler. Sekmeler arasında gezinmeden konuşun.
            </p>
            <ul className="lp-checks">
              <li>
                <IconCheck /> Davet bağlantısı ve canlı katılımcı sayısı üst barda
              </li>
              <li>
                <IconCheck /> Profil sekmesi ile sohbet aynı panelde
              </li>
              <li>
                <IconCheck /> Mikrofon, kamera, ekran ve ayrıl kontrolleri tek satırda
              </li>
            </ul>
            {me ? (
              <Link to="/dashboard" className="btn btn--secondary">
                Kendi odanızı açın →
              </Link>
            ) : (
              <a href="#giris" className="btn btn--secondary">
                Hemen deneyin →
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
                alt="İki kişilik görüşme odası: video alanları, altta kontrol çubuğu ve sağda LinkedIn profil paneli"
                loading="lazy"
                width={2000}
                height={1125}
              />
            </div>
            <figcaption>
              İki kişilik canlı oda — sağ panelde adayın profili, üstte davet bağlantısı.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* -------------------------- GÜVENLİK / WEBRTC ------------------------ */}
      <section className="lp-section lp-section--alt" id="guvenlik">
        <div className="lp-split lp-split--rev">
          <div className="lp-split__text">
            <p className="eyebrow">Altyapı &amp; gizlilik</p>
            <h2>Ses ve görüntü sunucudan geçmez</h2>
            <p className="lead">
              InterviewHub kendi WebRTC + Socket.IO sinyal sunucusunu kullanır. Sunucu yalnızca
              iki tarayıcıyı tanıştırır; medya akışı uçtan uca şifrelenir ve hiçbir yerde
              saklanmaz.
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
              <b>Sinyal sunucusu</b>
              <em>Sadece tanıştırma · medya buradan geçmez</em>
            </div>
            <div className="lp-dia__drop" />
            <div className="lp-dia__row">
              <div className="lp-dia__node">
                <span className="lp-dia__ava">A</span>
                <b>Adayın tarayıcısı</b>
                <em>Chrome · Safari · Edge</em>
              </div>
              <div className="lp-dia__pipe">
                <b>↔</b>
                <em>Uçtan uca şifreli · DTLS-SRTP</em>
              </div>
              <div className="lp-dia__node">
                <span className="lp-dia__ava lp-dia__ava--b">İ</span>
                <b>İşverenin tarayıcısı</b>
                <em>Profil paneli açık</em>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------- EKLENTİ ----------------------------- */}
      <section className="lp-section">
        <div className="lp-split">
          <div className="lp-split__text">
            <p className="eyebrow">Chrome eklentisi</p>
            <h2>LinkedIn'deyken görüşmeye başlayın</h2>
            <p className="lead">
              Eklentiyi kurduğunuzda LinkedIn sayfalarında InterviewHub düğmesi belirir. Odayı
              açın, davet bağlantısını panelden gönderin ve profil görünümünü açık tutarak
              görüşme boyunca LinkedIn'de kalın.
            </p>
            <ul className="lp-checks">
              <li>
                <IconCheck /> Sayfaya gömülü tek tıkla oda açma
              </li>
              <li>
                <IconCheck /> Yan panelde profil ve sohbet
              </li>
              <li>
                <IconCheck /> Web uygulamasıyla aynı hesap ve odalar
              </li>
            </ul>
          </div>
          <div className="lp-split__visual">
            <ExtensionMock />
          </div>
        </div>
      </section>

      {/* --------------------------------- SSS ------------------------------- */}
      <section className="lp-section lp-section--alt" id="sss">
        <header className="lp-head">
          <p className="eyebrow">SSS</p>
          <h2>Sık sorulanlar</h2>
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
          <p className="eyebrow">Hazırsanız</p>
          <h2>İlk görüşmenizi bugün açın</h2>
          <p className="lead">
            LinkedIn ile bağlanın ya da demo modunu deneyin — oda, davet bağlantısı ve profil
            paneli hazır.
          </p>
        </div>
        <SignIn />
      </section>

      <footer className="lp-footer">
        <p>
          InterviewHub bir açık kaynaklı prototiptir. LinkedIn, LinkedIn markasının sahibi
          değildir ve bu ürün LinkedIn tarafından destekmez. Kullanım koşullarını ve veri
          gizliliğini yayınlayınız önceden değerlendirin.
        </p>
        <span>© {new Date().getFullYear()} InterviewHub</span>
      </footer>
    </main>
  );
}
