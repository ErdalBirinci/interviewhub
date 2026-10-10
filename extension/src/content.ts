/**
 * LinkedIn sayfasina sabit bir "Gorusme Odasi" dugmesi ekler.
 * Profil verisi okumaz - bilincli olarak sadece bir kisidir; toplu veri
 * LinkedIn hizmet sartlarina aykiri oldugu icin yapilmaz.
 */

import { loadLang, t } from "./i18n";

const HOST_ID = "interviewhub-host";

const STYLES = `
:host { all: initial; }
.fab {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 2147483000;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 15px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #4f8cff, #7c5cff);
  color: #fff;
  font: 600 13px/1 "Segoe UI", system-ui, sans-serif;
  letter-spacing: .01em;
  cursor: pointer;
  box-shadow: 0 12px 30px rgba(0,0,0,.35);
  transition: transform .12s ease, filter .15s ease;
}
.fab:hover { filter: brightness(1.1); transform: translateY(-1px); }
.fab:active { transform: translateY(0); }
.fab__dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #2ecc71; box-shadow: 0 0 0 3px rgba(46,204,113,.25);
}
.toast {
  position: fixed;
  right: 18px;
  bottom: 74px;
  z-index: 2147483001;
  max-width: 280px;
  padding: 10px 13px;
  border-radius: 10px;
  background: #121a2a;
  border: 1px solid #2b3654;
  color: #e7edf8;
  font: 500 12.5px/1.45 "Segoe UI", system-ui, sans-serif;
  box-shadow: 0 14px 34px rgba(0,0,0,.45);
  opacity: 0;
  transform: translateY(6px);
  transition: opacity .2s ease, transform .2s ease;
}
.toast.show { opacity: 1; transform: translateY(0); }
`;

function ensureHost(): ShadowRoot | null {
  if (document.getElementById(HOST_ID)) return null;
  const host = document.createElement("div");
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = STYLES;
  shadow.appendChild(style);

  const button = document.createElement("button");
  button.className = "fab";
  button.type = "button";
  applyFabLabel(button);
  shadow.appendChild(button);

  const toast = document.createElement("div");
  toast.className = "toast";
  shadow.appendChild(toast);

  let toastTimer: number | undefined;
  const showToast = (text: string) => {
    toast.textContent = text;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 3500);
  };

  button.addEventListener("click", () => {
    button.disabled = true;
    chrome.runtime.sendMessage({ type: "open-panel" }, (response) => {
      button.disabled = false;
      // lastError'i okumazsak "Unchecked runtime.lastError" uyarisi verilir
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        showToast(t("toast.panelFailed"));
        return;
      }
      if (!response) {
        showToast(t("toast.refresh"));
        return;
      }
      const result = response as { ok?: boolean; error?: string };
      if (result.ok === false || result.error) {
        showToast(result.error ?? t("toast.refresh"));
      }
    });
  });

  document.documentElement.appendChild(host);
  return shadow;
}

/** Dugmenin etiketini mevcut dile gore yazar. */
function applyFabLabel(button: HTMLButtonElement): void {
  const label = t("fab.button");
  button.title = `InterviewHub — ${label}`;
  button.innerHTML = `<span class="fab__dot"></span> ${label}`;
}

ensureHost();

// Dil once varsayilan (EN) ile gorunur; kayitli tercih okunduktan sonra guncellenir.
void loadLang().then(() => {
  const host = document.getElementById(HOST_ID);
  const button = host?.shadowRoot?.querySelector<HTMLButtonElement>("button.fab");
  if (button) applyFabLabel(button);
});
