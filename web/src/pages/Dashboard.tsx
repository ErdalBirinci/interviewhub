import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { RoomView } from "@ih/shared";
import LoginCard from "../components/LoginCard";
import { VideoIcon, PlusIcon } from "../components/icons";
import { api, del, post } from "../lib/api";
import { useAuth } from "../lib/auth";

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
      setError("Panoya kopyalanamadı. Bağlantı: " + url);
    }
  };

  const remove = async (room: RoomView) => {
    if (!window.confirm(`"${room.title}" odası silinsin mi?`)) return;
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
          title="Görüşme odalarınızı oluşturun"
          note="LinkedIn kimliğinizle giriş yapın; odalarınıza ve profilinize erişin."
        />
      </div>
    );
  }

  return (
    <main className="page">
      <header className="page__head">
        <div>
          <p className="eyebrow">Panel</p>
          <h1>Görüşmeler</h1>
        </div>
        <Link className="btn btn--ghost" to="/profile">
          {hasProfile ? "Profilimi düzenle" : "Profilimi oluştur →"}
        </Link>
      </header>

      {!hasProfile && (
        <div className="banner">
          <strong>Profiliniz henüz hazır değil.</strong>
          <span>
            Görüşmede görünecek LinkedIn bilgilerinizi girmek için{" "}
            <Link to="/profile">profil sayfasını</Link> açın. Aday da kendi profiliyle katılır.
          </span>
        </div>
      )}

      <section className="card create">
        <h2>Yeni görüşme odası</h2>
        <form onSubmit={create} className="create__form">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Örn. Kıdemli Frontend Developer · Aday görüşmesi"
            maxLength={120}
          />
          <button className="btn btn--primary" type="submit" disabled={busy || !title.trim()}>
            {busy ? "Oluşturuluyor…" : "Oda oluştur"}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
        <p className="hint">
          Oluşturulan bağlantıyı adaya LinkedIn üzerinden iletin. Aday, kabul edilmiş başvurusunun
          olduğu konuşmadan linke tıklayıp kendi profiliyle katılır.
        </p>
      </section>

      <section className="rooms">
        <h2>Odalarınız</h2>
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
            <p className="empty__title">Henüz görüşme odası yok</p>
            <p className="empty__hint">
              Yukarıdan ilk odanızı oluşturun; bağlantıyı adaya LinkedIn üzerinden iletin.
            </p>
          </div>
        )}

        <ul className="room-list">
          {rooms.map((room) => (
            <li key={room.id} className="card room-item">
              <div className="room-item__main">
                <h3>{room.title}</h3>
                <p className="muted">
                  {new Date(room.createdAt).toLocaleString("tr-TR")} ·{" "}
                  <span className={room.active > 0 ? "live" : ""}>
                    {room.active > 0 ? `● ${room.active} kişi çevrimiçi` : "boş"}
                  </span>
                </p>
                <code className="room-item__url">
                  {window.location.origin}/room/{room.id}
                </code>
              </div>
              <div className="room-item__actions">
                <Link className="btn btn--primary btn--sm" to={`/room/${room.id}`}>
                  Odaya gir
                </Link>
                <button className="btn btn--secondary btn--sm" onClick={() => void copy(room)}>
                  {copiedId === room.id ? "Kopyalandı ✓" : "Bağlantıyı kopyala"}
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => void remove(room)}>
                  Sil
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card ext-card">
        <div>
          <h2>Chrome eklentisi</h2>
          <p className="muted">
            LinkedIn'deyken tek tıkla oda açmak için <code>extension/dist</code> klasörünü
            <code> chrome://extensions</code> üzerinden "Paketi olmayan eklenti" olarak yükleyin.
          </p>
        </div>
        <span className="tag">Manifest V3</span>
      </section>
    </main>
  );
}
