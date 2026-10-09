import { CFG } from "./config";

const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

export interface LinkedInUserInfo {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email?: string;
}

const SCOPES = "openid profile email";

export function buildAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CFG.LINKEDIN_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function postForm<T>(url: string, body: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LinkedIn token hatasi (${res.status}): ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<{ access_token: string; expires_in?: number }> {
  return postForm(TOKEN_URL, {
    grant_type: "authorization_code",
    code,
    client_id: CFG.LINKEDIN_CLIENT_ID,
    client_secret: CFG.LINKEDIN_CLIENT_SECRET,
    redirect_uri: redirectUri,
  });
}

export async function fetchUserInfo(accessToken: string): Promise<LinkedInUserInfo> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LinkedIn userinfo hatasi (${res.status}): ${text.slice(0, 300)}`);
  }
  return (await res.json()) as LinkedInUserInfo;
}
