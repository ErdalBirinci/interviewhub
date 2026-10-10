import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { RoomView } from "@ih/shared";
import LoginCard from "../components/LoginCard";
import { VideoIcon, PlusIcon } from "../components/icons";
import { api, del, post } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useTranslation } from "../i18n/useTranslation";

/** Oda listesi yüklenirken gösterilen iskelet kartı */
function RoomSkeleton() {
  return (
    <li className="card room-item room-item--skeleton" aria-hidden="true">
      <div className="room-item__main">
        <div className="skeleton skeleton--title" />
        <div className="skeleton skeleton--text" style={{ width: "45%" }} />
        <div className="skeleton skeleton--text" style={{ width: "70%" }} />
      </div>
      <div className="room-item__actions">
        <div className="skeleton skeleton--button" />
        <div className="skeleton skeleton--button" style={{ width: "110px" }} />
      </div>
    </li>
  );
}

export default function Dashboard() {
  const { me, loading, refresh, hasProfile } = useAuth();
  const { t, i18n } = useTranslation();
  const [rooms, setRooms] = useState<RoomView[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ rooms: RoomView[] }>("/api/me/rooms");
      setRooms(data.rooms);
      setListError(null);
    } catch (err) {
      setListError((err as Error).message);
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    if (!me) return;
    void load();
    // "kac kisi cevrimici" bilgisi bayatlamasin (gorunurken yenilenir)
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 20000);
    return () => window.clearInterval(timer);
  }, [me, load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await post("/api/rooms", { title: title.trim() });
      setTitle("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (room: RoomView) => {
    const url = `${window.location.origin}/room/${room.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(room.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setError(t("dashboard.copyFailed") + url);
    }
  };

  const remove = async (room: RoomView) => {
    if (!window.confirm(t("dashboard.confirmDelete", { title: room.title }))) return;
    try {
      await del(`/api/rooms/${room.id}`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="center-screen">
        <LoginCard
          title={t("dashboard.createLoginTitle")}
          note={t("dashboard.createLoginNote")}
        />
      </div>
    );
  }

  return (
    <main className="page">
      <header className="page__head">
        <div>
          <p className="eyebrow">{t("dashboard.eyebrow")}</p>
          <h1>{t("dashboard.title")}</h1>
        </div>
        <Link className="btn btn--ghost" to="/profile">
          {hasProfile ? t("dashboard.editProfile") : t("dashboard.createProfile")}
        </Link>
      </header>

      {!hasProfile && (
        <div className="banner">
          <strong>{t("dashboard.bannerTitle")}</strong>
          <span>
            {t("dashboard.bannerText")}
          </span>
        </div>
      )}

      <section className="card create">
        <h2>{t("dashboard.newRoom")}</h2>
        <form onSubmit={create} className="create__form">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("dashboard.roomTitlePlaceholder")}
            maxLength={120}
            aria-label={t("dashboard.roomTitle")}
          />
          <button className="btn btn--primary" type="submit" disabled={busy || !title.trim()}>
            {busy ? t("dashboard.creating") : t("dashboard.create")}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
        <p className="hint">{t("dashboard.hint")}</p>
      </section>

      <section className="rooms">
        <h2>{t("dashboard.roomsTitle")}</h2>
        {listError && <p className="error">{listError}</p>}
        {!listError && loadingRooms && (
          <ul className="room-list">
            <RoomSkeleton />
            <RoomSkeleton />
          </ul>
        )}
        {!listError && !loadingRooms && rooms.length === 0 && (
          <div className="empty">
            <span className="empty__icon"><VideoIcon size={26} /></span>
            <p className="empty__title">{t("dashboard.emptyTitle")}</p>
            <p className="empty__hint">{t("dashboard.emptyHint")}</p>
          </div>
        )}

        <ul className="room-list">
          {rooms.map((room) => (
            <li key={room.id} className="card room-item">
              <div className="room-item__main">
                <h3>{room.title}</h3>
                <p className="muted">
                  {new Date(room.createdAt).toLocaleString(i18n.language)} ·{" "}
                  <span className={room.active > 0 ? "live" : ""}>
                    {room.active > 0 ? t("dashboard.liveOnline", { count: room.active }) : t("dashboard.emptyRoom")}
                  </span>
                </p>
                <code className="room-item__url">
                  {window.location.origin}/room/{room.id}
                </code>
              </div>
              <div className="room-item__actions">
                <Link className="btn btn--primary btn--sm" to={`/room/${room.id}`}>
                  {t("dashboard.join")}
                </Link>
                <button className="btn btn--secondary btn--sm" onClick={() => void copy(room)}>
                  {copiedId === room.id ? t("dashboard.copied") : t("dashboard.copyLink")}
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => void remove(room)}>
                  {t("dashboard.delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card ext-card">
        <div>
          <h2>{t("dashboard.extensionTitle")}</h2>
          <p className="muted">{t("dashboard.extensionHint")}</p>
        </div>
        <span className="tag">{t("dashboard.manifestV3")}</span>
      </section>
    </main>
  );
}
