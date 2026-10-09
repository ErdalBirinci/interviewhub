import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { LinkedInProfile, Me, RoomMeta } from "@ih/shared";
import { CFG } from "./config";

interface DB {
  users: Record<string, Me>;
  profiles: Record<string, LinkedInProfile>;
  rooms: RoomMeta[];
}

let db: DB = { users: {}, profiles: {}, rooms: [] };
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  if (!fs.existsSync(CFG.DATA_FILE)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(CFG.DATA_FILE, "utf8")) as Partial<DB>;
    db = {
      users: raw.users ?? {},
      profiles: raw.profiles ?? {},
      rooms: Array.isArray(raw.rooms) ? raw.rooms : [],
    };
  } catch (err) {
    // Bozuk dosyayi uzerine yazma: yedekle, veri kaybini gorunur kil.
    const backup = `${CFG.DATA_FILE}.bozuk-${Date.now()}`;
    try {
      fs.renameSync(CFG.DATA_FILE, backup);
      console.error(`[store] veri dosyasi bozuk, yedeklendi -> ${backup}`, err);
    } catch (err2) {
      console.error("[store] veri dosyasi okunamadi ve yedeklenemedi:", err, err2);
    }
  }
}

/**
 * Atomik yazim: once gecici dosyaya yaz, sonra ad degistir.
 * Boylece yazim sirasinda cokulen sunucu db.json'i bozmaz.
 */
function persist() {
  try {
    const dir = path.dirname(CFG.DATA_FILE);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, `.${path.basename(CFG.DATA_FILE)}.${process.pid}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
    fs.renameSync(tmp, CFG.DATA_FILE);
  } catch (err) {
    console.error("[store] veri dosyasi yazilamadi:", err);
  }
}

export const store = {
  getUser(id: string): Me | null {
    load();
    return db.users[id] ?? null;
  },

  upsertUser(user: Me): Me {
    load();
    db.users[user.id] = { ...db.users[user.id], ...user };
    persist();
    return db.users[user.id];
  },

  getProfile(id: string): LinkedInProfile | null {
    load();
    return db.profiles[id] ?? null;
  },

  setProfile(id: string, profile: LinkedInProfile) {
    load();
    db.profiles[id] = profile;
    persist();
  },

  listRooms(): RoomMeta[] {
    load();
    return [...db.rooms].sort((a, b) => b.createdAt - a.createdAt);
  },

  getRoom(id: string): RoomMeta | null {
    load();
    return db.rooms.find((r) => r.id === id) ?? null;
  },

  createRoom(input: { title: string; hostId: string; hostName: string }): RoomMeta {
    load();
    // Oda id'si URL'de kullanilir; ayni id iki kez uretilmesin.
    let id = crypto.randomBytes(7).toString("base64url");
    while (db.rooms.some((r) => r.id === id)) id = crypto.randomBytes(7).toString("base64url");
    const room: RoomMeta = {
      id,
      title: input.title.trim().slice(0, 120) || "Gorusme odasi",
      hostId: input.hostId,
      hostName: input.hostName,
      createdAt: Date.now(),
    };
    db.rooms.unshift(room);
    // Eski odalarikirp - son 100 oda tutulur
    if (db.rooms.length > 100) db.rooms = db.rooms.slice(0, 100);
    persist();
    return room;
  },

  deleteRoom(id: string): boolean {
    load();
    const before = db.rooms.length;
    db.rooms = db.rooms.filter((r) => r.id !== id);
    if (db.rooms.length !== before) {
      persist();
      return true;
    }
    return false;
  },
};
