import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  EV,
  type ChatMessage,
  type ChatMessagePayload,
  type IceServerLike,
  type JoinAck,
  type MediaStatePayload,
  type PeerInfo,
  type PeerJoinedPayload,
  type PeerLeftPayload,
  type RTCSignal,
  type SignalPayload,
} from "@ih/shared";
import { getToken } from "../lib/api";
import { translate } from "../i18n";

export type RoomStatus = "idle" | "connecting" | "joined" | "left" | "error";

/** Gelistirme loglari: ?debug=1 ile aktiflesir. */
const DEBUG = typeof location !== "undefined" && /[?&]debug=1/.test(location.search);
const log = (...args: unknown[]) => {
  if (DEBUG) console.debug("[ih]", ...args);
};

export interface MediaFlags {
  mic: boolean;
  cam: boolean;
  screen: boolean;
}

export interface PeerRT {
  info: PeerInfo;
  pc: RTCPeerConnection;
  stream: MediaStream;
  /** Perfect negotiation: kaba ses veren taraf (id karsilastirmasi) */
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  settingRemoteAnswer: boolean;
  pendingIce: RTCIceCandidateInit[];
  /** Olusturulan/kabul edilen veri kanalinin durumu (tanilama) */
  dcState: string;
}

interface UseRoomOptions {
  roomId: string;
  name: string;
  localStream: MediaStream | null;
  iceServers: IceServerLike[];
}

/**
 * WebRTC odasi (mesh, perfect negotiation).
 * Yeni katilan ve mevcut katilimcilarin ikisi de teklif uretebilir;
 * politik/impolitik roller id karsilastirmasiyla belirlenir.
 */
export function useRoom(options: UseRoomOptions) {
  const { roomId, localStream, iceServers } = options;

  const [status, setStatus] = useState<RoomStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [media, setMediaState] = useState<MediaFlags>({ mic: true, cam: true, screen: false });
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [selfInfo, setSelfInfo] = useState<PeerInfo | null>(null);
  const [, bump] = useReducer((x: number) => x + 1, 0);

  const peersRef = useRef(new Map<string, PeerRT>());
  const socketRef = useRef<Socket | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const mediaRef = useRef<MediaFlags>({ mic: true, cam: true, screen: false });
  const nameRef = useRef(options.name);
  const selfIdRef = useRef<string | null>(null);
  const iceRef = useRef<IceServerLike[]>(iceServers);
  const joinedRef = useRef(false);
  const stopScreenRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    nameRef.current = options.name;
  }, [options.name]);

  useEffect(() => {
    iceRef.current = iceServers;
    // Sonradan gelen ICE listesi mevcut baglantilara da uygulansin
    // (orn. TURN sunucusu ilk yuklemeden sonra eklendiyse).
    for (const peer of peersRef.current.values()) {
      try {
        peer.pc.setConfiguration({ iceServers: iceServers as RTCIceServer[] });
      } catch {
        /* yoksay */
      }
    }
  }, [iceServers]);

  /* ----------------------------- yardimcilar ----------------------------- */

  const signalTo = useCallback((to: string, signal: RTCSignal) => {
    socketRef.current?.emit(EV.SIGNAL, { to, signal });
  }, []);

  const flushIce = async (peer: PeerRT) => {
    if (!peer.pendingIce.length) return;
    const queue = peer.pendingIce.splice(0, peer.pendingIce.length);
    for (const candidate of queue) {
      try {
        await peer.pc.addIceCandidate(candidate);
      } catch (err) {
        if (!peer.ignoreOffer) console.warn("[ice-flush]", err);
      }
    }
  };

  const handleSignal = useCallback(async (from: string, signal: RTCSignal) => {
    const peer = peersRef.current.get(from);
    if (!peer || !signal) return;
    const { pc } = peer;
    log("signal <-", from, signal.type, pc.signalingState, "polite:", peer.polite);

    if (signal.type === "offer" || signal.type === "answer") {
      try {
        if (signal.type === "offer") {
          const collision = peer.makingOffer || pc.signalingState !== "stable";
          peer.ignoreOffer = !peer.polite && collision;
          if (peer.ignoreOffer) {
            // Reddedilen teklife ait adaylar sonraki gecerli negotiaya karismasin
            peer.pendingIce.length = 0;
            return; // impolitik taraf kendi teklifinde israr eder
          }
        }
        peer.settingRemoteAnswer = signal.type === "answer";
        await pc.setRemoteDescription({ type: signal.type, sdp: signal.sdp });
        // Gecerli bir uzak tanim alindi -> onceki reddedilmis teklif unutulur.
        peer.ignoreOffer = false;
        await flushIce(peer);
        if (signal.type === "offer") {
          await pc.setLocalDescription();
          const desc = pc.localDescription;
          if (desc?.sdp) signalTo(from, { type: "answer", sdp: desc.sdp });
        }
      } catch (err) {
        if (!peer.ignoreOffer) console.warn("[signal]", err);
      } finally {
        peer.settingRemoteAnswer = false;
      }
      return;
    }

    if (signal.type === "ice") {
      const candidate = signal.candidate as RTCIceCandidateInit | null;
      if (!candidate) {
        log("ice end-of-candidates <-", from);
        return;
      }
      if (!pc.remoteDescription) {
        peer.pendingIce.push(candidate);
        log("ice buffered <-", from, peer.pendingIce.length);
        return;
      }
      try {
        await pc.addIceCandidate(candidate);
        log("ice added <-", from, candidate.sdpMid, (candidate.candidate || "").slice(0, 60));
      } catch (err) {
        log("ice FAILED <-", from, String((err as Error)?.message ?? err));
        if (!peer.ignoreOffer) console.warn("[ice]", err);
      }
      return;
    }
  }, [signalTo]);

  const createPeer = useCallback(
    (info: PeerInfo) => {
      if (!info?.id || info.id === selfIdRef.current) return;
      if (peersRef.current.has(info.id)) {
        const existing = peersRef.current.get(info.id)!;
        existing.info = info;
        bump();
        return;
      }

      const pc = new RTCPeerConnection({
        iceServers: iceRef.current as RTCIceServer[],
        iceCandidatePoolSize: 4,
      });
      const selfId = selfIdRef.current ?? "";
      const peer: PeerRT = {
        info,
        pc,
        stream: new MediaStream(),
        polite: selfId < info.id,
        makingOffer: false,
        ignoreOffer: false,
        settingRemoteAnswer: false,
        pendingIce: [],
        dcState: "new",
      };
      peersRef.current.set(info.id, peer);

      const local = localRef.current;
      if (local) {
        for (const track of local.getAudioTracks()) pc.addTrack(track, local);
        const cam = local.getVideoTracks()[0];
        const screenTrack = screenRef.current?.getVideoTracks()[0];
        const video = screenTrack ?? cam;
        if (video) pc.addTrack(video, local);
      }

      // En az bir veri kanali olsun: kamera/mikrofon yoksa bile SDP/ICE
      // baslatilir ve baglanti kurulur. Perfect negotiation glare'i yonetir.
      try {
        const dc = pc.createDataChannel("interviewhub");
        peer.dcState = dc.readyState;
        dc.onopen = () => {
          log("dc open", info.id);
          peer.dcState = dc.readyState;
          bump();
        };
        dc.onclose = () => {
          log("dc close", info.id);
          peer.dcState = dc.readyState;
          bump();
        };
      } catch {
        /* yoksay */
      }

      pc.onnegotiationneeded = async () => {
        log("negotiationneeded", info.id, pc.signalingState, "polite:", peer.polite);
        try {
          if (peer.makingOffer || peer.settingRemoteAnswer || pc.signalingState !== "stable") return;
          peer.makingOffer = true;
          await pc.setLocalDescription();
          const desc = pc.localDescription;
          if (desc?.sdp) {
            log("signal ->", info.id, desc.type, pc.signalingState);
            signalTo(info.id, { type: desc.type === "offer" ? "offer" : "answer", sdp: desc.sdp });
          }
        } catch (err) {
          console.warn("[negotiationneeded]", err);
        } finally {
          peer.makingOffer = false;
        }
      };

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          log("ice ->", info.id, candidate.sdpMid, (candidate.candidate || "").slice(0, 60));
        } else {
          log("ice ->", info.id, "end");
        }
        signalTo(info.id, {
          type: "ice",
          candidate: candidate
            ? {
                candidate: candidate.candidate,
                sdpMid: candidate.sdpMid,
                sdpMLineIndex: candidate.sdpMLineIndex,
                usernameFragment: candidate.usernameFragment,
              }
            : null,
        });
      };

      pc.ontrack = (event) => {
        const remote = event.streams[0];
        if (remote) {
          if (peer.stream !== remote) peer.stream = remote;
        } else if (!peer.stream.getTracks().includes(event.track)) {
          peer.stream.addTrack(event.track);
        }
        event.track.onended = () => {
          if (peer.stream.getTracks().includes(event.track)) peer.stream.removeTrack(event.track);
          bump();
        };
        bump();
      };

      pc.ondatachannel = (event) => {
        // Gelen kanal sadece baglantiyi ayakta tutar; mesajlasma socket uzerinden.
        const dc = event.channel;
        peer.dcState = dc.readyState;
        dc.onopen = () => {
          log("dc open (in)", info.id);
          peer.dcState = dc.readyState;
          bump();
        };
        dc.onclose = () => {
          peer.dcState = dc.readyState;
          bump();
        };
        bump();
      };

      pc.onconnectionstatechange = () => {
        log("conn", info.id, pc.connectionState, "/", pc.iceConnectionState, "/", pc.signalingState);
        if (pc.connectionState === "failed") {
          try {
            pc.restartIce();
          } catch {
            /* yoksay */
          }
        }
        bump();
      };

      bump();
    },
    [signalTo],
  );

  const removePeer = useCallback((peerId: string) => {
    const peer = peersRef.current.get(peerId);
    if (!peer) return;
    peersRef.current.delete(peerId);
    try {
      peer.pc.onnegotiationneeded = null;
      peer.pc.onicecandidate = null;
      peer.pc.ontrack = null;
      peer.pc.onconnectionstatechange = null;
      peer.pc.close();
    } catch {
      /* yoksay */
    }
    try {
      peer.stream.getTracks().forEach((t) => t.stop());
    } catch {
      /* yoksay */
    }
    bump();
  }, []);

  /* ------------------------------ yerel medya ----------------------------- */

  useEffect(() => {
    localRef.current = localStream;
    if (!localStream) {
      // Cihaz yok: bayraklari gercekle hizala
      if (mediaRef.current.mic || mediaRef.current.cam) {
        Object.assign(mediaRef.current, { mic: false, cam: false });
        setMediaState({ ...mediaRef.current });
      }
      return;
    }

    const audio = localStream.getAudioTracks()[0];
    const video = localStream.getVideoTracks()[0];
    const next: MediaFlags = {
      mic: Boolean(audio?.enabled),
      cam: Boolean(video?.enabled),
      screen: mediaRef.current.screen,
    };
    if (next.mic !== mediaRef.current.mic || next.cam !== mediaRef.current.cam) {
      Object.assign(mediaRef.current, next);
      setMediaState({ ...mediaRef.current });
    }

    // Medya odada katildiktan sonra hazir olursa ekleyici olarak tamamla
    if (joinedRef.current) {
      for (const peer of peersRef.current.values()) {
        const kinds = new Set(
          peer.pc
            .getSenders()
            .map((s) => s.track?.kind)
            .filter(Boolean),
        );
        for (const track of localStream.getTracks()) {
          if (!kinds.has(track.kind)) {
            try {
              peer.pc.addTrack(track, localStream);
            } catch (err) {
              console.warn("[addTrack]", err);
            }
          }
        }
      }
    }
  }, [localStream]);

  /* --------------------------------- katil -------------------------------- */

  const join = useCallback(() => {
    if (socketRef.current) return;
    setStatus("connecting");
    setError(null);

    const token = getToken();
    const socket = io({
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 800,
      timeout: 8000,
    });
    socketRef.current = socket;

    const fail = (message: string) => {
      setStatus("error");
      setError(message);
      // Socket'i ve peer'lari temizle: "Yeniden katıl" butonu tekrar calisir,
      // aksi halde socketRef hala dolu oldugu icin join() erken donerdi.
      const current = socketRef.current;
      socketRef.current = null;
      joinedRef.current = false;
      if (current) {
        try {
          current.removeAllListeners();
          current.disconnect();
        } catch {
          /* yoksay */
        }
      }
      for (const id of [...peersRef.current.keys()]) removePeer(id);
      setSelfInfo(null);
      selfIdRef.current = null;
    };

    socket.on("connect", () => {
      socket
        .timeout(8000)
        .emit(EV.JOIN, { roomId, name: nameRef.current }, (err: Error | null, ack?: JoinAck) => {
          if (err) {
            fail(translate("rtc.connectFailed"));
            return;
          }
          if (!ack?.ok) {
            fail(ack?.error ?? translate("rtc.joinFailed"));
            return;
          }
          selfIdRef.current = ack.selfId ?? null;
          setSelfInfo(ack.self ?? null);

          // Yeniden baglanmada olusan hayalet peer'lari temizle (sunucunun
          // verdigi liste yetkilidir); ayni id'li olanlar pc'yi korur.
          const listed = new Set((ack.peers ?? []).map((p) => p.id));
          for (const id of [...peersRef.current.keys()]) {
            if (!listed.has(id)) removePeer(id);
          }
          for (const peer of ack.peers ?? []) createPeer(peer);

          setChat(ack.chat ?? []);
          joinedRef.current = true;
          setStatus("joined");
          setError(null);
          socketRef.current?.emit(EV.MEDIA, { ...mediaRef.current });
        });
    });

    socket.on("connect_error", (err) => {
      if (err.message === "unauthorized") {
        fail(translate("rtc.authRequired"));
      } else if (!socketRef.current?.connected) {
        setStatus((s) => (s === "error" ? s : "connecting"));
      }
    });

    // Tum yeniden denemeler bitti: "connecting" ekraninda kilitlenmesin.
    socket.io.on("reconnect_failed", () => {
      fail(translate("rtc.reconnectFailed"));
    });

    socket.on(EV.PEER_JOINED, (payload: PeerJoinedPayload) => {
      if (payload?.peer) createPeer(payload.peer);
    });

    socket.on(EV.PEER_LEFT, (payload: PeerLeftPayload) => {
      if (payload?.peerId) removePeer(payload.peerId);
    });

    socket.on(EV.MEDIA, (payload: MediaStatePayload) => {
      const peer = peersRef.current.get(payload.peerId);
      if (!peer) return;
      peer.info = {
        ...peer.info,
        mic: Boolean(payload.mic),
        cam: Boolean(payload.cam),
        screen: Boolean(payload.screen),
      };
      bump();
    });

    socket.on(EV.SIGNAL, (payload: SignalPayload) => {
      if (payload?.from && payload.signal) void handleSignal(payload.from, payload.signal);
    });

    socket.on(EV.CHAT_MESSAGE, (payload: ChatMessagePayload) => {
      if (payload?.message) setChat((prev) => [...prev, payload.message].slice(-200));
    });
  }, [roomId, createPeer, removePeer, handleSignal]);

  const leave = useCallback(() => {
    const socket = socketRef.current;
    socketRef.current = null;
    joinedRef.current = false;
    selfIdRef.current = null;
    setSelfInfo(null);
    try {
      socket?.disconnect();
    } catch {
      /* yoksay */
    }
    for (const id of [...peersRef.current.keys()]) removePeer(id);
    void stopScreenRef.current();
    setStatus("left");
  }, [removePeer]);

  useEffect(() => {
    return () => {
      const socket = socketRef.current;
      socketRef.current = null;
      try {
        socket?.disconnect();
      } catch {
        /* yoksay */
      }
      for (const [id, peer] of peersRef.current) {
        try {
          peer.pc.close();
        } catch {
          /* yoksay */
        }
        peersRef.current.delete(id);
      }
      screenRef.current?.getTracks().forEach((t) => t.stop());
      screenRef.current = null;
    };
  }, []);

  /* ------------------------------ medya kontrolleri ----------------------- */

  const publishMedia = useCallback(() => {
    socketRef.current?.emit(EV.MEDIA, { ...mediaRef.current });
  }, []);

  const updateMedia = useCallback(
    (patch: Partial<MediaFlags>) => {
      Object.assign(mediaRef.current, patch);
      setMediaState({ ...mediaRef.current });
      if (joinedRef.current) publishMedia();
    },
    [publishMedia],
  );

  const toggleMic = useCallback(() => {
    const track = localRef.current?.getAudioTracks()[0];
    if (!track) return;
    const next = !track.enabled;
    track.enabled = next;
    updateMedia({ mic: next });
  }, [updateMedia]);

  const toggleCam = useCallback(() => {
    const track = localRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !track.enabled;
    track.enabled = next;
    updateMedia({ cam: next });
  }, [updateMedia]);

  const applyVideoTrack = useCallback(async (track: MediaStreamTrack | null) => {
    for (const peer of peersRef.current.values()) {
      try {
        const sender = peer.pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          await sender.replaceTrack(track);
        } else if (track) {
          peer.pc.addTrack(track, localRef.current ?? new MediaStream([track]));
        }
      } catch (err) {
        console.warn("[replaceTrack]", err);
      }
    }
  }, []);

  const stopScreen = useCallback(async () => {
    const current = screenRef.current;
    if (!current) return;
    screenRef.current = null;
    current.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    setScreenStream(null);
    const cam = localRef.current?.getVideoTracks()[0] ?? null;
    await applyVideoTrack(cam);
    updateMedia({ screen: false });
  }, [applyVideoTrack, updateMedia]);

  useEffect(() => {
    stopScreenRef.current = stopScreen;
  }, [stopScreen]);

  const toggleScreen = useCallback(async () => {
    if (screenRef.current) {
      await stopScreen();
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError(translate("rtc.screenUnsupported"));
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      });
      const track = display.getVideoTracks()[0];
      if (!track) throw new Error(translate("rtc.screenFailed"));
      screenRef.current = display;
      track.onended = () => {
        void stopScreenRef.current();
      };
      setScreenStream(display);
      await applyVideoTrack(track);
      updateMedia({ screen: true });
    } catch (err) {
      const name = (err as Error)?.name;
      if (name !== "NotAllowedError") console.warn("[screen]", err);
    }
  }, [applyVideoTrack, updateMedia]);

  const sendChat = useCallback((text: string) => {
    const value = text.trim();
    if (!value) return;
    socketRef.current?.emit(EV.CHAT_SEND, { text: value });
  }, []);

  const localPreview = screenStream ?? localStream;

  // Tanilama: window.__ihRoom() ile anlik peer/WebRTC durumu (gelistirme).
  useEffect(() => {
    const target = window as unknown as Record<string, unknown>;
    target.__ihRoom = () => ({
      status,
      selfId: selfIdRef.current,
      joined: joinedRef.current,
      media: { ...mediaRef.current },
      peers: [...peersRef.current.values()].map((p) => ({
        id: p.info.id,
        polite: p.polite,
        conn: p.pc.connectionState,
        ice: p.pc.iceConnectionState,
        gather: p.pc.iceGatheringState,
        sig: p.pc.signalingState,
        senders: p.pc.getSenders().length,
        sendTracks: p.pc.getSenders().map((s) => s.track?.kind ?? "-"),
        remoteDesc: p.pc.remoteDescription?.type ?? null,
        remoteTracks: p.stream.getTracks().map((t) => `${t.kind}:${t.readyState}`),
        dc: p.dcState,
      })),
      getPc: (id: string) => peersRef.current.get(id)?.pc ?? null,
    });
    return () => {
      delete target.__ihRoom;
    };
  });

  return {
    status,
    error,
    media,
    chat,
    peers: [...peersRef.current.values()],
    selfId: selfIdRef.current,
    selfInfo,
    localPreview,
    screenActive: Boolean(screenStream),
    screenStream,
    join,
    leave,
    toggleMic,
    toggleCam,
    toggleScreen,
    sendChat,
  };
}
