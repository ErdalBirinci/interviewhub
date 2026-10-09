import type { Me, RoomView } from "@ih/shared";
import { apiFetch } from "./api";

interface StateResponse {
  token: string | null;
  apiBase: string;
  /** Oda baglantilarinin kurulacagi arayuz adresi (sunucudan gelir) */
  webUrl?: string;
  user: Me | null;
  error?: string;
}

const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;

/**
 * Service worker'a mesaj gonderir. Cevap gelmezse (SW uyumadi/guncellendi)
 * sonsuza kadar beklemez; 8 sn sonra null doner.
 */
function send<T>(message: Record<string, unknown>): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: T | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), 8000);
    try {
      chrome.runtime.sendMessage(message, (response: T) => {
        const err = chrome.runtime.lastError;
        if (err) {
          console.warn("[ih] mesaj hatasi:", err.message);
          finish(null);
          return;
        }
        finish(response ?? null);
      });
    } catch {
      // Calisma baglami kapandi (eklenti guncellendi/yeniden yuklendi)
      finish(null);
    }
  });
}

const state: StateResponse = { token: null, apiBase: "", user: null };
let rooms: RoomView[] = [];
let embedRoom: RoomView | null = null;
let busy = false;

/** Eklenti service worker'la konusulamiyorsa kullanilacak mesaj */
const COMM_ERROR = "Eklentiyle iletişim kurulamadı. Paneli kapatıp yeniden açın.";

function setError(where: "auth" | "main", message?: string) {
  const node = el(where === "auth" ? "auth-error" : "main-error");
  node.textContent = message ?? "";
  node.classList.toggle("hidden", !message);
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/* --------------------------------- cizim --------------------------------- */

function render() {
  const authed = Boolean(state.user);
  el("view-auth").classList.toggle("hidden", authed);
  el("view-main").classList.toggle("hidden", !authed);
  if (state.user) el("user-name").textContent = state.user.name;

  const apiInput = el<HTMLInputElement>("api-base");
  if (document.activeElement !== apiInput) apiInput.value = state.apiBase;

  renderRooms();
  renderEmbed();
}

function renderRooms() {
  const list = el("room-list");
  list.replaceChildren();

  el("empty").classList.toggle("hidden", rooms.length > 0);

  for (const room of rooms) {
    const li = document.createElement("li");
    li.className = "room";
    li.dataset.id = room.id;

    const title = document.createElement("div");
    title.className = "room__title";
    title.textContent = room.title;

    const meta = document.createElement("div");
    meta.className = "room__meta";
    const date = new Date(room.createdAt).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    meta.textContent = `${date} · `;
    const live = document.createElement("span");
    live.className = room.active > 0 ? "live" : "";
    live.textContent = room.active > 0 ? `● ${room.active} kişi çevrimiçi` : "boş";
    meta.appendChild(live);

    const actions = document.createElement("div");
    actions.className = "room__actions";

    const openBtn = button("Görüşmeye gir", "open", "btn primary");
    const copyBtn = button("Bağlantı", "copy", "btn");
    const delBtn = button("Sil", "delete", "btn ghost danger");
    actions.append(openBtn, copyBtn, delBtn);

    li.append(title, meta, actions);
    list.appendChild(li);
  }
}

function button(label: string, action: string, className: string) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = className;
  node.dataset.act = action;
  node.textContent = label;
  return node;
}

function renderEmbed() {
  const wrap = el("embed-wrap");
  const frame = el<HTMLIFrameElement>("embed");
  wrap.classList.toggle("hidden", !embedRoom);

  if (!embedRoom) {
    frame.src = "about:blank";
    return;
  }

  el("embed-title").textContent = embedRoom.title;
  const url = roomUrl(embedRoom.id, true);
  if (frame.src !== url) frame.src = url;
}

/** token yalnizca kendi uygulamanizin origin'ine gider ( ?token=... ) */
function roomUrl(id: string, withToken: boolean): string {
  // Sunucunun soyledigi arayuz adresi varsa onu kullan (gelistirme/uretim farki)
  const base = `${state.webUrl?.trim() || state.apiBase}/room/${id}`;
  return withToken && state.token
    ? `${base}?token=${encodeURIComponent(state.token)}`
    : base;
}

/* ------------------------------- veri yukleme ----------------------------- */

async function loadState() {
  const next = await send<StateResponse>({ type: "state" });
  if (next) Object.assign(state, next);
  render();
}

async function loadRooms() {
  if (!state.user) {
    rooms = [];
    renderRooms();
    return;
  }
  try {
    const data = await apiFetch<{ rooms: RoomView[] }>("/api/me/rooms");
    rooms = data.rooms ?? [];
    setError("main");
  } catch (err) {
    setError("main", messageOf(err));
  }
  renderRooms();
}

async function createRoom() {
  const input = el<HTMLInputElement>("room-title");
  const title = input.value.trim();
  if (!title || busy) return;

  const btn = el<HTMLButtonElement>("btn-create");
  busy = true;
  btn.disabled = true;
  btn.textContent = "Oluşturuluyor…";

  try {
    const data = await apiFetch<{ room: RoomView }>("/api/rooms", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    rooms.unshift(data.room);
    input.value = "";
    setError("main");
    embedRoom = data.room;
    render();
  } catch (err) {
    setError("main", messageOf(err));
  } finally {
    busy = false;
    btn.disabled = false;
    btn.textContent = "Oda oluştur";
  }
}

async function copyText(text: string, btn: HTMLButtonElement, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    const original = btn.textContent;
    btn.textContent = done;
    setTimeout(() => {
      btn.textContent = original;
    }, 1600);
  } catch {
    setError("main", "Panoya kopyalanamadı: " + text);
  }
}

/* --------------------------------- olaylar -------------------------------- */

function wire() {
  el("btn-auth").addEventListener("click", async () => {
    const btn = el<HTMLButtonElement>("btn-auth");
    btn.disabled = true;
    btn.textContent = "LinkedIn sayfası açılıyor…";
    try {
      const res = await send<StateResponse>({ type: "auth" });
      if (!res) {
        setError("auth", COMM_ERROR);
      } else if (res.error) {
        setError("auth", res.error);
      } else {
        Object.assign(state, res);
        setError("auth");
        render();
        await loadRooms();
      }
    } finally {
      btn.disabled = false;
      btn.textContent = "LinkedIn ile giriş";
    }
  });

  el("btn-demo").addEventListener("click", async () => {
    const name = el<HTMLInputElement>("demo-name").value.trim() || "Demo Kullanıcı";
    const res = await send<StateResponse>({ type: "demo-auth", name });
    if (!res) {
      setError("auth", COMM_ERROR);
      return;
    }
    if (res.error) {
      setError("auth", res.error);
      return;
    }
    Object.assign(state, res);
    setError("auth");
    render();
    await loadRooms();
  });

  el("btn-logout").addEventListener("click", async () => {
    const res = await send<StateResponse>({ type: "logout" });
    if (res) Object.assign(state, res);
    else setError("main", COMM_ERROR);
    embedRoom = null;
    rooms = [];
    render();
  });

  el("refresh").addEventListener("click", async () => {
    await loadState();
    await loadRooms();
  });

  el("btn-create").addEventListener("click", () => void createRoom());
  el("room-title").addEventListener("keydown", (e) => {
    if (e.key === "Enter") void createRoom();
  });

  el("room-list").addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLElement>("[data-act]")?.dataset.act;
    const item = target.closest<HTMLElement>("li[data-id]");
    if (!action || !item) return;
    const room = rooms.find((r) => r.id === item.dataset.id);
    if (!room) return;

    if (action === "open") {
      embedRoom = room;
      render();
    } else if (action === "copy") {
      void copyText(roomUrl(room.id, false), target as HTMLButtonElement, "Kopyalandı ✓");
    } else if (action === "delete") {
      if (!window.confirm(`"${room.title}" silinsin mi?`)) return;
      void apiFetch(`/api/rooms/${room.id}`, { method: "DELETE" })
        .then(() => {
          rooms = rooms.filter((r) => r.id !== room.id);
          if (embedRoom?.id === room.id) embedRoom = null;
          render();
        })
        .catch((err: unknown) => setError("main", messageOf(err)));
    }
  });

  el("btn-close-embed").addEventListener("click", () => {
    embedRoom = null;
    render();
  });

  el("btn-open-tab").addEventListener("click", () => {
    if (embedRoom) chrome.tabs.create({ url: roomUrl(embedRoom.id, true) });
  });

  el("btn-copy-invite").addEventListener("click", (event) => {
    if (!embedRoom) return;
    void copyText(
      roomUrl(embedRoom.id, false),
      event.currentTarget as HTMLButtonElement,
      "Kopyalandı ✓",
    );
  });

  el("btn-api").addEventListener("click", async () => {
    const value = el<HTMLInputElement>("api-base").value.trim();
    const res = await send<StateResponse>({ type: "set-api-base", value });
    if (!res) {
      el("api-hint").textContent = COMM_ERROR;
      return;
    }
    Object.assign(state, res);
    el("api-hint").textContent = "Kaydedildi.";
    render();
    await loadRooms();
  });
}

async function init() {
  wire();
  await loadState();
  await loadRooms();
}

void init();
