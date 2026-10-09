import crypto from "node:crypto";
import { Server, type Socket } from "socket.io";
import type { Server as HttpServer } from "node:http";
import {
  EV,
  normalizeProfile,
  type ChatMessage,
  type JoinAck,
  type JoinPayload,
  type MediaStatePayload,
  type PeerInfo,
  type RTCSignal,
} from "@ih/shared";
import { tokenFromHeaders, verify, type Session } from "./auth";
import { store } from "./store";

interface LiveRoom {
  id: string;
  peers: Map<string, PeerInfo>;
  chat: ChatMessage[];
}

const liveRooms = new Map<string, LiveRoom>();

function getLive(roomId: string): LiveRoom {
  let room = liveRooms.get(roomId);
  if (!room) {
    room = { id: roomId, peers: new Map(), chat: [] };
    liveRooms.set(roomId, room);
  }
  return room;
}

/** O an odada kac kisi var? (REST icin) */
export function activeCount(roomId: string): number {
  return liveRooms.get(roomId)?.peers.size ?? 0;
}

export function activeCounts(ids: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of ids) out[id] = activeCount(id);
  return out;
}

/** Socket.IO handshake'inde saklanan veriler (varsayilan generic: any) */

/** Canli oda kanal adi */
const roomChannel = (roomId: string) => `room:${roomId}`;

export function createIo(http: HttpServer) {
  const io = new Server(http, {
    cors: { origin: true, credentials: true },
    serveClient: false,
  });

  io.use((socket, next) => {
    const raw =
      (socket.handshake.auth as { token?: string } | undefined)?.token ??
      tokenFromHeaders(socket.handshake.headers as Record<string, unknown>);
    const session = verify<Session>(raw);
    if (!session?.sub) return next(new Error("unauthorized"));
    socket.data.session = session;
    next();
  });

  io.on("connection", (socket) => {
    const session = socket.data.session as Session;

    socket.on(EV.JOIN, (payload: JoinPayload, ack: (a: JoinAck) => void) => {
      const roomId = typeof payload?.roomId === "string" ? payload.roomId : "";
      const room = store.getRoom(roomId);
      if (!room) {
        ack({ ok: false, error: "Oda bulunamadi. Baglanti gecersiz olabilir." });
        return;
      }

      const live = getLive(roomId);

      // Onceki bir odadan cik
      if (socket.data.roomId && socket.data.roomId !== roomId) {
        leaveCurrent(socket, io);
      }

      const profileRaw = store.getProfile(session.sub);
      // Eski/eksik kayitlarda dizi alanlari null olabilir - once normallestir
      const profile = profileRaw?.shareProfile ? normalizeProfile(profileRaw) : null;
      const name =
        (typeof payload?.name === "string" && payload.name.trim()
          ? payload.name.trim()
          : session.name || "Misafir"
        ).slice(0, 60);

      const peer: PeerInfo = {
        id: socket.id,
        name,
        role: room.hostId === session.sub ? "host" : "guest",
        mic: true,
        cam: true,
        screen: false,
        headline: profile?.headline || undefined,
        profile,
      };

      const channel = roomChannel(roomId);
      const existing = [...live.peers.values()].map((p) => ({ ...p }));

      live.peers.set(socket.id, peer);
      socket.data.roomId = roomId;
      socket.join(channel);

      ack({
        ok: true,
        selfId: socket.id,
        self: { ...peer },
        peers: existing,
        chat: live.chat.slice(-200),
      });

      socket.to(channel).emit(EV.PEER_JOINED, { peer });
    });

    socket.on(EV.MEDIA, (state: Omit<MediaStatePayload, "peerId">) => {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      const live = liveRooms.get(roomId);
      const peer = live?.peers.get(socket.id);
      if (!peer) return;
      peer.mic = Boolean(state?.mic);
      peer.cam = Boolean(state?.cam);
      peer.screen = Boolean(state?.screen);
      socket.to(roomChannel(roomId)).emit(EV.MEDIA, { peerId: socket.id, ...peer });
    });

    socket.on(EV.SIGNAL, (payload: { to: string; signal: RTCSignal }) => {
      const roomId = socket.data.roomId;
      if (!roomId || !payload?.to || !payload?.signal) return;
      const live = liveRooms.get(roomId);
      if (!live?.peers.has(payload.to)) return;
      const target = io.sockets.sockets.get(payload.to);
      if (!target) return;
      target.emit(EV.SIGNAL, { from: socket.id, signal: payload.signal });
    });

    socket.on(EV.CHAT_SEND, (payload: { text: string }) => {
      const roomId = socket.data.roomId;
      const text = typeof payload?.text === "string" ? payload.text.trim().slice(0, 2000) : "";
      if (!roomId || !text) return;
      const live = liveRooms.get(roomId);
      if (!live) return;
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        from: socket.id,
        fromName: live.peers.get(socket.id)?.name ?? session.name ?? "Misafir",
        text,
        ts: Date.now(),
      };
      live.chat.push(message);
      if (live.chat.length > 200) live.chat = live.chat.slice(-200);
      io.to(roomChannel(roomId)).emit(EV.CHAT_MESSAGE, { message });
    });

    socket.on("disconnect", () => leaveCurrent(socket, io));
  });

  function leaveCurrent(socket: Socket, ioServer: Server) {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.data.roomId = undefined;
    socket.leave(roomChannel(roomId));
    const live = liveRooms.get(roomId);
    if (!live) return;
    live.peers.delete(socket.id);
    socket.to(roomChannel(roomId)).emit(EV.PEER_LEFT, { peerId: socket.id });
    if (live.peers.size === 0) {
      // Oda bosaldi - canli kayittan sil (metadata disk'te durur)
      liveRooms.delete(roomId);
    }
  }

  return io;
}
