# InterviewHub

LinkedIn üzerinden kabul edilen başvuruların mülakatlarını **LinkedIn bağlantısı üzerinden video görüşme** ile yönetmeni sağlar. Görüşme sırasında işveren, adayın LinkedIn profilini panelde canlı görür.

MVP kapsamı: **web uygulaması + Chrome eklentisi**, kendi WebRTC/S Socket.IO sinyal altyapısı üzerinde çalışır.

> **Önemli (yukarıdan başlayarak oku):** LinkedIn API'si, LinkedIn'de başlayan bir video mülakatı uygulamasını beslemek için tasarlanmamıştır. Bu proje profil verisini **LinkedIn API'sinden çekmez**; profil bilgilerini kullanıcı beyanıyla (kopyala-yapıştır / form) kaydeder ve LinkedIn profiline **derin bağlantı** verir. Bkz. [Gizlilik & Hükümler](#gizlilik--hükümler).

---

## Mimari

```
interviewhub/
├── shared/      # Ortak tip sözleşmesi (tip paylaşımı için, build çıktısı yok)
├── server/      # Node + TS: REST API, oturum (HMAC token), Socket.IO sinyal sunucusu
├── web/         # React + Vite: kayıt/giriş, profil editörü, mülakat odası
├── extension/   # Chrome MV3 eklentisi: side panel + LinkedIn sayfasına FAB
└── scripts/     # Otomatik testler + sağlık kontrolü + watchdog
```

- **Video:** WebRTC P2P (mesh), perfect negotiation deseni; STUN/TURN sunucusu `/api/ice` üzerinden dağıtılır.
- **Landing (`/`):** tanıtım sayfası — hero + canlı oda maketi, özellik kartları, 3 adımlı akış, gerçek ekran görüntüsü (`web/public/showcase-room.png`), WebRTC mimari diyagramı, Chrome eklentisi vitrini, SSS ve **LinkedIn Connect** giriş bloğu. Kaynak: `web/src/pages/Landing.tsx`, stiller: `web/src/styles.css` içindeki `landing` bölümü.
- **Sinyal:** Socket.IO — oda yaşam döngüsü, join/leave, SDP/ICE relay, medya durumu, sohbet.
- **Oturum:** `HMAC-SHA256` imzalı token. Tarayıcıda `ih_session` HttpOnly cookie, eklentide `Authorization: Bearer`.
- **Kalıcılık:** JSON dosyası (`server/.data/db.json`) — **atomik yazılır** (geçici dosya + rename); bozuk dosya tespit edilirse üzerine yazılmadan `.bozuk-<zaman>` olarak yedeklenir.
- **Bağlantı adresi:** `/api/config` → `webUrl`, oda/giriş bağlantıları için sunucu kendini tanımlar: derlenmiş web sunucudaysa kendi adresi, geliştirmede Vite sunucusu kullanılır (`resolveWebBase()`, 60 sn önbellekli).
- **CORS:** yalnızca aynı origin, `PUBLIC_URL`/`WEB_URL` ve `chrome-extension://` origin'lerine izin verilir; diğer siteler cookie'li oturumu kullanamaz.

---

## Çoklu dil (i18n)

Arayüz varsayılan olarak **İngilizcedir** ve **8 dil** desteklenir:
`EN` · `DE` · `FR` · `ES` · `TR` · `RU` · `JA` · `ZH`.

Web uygulaması `i18next` + `react-i18next`, Chrome eklentisi ise kendi hafif `t()` modülünü
kullanır — **ikisi de aynı anahtar adlarını ve aynı dil listesini paylaşır**.

| | Web (`web/src/i18n/`) | Eklenti (`extension/src/i18n.ts`) |
|---|---|---|
| Motor | `i18next` + `react-i18next` | vanilla `t(key, params)` |
| Bileşenler | `useTranslation()` hook'u | `data-i18n*` nitelikleri + `t()` |
| Kaynak | `locales/*.json` (iç içe anahtar) | `locales/*.json` (düz anahtar) |
| Dil tercihi | `localStorage["ih_lang"]` | `chrome.storage.local["ih_lang"]` |
| Varsayılan | `en` | `en` |

> Tarayıcı dili **bilerek dinlenmiyor**: site her zaman İngilizce açılır, kullanıcı dil
> seçtiğinde tercihi kalıcı olarak saklanır (`detection.order: ["localStorage"]`).

### Yeni metin eklerken

1. **Önce `en.json`'a** anahtarı ekleyin (master kaynak budur).
2. Diğer 7 dil dosyasına **aynı anahtarı** ekleyin — eksik dil, testi kırar.
3. Bileşende `t("anahtar")` kullanın; parametreler `{ad}` biçimindedir.

Eldeki anahtarları başka bir dile taşımak/eklemek için:

```bash
node scripts/i18n-merge.mjs web/src/i18n/locales/ hedef-dil.json yeni-anahtarlar.json
# JSON'da null = mevcut değeri koru, dolu = ekle/geçersiz kıl
```

### Kalıcı doğrulama

`npm run test:i18n` (ve `test:all`) şunları **her çalıştırmada** denetler:

- 8 dil × anahtar paritesi (eksik/fazla anahtar)
- Kaynak kodda kullanılan `t("anahtar")` / `translate("anahtar")` ve HTML'deki
  `data-i18n*` niteliklerindeki anahtarların tanımlı olması
- **Her anahtarın gerçek i18next ile çözülmesi** — "JSON'da anahtar var" ile
  "i18next onu buluyor" aynı şey değildir (ör. `items[0].x` çözülmez, `items.0.x` çözülür)
- Bileşenin `split()` ile ayırdığı değerlerde ayraç zorunluluğu (bkz. `STRUCTURE_CONTRACTS`)

Yani yeni bir özellik unutulmuş bir çeviriyi sessizce üretime taşıyamaz — test kırılır.

### Çeviriden UI metni türetme (yapmayın)

Ekran görüntüsü testleriyle yakalanan gerçek bir hata sınıfı: çeviriyi
`split()` ile parçalayıp ikinci bir arayüz metni **türetmek**. Örnek:

```tsx
// HATA: başlık, açıklamanın ilk cümlesinden geliyor
<h2>{t("landing.features.items.0.desc").split(".")[0]}</h2>
<p className="lead">{t("landing.features.items.0.desc")}</p>
```

Bunun üç sonucu var ve hepsi production'da göründü:

1. **Açıklama tek cümleyse** başlık ile gövde birebir aynı metin olur
   (ekranda üst üste iki kez).
2. **Ayracı içermeyen dillerde** `split()` hiç bölemez, alınan parça tüm
   cümledir — `ja`, `zh`, `ru`, `de` nokta yerine `。` kullandığı için
   nokta ayıracı işlemez.
3. **Parçaları birleştirmek** nokta koymadan iki cümleyi yanyana yapıştırır
   ("…browser to browser Share your screen…").

Kural: **Her görünen metin kendi anahtarına sahip olsun.** Türetilmiş metin
gerekliyse ayraç, tüm dillerde *zorunlu* olmalı ve bunu `STRUCTURE_CONTRACTS`
korumalıdır. Bkz. `web/src/pages/Landing.tsx` içindeki
`landing.features.eyebrow` / `landing.showcase.heading` örnekleri.

---

## Kurulum

```bash
npm install
cp .env.example .env      # gerekliyse düzenleyin
```

### `.env` ayarları

| Anahtar | Zorunlu mu? | Açıklama |
|---|---|---|
| `PORT` | hayır | Sunucu portu (varsayılan `4000`) |
| `PUBLIC_URL` | hayır | API + statik web'in adresi; oda/giriş bağlantıları bununla kurulur (varsayılan `http://localhost:4000`) |
| `WEB_URL` | hayır | Vite geliştirme sunucusu; derlenmiş web yoksa bağlantılar buraya gider (varsayılan `http://localhost:5173`) |
| `SESSION_SECRET` | **evet (üretimde)** | Token imzalama anahtarı. Üretimde mutlaka güçlü, rastgele bir değer verin. |
| `LINKEDIN_CLIENT_ID` | hayır | Boşsa LinkedIn girişi devre dışı, demo girişi aktif kalır. |
| `LINKEDIN_CLIENT_SECRET` | hayır | Yukarıdaki ile birlikte. |
| `STUN_SERVERS` | hayır | STUN sunucuları (varsayılan `stun:stun.l.google.com:19302`) |
| `TURN_URL` / `TURN_USERNAME` / `TURN_CREDENTIAL` | hayır | TURN kimlik bilgileri (simetrik NAT için) |

### Geliştirme

```bash
npm run dev          # tüm workspace'leri paralel çalıştırır
# server → http://localhost:4000
# web    → http://localhost:5173 (API'yi /api üzerinden 4000'e proxy'ler)
```

Tek tek de çalıştırılabilir:

```bash
npm run dev -w @ih/server
npm run dev -w @ih/web
npm run build -w @ih/extension   # eklenti derlemesi (izlemeli değil)
```

### Derleme & çalıştırma (üretim benzeri)

```bash
npm run build         # shared tip kontrolü + server bundle + web build + eklenti
npm run start -w @ih/server   # http://localhost:4000 — API + statik web + SPA fallback
```

> **Sunucu beklenmedik şekilde kapanırsa:** `npm run start:watch` (watchdog) sunucuyu
> çalıştırır ve çökerse kendiliğinden yeniden başlatır. Temiz kapanış (Ctrl+C)
> veya "port zaten kullanıyor" durumunda yeniden başlatma yapılmaz.
> Windows'ta watchdog `scripts/watchdog.ps1` (PowerShell) üzerinden çalışır;
> sunucu çıktısı `server/.data/server.log` (stdout) ve
> `server/.data/server.err.log` (stderr) dosyalarına yazılır.

### Kontroller

```bash
npm run status        # sunucu sağlığı: /api/health (çıkış kodu 0 = sağlıklı)
npm run typecheck     # üç workspace'te tsc --noEmit
npm run test          # typecheck + sinyal katmanı testi
npm run test:all      # typecheck + sinyal + WebRTC e2e + eklenti e2e
```

### Otomatik testler

| Betik | Ne yapar |
|---|---|
| `npm run test:i18n` | **i18n tutarlılığı**: web + eklenti için 8 dil paritesi, tanımsız anahtar, boş çeviri, gerçek i18next çözme testi |
| `npm run test:asset` | **Asset yolları**: `web/src` + `web/index.html` içinde base'siz mutlak varlık referansı (`/showcase.png` gibi) var mı. Pages `/interviewhub/` altında yayında, bu yüzden yollar `BASE_URL` ile kurulmalı |
| `npm run test:signal` | Socket.IO sinyal katmanı: katılma, peer olayları, relay, sohbet. Argüman verilmezse test ortamını (demo kullanıcılar + oda + profil) **kendisi hazırlar** |
| `npm run test:e2e` | **Gerçek Chrome'da** iki sekme açar, odaya girer, P2P + medya akışını doğrular (CDP gerekir). Test ortamı yoksa kendisi oluşturur |
| `npm run test:ext` | **Eklenti E2E**: LinkedIn sayfasında FAB enjeksiyonu + trusted tıklama ile yan panelin açılması + panel arayüzü |
| `node scripts/ext-lang-check.mjs` | **Eklenti dil doğrulaması**: panelde dil seçicisini 8 dile çevirir, metnin gerçekten o dile geçtiğini ve `<html lang>` güncellendiğini kontrol eder (CDP gerekir) |
| `node scripts/screenshot.mjs <url> [cikti.png]` | Tek sayfanın ekran görüntüsü |

`npm run test:all` yukarıdakilerin tamamını sırayla çalıştırır (i18n ilk sırada — en hızlısıdır).

Test ortamı (`%TEMP%\ih-test-env.json`) `scripts/testenv.mjs` tarafından yönetilir:
token süresi dolarsa, oda silinirse veya dosya yoksa otomatik yeniden üretilir.

E2E için CDP tarayıcısını tek komutla açın (uygun binary'yi — Playwright Chromium /
Chrome for Testing — otomatik bulur; markalı Chrome `--load-extension`'ı yok saydığı için
eklenti testleri için Chromium gerekir):

```bash
node scripts/cdp-start.mjs        # port 9333, eklenti yüklü, sahte medya cihazları
# veya ayrı ayrı açmak isterseniz:
chrome.exe --remote-debugging-port=9333 --remote-allow-origins=* \
  --user-data-dir="%TEMP%\ih-chrome-profile" \
  --use-fake-ui-for-media-stream about:blank
```

> **Not:** Gömülü/ Electron tabanlı test tarayıcıları bu makinede ICE aday üretmiyor
> (toplama hemen "complete" oluyor, aday olayı hiç tetiklenmiyor) — WebRTC doğrulaması
> her zaman gerçek Chrome/Edge'de yapılmalıdır. Kamera yoksa uygulama sesli katılıma
> düşer, `getUserMedia` hiç dönmezse 8 saniyelik güvenlik zaman aşımıyla **medyasız**
> katılım mümkündür.

Geliştirme bayrakları (yalnızca test/otomasyon için):

- `?debug=1` — sinyal/WebRTC konsol logları + `window.__ihRoom()` tanı globali
- `?autojoin=1` — katılma ekranını atlayıp doğrudan odaya girer

---

## LinkedIn uygulaması kurulumu

LinkedIn Developer Portal'da bir uygulama oluşturun ve şu ayarları verin:

1. **Auth tablosu → Redirect URLs** (hepsi birebir şöyle olmalı):
   - `http://localhost:4000/auth/linkedin/callback` (geliştirme)
   - `https://< producción >/auth/linkedin/callback` (üretim)
   - `https://<EXTENSION_ID>.chromiumapp.org/` — **eklenti girişi için zorunlu**
     (`EXTENSION_ID`, `chrome://extensions` sayfasında eklentiyi yükledikten sonra görünür;
     `chrome.identity.getRedirectURL()` ile kod içinde de üretilebilir.)
2. **Products → Sign In with LinkedIn using OpenID Connect** izinlerini ekleyin.
3. İstenen kapsam: `openid profile email`.

`.env` içine:

```env
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
SESSION_SECRET=...   # örn: openssl rand -hex 32
```

LinkedIn yapılandırılmamışsa uygulama **demo girişiyle** çalışır (`demo:...` kullanıcı adları) — profil ve oda akışlarının tamamı test edilebilir.

---

## Chrome eklentisi

1. `npm run build -w @ih/extension`
2. `chrome://extensions` → **Geliştirici modu** aç → **Paketi olmayan eklenti** → `extension/dist` klasörünü seçin.
   > **Not:** Google, markalı Chrome 137+ sürümünden beri `--load-extension` bayrağını kaldırdı —
   > eklentiyi **arayüzden** (Paketi olmayan eklenti) yükleyin veya markasız bir Chromium /
   > Chrome for Testing kullanın (otomatik testlerde `--load-extension` hâlâ çalışır).
3. Extension ID'yi not edin, LinkedIn Developer Portal'daki redirect listesine
   `https://<EXTENSION_ID>.chromiumapp.org/` ekleyin ve yapılandırmayı kaydedin.
4. Herhangi bir LinkedIn profilinde sağ altta **InterviewHub** butonu (FAB) görünür;
   yan panelde oda oluşturup davet bağlantısını kopyalayabilirsiniz.

Eklenti girişi: `chrome.identity.launchWebAuthFlow` → sunucudaki `/auth/extension` → LinkedIn (veya demo) → imzalı token `?token=` ile geri döner ve `chrome.storage.local`'a yazılır.

Panelin üst barında bir **dil seçici** vardır (8 dil). Tercih `chrome.storage.local["ih_lang"]`'a yazılır; seçili değilse arayüz İngilizce açılır. LinkedIn sayfasındaki FAB butonu da aynı dilde etiketlenir. Tüm metinler `extension/src/locales/*.json` içindedir (bkz. [Çoklu dil](#çoklu-dil-i18n)).

---

## Mülakat akışı (nasıl kullanılır)

1. Web'den kaydol / demo ile giriş yap.
2. **Profil** sayfasında LinkedIn profil bilgilerini gir (özet, deneyim, eğitim, yetenekler) ve LinkedIn profil URL'ni ekle.
3. **Yeni oda oluştur** → davet bağlantısını kopyala → adayla paylaş.
4. Aday bağlantıya tıklar/katılır, kamera-mikrofonunu açar.
5. Görüşme sırasında sağ panelde karşı tarafın LinkedIn kartı görünür; **LinkedIn'de aç** ile profil tarayıcıda açılır.
6. Sohbet, ekran paylaşımı ve medya kontrolleri oda alt barındadır.

---

## Gizlilik & Hükümler

- **LinkedIn API kullanılmaz.** Profil verisi kullanıcı beyanıyla kaydedilir; LinkedIn yalnızca derin bağlantı hedefidir.
- **LinkedIn markası / ToS:** Bu ürün LinkedIn tarafından desteklenmez, onaylanmamıştır. LinkedIn'in ürün işaretlerini ve verisini izinsiz kazımak (scraping), oturum paylaşımı vb. hükümlere aykırıdır. Üretimde marka kullanımı için LinkedIn'den izin alın.
- **Video akışı sunucudan geçmez:** medya P2P'dir; sunucu yalnızca sinyal (SDP/ICE) ve sohbeti yönlendirir.
- Kayıtlı veriler: kullanıcı kimliği, profil beyanı, oda listesi, davet bağlantıları — `server/.data/db.json`.
- LinkedIn OAuth yalnızca temel profil kapsamıyla (`openid profile email`) istenir.

---

## Hata yönetimi & dayanıklılık

- **Sunucu:** port doluysa okunabilir mesaj + çıkış kodu 1; beklenmedik hata (`uncaughtException`/`unhandledRejection`) sunucuyu kapatmaz; `SIGINT`/`SIGTERM` ile düzgün kapanış.
- **Watchdog:** `npm run start:watch` sunucuyu çalıştırır, çökerse 60 sn penceresinde en fazla 10 kez yeniden başlatır. Windows'ta watchdog PowerShell (`scripts/watchdog.ps1`) üzerinden çalışır — bu makinede `node.exe` süreçleri bazen dışarıdan sonlandırıldığında, node tabanli bir watchdog da birlikte ölür; PowerShell watchdog hayatta kalıp sunucuyu yeniden başlatır (başlatmak için WMI/`Win32_Process.Create` veya Görev Zamanlayıcısı kullanılabilir). Diğer platformlarda `scripts/serve.mjs` (node) kullanılır.
- **İstemci (oda):** bağlantı kopmasında socket.io otomatik yeniden bağlanır ve `connect` olayında odaya yeniden katılır; sunucu listesinde olmayan "hayalet" peer'lar temizlenir. Tüm yeniden denemeler biterse ekran "Bağlanılıyor…"da kilitlenmez — hata mesajı + çalışan "Yeniden katıl" butonu gösterilir.
- **Medya:** `getUserMedia` hiç dönmezse 8 sn güvenlik zaman aşımıyla medyasız katılım; kamera yoksa sesli, ses yoksa görüntülü katılım.
- **Profil verisi:** eski/eksik kayıtlarda dizi alanları `null` olabilir — `normalizeProfile()` tüm okuma noktalarında güvenli varsayılanlarla tamamlar.
- **Eklenti:** service worker'la iletişim 8 sn zaman aşımına sahiptir; `chrome.runtime.lastError` kontrol edilir, eklenti güncellenmişse kullanıcıya açık mesaj gösterilir.

---

## Bilinen MVP sınırları

- Mesh WebRTC: 1↔1 mülakat için ideal; 3+ katılımcı için SFU gerekir.
- TURN sunucusu hazır yapılandırılmamıştır (yansıyan/simetrik NAT senaryoları için `TURN_*` ayarlanmalı).
- Medya kalıcılığı yok (sayfa yenilenirse akış yeniden bağlanır).
- LinkedIn OAuth yapılandırılmadan demo girişi kullanılır.
