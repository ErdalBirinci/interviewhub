import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { absorbTokenFromUrl, AuthProvider } from "./lib/auth";
import "./i18n"; // i18n initialize
import "./styles.css";

// ?token=... ile acilan sayfalarda token'i render'dan (ve ilk fetch'lerden) once em:
// aksi halde ilk oda/profil istekleri tokensiz gider ve 401 doner.
absorbTokenFromUrl();

/* ------------------------------ tema sistemi ------------------------------ */
// Sistem tercihini oku; localStorage'da kayitli tercih varsa onu kullan.
type Theme = "dark" | "light";
const THEME_KEY = "ih_theme";

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    /* yoksay */
  }
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#0b0f1a" : "#f4f6fb");
}

applyTheme(initialTheme());

// Sistem tercihi degisse ve kullanici el degistirmemisce uyar.
window.matchMedia?.("(prefers-color-scheme: light)").addEventListener("change", (e) => {
  try {
    if (localStorage.getItem(THEME_KEY)) return; // kullanici tercihi one cikar
  } catch {
    /* yoksay */
  }
  applyTheme(e.matches ? "light" : "dark");
});

/* --------------------------- service worker -------------------------------- */
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  // BASE_URL: Vite build'inde VITE_BASE ile kontrol edilir (Pages'te /interviewhub/).
  // sw.js ve precache listesi de registration.scope uzerinden kendi bazini bulur.
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => {
        /* PWA desteklenmiyorsa sessizce gec */
      });
  });
}

// Not: StrictMode bilinçli olarak kapali - WebRTC baglantisi ve medya izleri
// gelistirme modunda iki kez calismasin.
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>,
);
