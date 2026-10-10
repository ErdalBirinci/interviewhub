import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Me } from "@ih/shared";
import { ApiFailure, api, getToken, post, setTabToken, setToken } from "./api";
import { translate } from "../i18n";

interface AuthValue {
  me: Me | null;
  loading: boolean;
  hasProfile: boolean;
  linkedinEnabled: boolean;
  demoEnabled: boolean;
  login: () => void;
  demoLogin: (name: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/** Eklenti ?token=... ile acildiginda token'i o sekmeye sakla ve URL'den temizle. */
export function absorbTokenFromUrl() {
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token");
    if (!token) return;
    setTabToken(token);
    url.searchParams.delete("token");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  } catch {
    /* yoksay */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [linkedinEnabled, setLinkedinEnabled] = useState(false);
  const [demoEnabled, setDemoEnabled] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: Me; hasProfile: boolean }>("/api/me");
      setMe(data.user);
      setHasProfile(Boolean(data.hasProfile));
    } catch (err) {
      setMe(null);
      setHasProfile(false);
      if (err instanceof ApiFailure && err.status === 401) {
        // Gecersiz/kipmis token: sil ki sonraki istek cookie oturumunu kullansin
        setToken(null);
      } else if (!(err instanceof ApiFailure) || err.status !== 0) {
        console.warn("[auth]", err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    absorbTokenFromUrl();
    void refresh();
    void (async () => {
      try {
        const cfg = await api<{ linkedinEnabled: boolean; demo: boolean }>("/api/config");
        setLinkedinEnabled(Boolean(cfg.linkedinEnabled));
        setDemoEnabled(Boolean(cfg.demo));
      } catch {
        /* yoksay */
      }
    })();
  }, [refresh]);

  const value = useMemo<AuthValue>(
    () => ({
      me,
      loading,
      hasProfile,
      linkedinEnabled,
      demoEnabled,
      login: () => {
        // Giris yapildiktan sonra kullanici bulundugu sayfaya donsun
        const here = window.location.pathname + window.location.search;
        const next = here && here !== "/" && !here.startsWith("/room/") ? here : "";
        window.location.href = next
          ? `/auth/linkedin?next=${encodeURIComponent(next)}`
          : "/auth/linkedin";
      },
      demoLogin: async (name: string) => {
        // 'include': cookie oturumu da yazilsin (token ile birlikte calisir)
        const data = await post<{ token: string }>(
          "/auth/demo",
          { name },
          { credentials: "include" },
        );
        if (data.token) setToken(data.token);
        await refresh();
      },
      logout: async () => {
        try {
          // 'include' olmadan tarayici, sunucunun Set-Cookie
          // (oturum cookie'ini silme) yanitini islemez ve
          // oturum cookie'si hayatta kalirdi.
          await api("/auth/logout", {
            method: "POST",
            credentials: "include",
          });
        } catch {
          // Sunucuya ulasilamasa bile yerel oturum mutlaka temizlenir
        } finally {
          setToken(null);
          setMe(null);
          setHasProfile(false);
        }
      },
      refresh,
    }),
    [me, loading, hasProfile, linkedinEnabled, demoEnabled, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error(translate("auth.ctxError"));
  return ctx;
}

export function hasSessionToken(): boolean {
  return Boolean(getToken());
}
