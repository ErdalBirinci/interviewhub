import type { ApiError } from "@ih/shared";
import { translate } from "../i18n";

export class ApiFailure extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiFailure";
    this.status = status;
  }
}

const TOKEN_KEY = "ih_token";
/** ?token=... ile acilan sayfalar (eklenti iframesi) icin - yalnizca o sekmede kalir */
const TAB_TOKEN_KEY = "ih_token_tab";

/**
 * Once o sekmeye ozel token'a, sonra kalici token'a bakar.
 * Boylece eklenti cercevesindeki oturum, normal tarayici sekmelerini etkilemez.
 */
export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TAB_TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(TAB_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TAB_TOKEN_KEY);
    }
  } catch {
    /* storage kapali olabilir */
  }
}

/** Yalnizca bu sekmede gecerli oturum token'i saklar. */
export function setTabToken(token: string) {
  try {
    sessionStorage.setItem(TAB_TOKEN_KEY, token);
  } catch {
    /* yoksay */
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers,
      // Token varsa cookie gonderilmez (sekme token'i oncelikli olur).
      // Dikkat: 'omit' modunda tarayici yanitin Set-Cookie'ini de
      // goz ardi eder - bu yuzden cikis gibi cookie yazan istekler
      // 'include' ile acik belirtilmelidir.
      credentials: init.credentials ?? (token ? "omit" : "include"),
    });
  } catch {
    throw new ApiFailure(translate("errors.network"), 0);
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* HTML hata sayfasi */
  }

  if (!res.ok) {
    const message =
      (data as { error?: string } | null)?.error ?? `translate("errors.requestFailed", { status: res.status })`;
    throw new ApiFailure(message, res.status);
  }
  return data as T;
}

export const post = <T = unknown>(path: string, body?: unknown, init: RequestInit = {}) =>
  api<T>(path, { ...init, method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const put = <T = unknown>(path: string, body: unknown) =>
  api<T>(path, { method: "PUT", body: JSON.stringify(body) });

export const del = <T = unknown>(path: string) => api<T>(path, { method: "DELETE" });
