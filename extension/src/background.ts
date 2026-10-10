import { apiFetch, getApiBase, getToken, setApiBase, setToken } from "./api";
import { loadLang, t } from "./i18n";
import type { Me } from "@ih/shared";

interface StateResponse {
  token: string | null;
  apiBase: string;
  /** Oda baglantilarinin kurulacagi arayuz adresi (sunucudan) */
  webUrl?: string;
  user: Me | null;
  error?: string;
}

/** Mesaj isleyicileri dil yuklendikten sonra calisir; boylece hata metinleri dogru dilde olur. */
function withLang<T>(fn: () => Promise<T>): Promise<T> {
  return loadLang().then(fn);
}

/** Sunucunun bildirdigi arayuz adresi (gelistirme/uretim farkini kapatir). */
async function readWebUrl(apiBase: string): Promise<string> {
  try {
    const res = await fetch(`${apiBase}/api/config`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return "";
    const data = (await res.json()) as { webUrl?: unknown };
    return typeof data.webUrl === "string" ? data.webUrl.replace(/\/+$/, "") : "";
  } catch {
    return "";
  }
}

/** LinkedIn OAuth akisi Chrome'un chromiumapp.org adresine doner. */
async function startAuth(): Promise<string> {
  const apiBase = await getApiBase();
  const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org/provider_cb`;
  const url = `${apiBase}/auth/extension?redirect_uri=${encodeURIComponent(redirectUri)}`;

  const finalUrl = await chrome.identity.launchWebAuthFlow({ url, interactive: true });
  if (!finalUrl) throw new Error(t("auth.cancelled"));

  const token = new URL(finalUrl).searchParams.get("token");
  if (!token) throw new Error(`${t("auth.noToken", { uri: redirectUri })}`);

  await setToken(token);
  return token;
}

async function readState(): Promise<StateResponse> {
  const [token, apiBase] = await Promise.all([getToken(), getApiBase()]);
  const webUrl = await readWebUrl(apiBase);
  if (!token) return { token: null, apiBase, webUrl, user: null };
  try {
    const data = await apiFetch<{ user: Me }>("/api/me");
    return { token, apiBase, webUrl, user: data.user };
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 401) await setToken(null);
    return { token: status === 401 ? null : token, apiBase, webUrl, user: null };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = (message as { type?: string } | undefined)?.type;

  if (type === "open-panel") {
    const tabId = sender.tab?.id;
    if (tabId === undefined) {
      sendResponse({ ok: false });
      return false;
    }
    chrome.sidePanel
      .open({ tabId })
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  if (type === "auth") {
    withLang(() => startAuth())
      .then(async () => sendResponse(await readState()))
      .catch((err: Error) => sendResponse({ error: err.message }));
    return true;
  }

  if (type === "state") {
    void readState()
      .then(sendResponse)
      .catch(() => sendResponse(null));
    return true;
  }

  if (type === "logout") {
    void setToken(null)
      .then(async () => sendResponse(await readState()))
      .catch(() => sendResponse(null));
    return true;
  }

  if (type === "set-api-base") {
    const value = (message as { value?: string }).value ?? "";
    void setApiBase(value)
      .then(async () => sendResponse(await readState()))
      .catch(() => sendResponse(null));
    return true;
  }

  if (type === "demo-auth") {
    const requested = (message as { name?: string }).name;
    void withLang(async () => {
      const name = requested?.trim() || t("auth.demoFallback");
      const base = await getApiBase();
      const res = await fetch(`${base}/auth/demo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(t("auth.failed"));
      const data = (await res.json()) as { token?: string };
      if (data.token) await setToken(data.token);
      return readState();
    })
      .then(sendResponse)
      .catch((err: Error) => sendResponse({ error: err.message }));
    return true;
  }

  return false;
});
