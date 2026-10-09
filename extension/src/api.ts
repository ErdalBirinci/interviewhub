/** Eklentinin konusacagi InterviewHub sunucusu. */

export const DEFAULT_API_BASE = "http://localhost:4000";

const API_KEY = "apiBase";
const TOKEN_KEY = "token";

export async function getApiBase(): Promise<string> {
  const data = await chrome.storage.local.get(API_KEY);
  const value = data[API_KEY];
  return typeof value === "string" && value.trim() ? value.trim().replace(/\/+$/, "") : DEFAULT_API_BASE;
}

export async function setApiBase(value: string) {
  await chrome.storage.local.set({ [API_KEY]: value.trim().replace(/\/+$/, "") });
}

export async function getToken(): Promise<string | null> {
  const data = await chrome.storage.local.get(TOKEN_KEY);
  const value = data[TOKEN_KEY];
  return typeof value === "string" && value ? value : null;
}

export async function setToken(value: string | null) {
  if (value) await chrome.storage.local.set({ [TOKEN_KEY]: value });
  else await chrome.storage.local.remove(TOKEN_KEY);
}

export class ApiFailure extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Sunucuyla konusur; token varsa Bearer olarak gonderir. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const [base, token] = await Promise.all([getApiBase(), getToken()]);
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { ...init, headers });
  } catch {
    throw new ApiFailure(`Sunucuya ulaşılamıyor (${base}).`, 0);
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* HTML olabilir */
  }

  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error ?? `İstek başarısız (${res.status})`;
    throw new ApiFailure(message, res.status);
  }
  return data as T;
}
