/**
 * InterviewHub - paylaşilan tip sozlesmesi
 * server / web / extension arasindaki tum veri yapilari ve socket olaylari burada.
 */

/* ---------------------------------- Profil ---------------------------------- */

export interface ProfileExperience {
  title: string;
  company: string;
  period: string;
  description?: string;
}

export interface ProfileEducation {
  school: string;
  degree?: string;
  period: string;
}

/**
 * LinkedIn profili.
 * Dikkat: LinkedIn API'si ucuncu taraflara profil verisi vermez.
 * Buradaki alanlar kullanici tarafindan girilir (adayin kendi beyani),
 * dogrulama ise LinkedIn OAuth ile yapilir (isim, foto, profil URL).
 */
export interface LinkedInProfile {
  linkedinUrl: string;
  fullName: string;
  headline: string;
  location?: string;
  summary?: string;
  experience: ProfileExperience[];
  education: ProfileEducation[];
  skills: string[];
  /** Profili odadaki diger katilimcilara goster */
  shareProfile: boolean;
}

export const EMPTY_PROFILE: LinkedInProfile = {
  linkedinUrl: "",
  fullName: "",
  headline: "",
  location: "",
  summary: "",
  experience: [],
  education: [],
  skills: [],
  shareProfile: true,
};

/**
 * Eksik/bozuk profil alanlarini guvenli varsayilanlara tamamlar.
 * Eski (elle duzenlenmis veya kismi) kayitlarda dizi alanlari null/eksik
 * olabilir; arayuzde `.experience.length` gibi erisimler cogu.
 */
export function normalizeProfile(input: Partial<LinkedInProfile> | null | undefined): LinkedInProfile {
  const p = (input ?? {}) as Partial<LinkedInProfile>;
  const list = <T>(value: unknown): T[] =>
    Array.isArray(value) ? (value.filter(Boolean) as T[]) : [];
  return {
    linkedinUrl: typeof p.linkedinUrl === "string" ? p.linkedinUrl : "",
    fullName: typeof p.fullName === "string" ? p.fullName : "",
    headline: typeof p.headline === "string" ? p.headline : "",
    location: typeof p.location === "string" ? p.location : "",
    summary: typeof p.summary === "string" ? p.summary : "",
    experience: list<ProfileExperience>(p.experience),
    education: list<ProfileEducation>(p.education),
    skills: list<string>(p.skills).filter((s) => typeof s === "string"),
    shareProfile: p.shareProfile !== false,
  };
}

/* ---------------------------------- Kullanici -------------------------------- */

export interface Me {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  provider: "linkedin" | "demo";
}

/* ------------------------------- Oda / katilimci ---------------------------- */

export interface PeerMediaState {
  mic: boolean;
  cam: boolean;
  screen: boolean;
}

export interface PeerInfo extends PeerMediaState {
  id: string;
  name: string;
  role: "host" | "guest";
  /** Kisa baslik (profil varsa headline) */
  headline?: string;
  /** Paylasilan profil - shareProfile false ise null */
  profile: LinkedInProfile | null;
}

export interface ChatMessage {
  id: string;
  from: string;
  fromName: string;
  text: string;
  ts: number;
}

export interface RoomMeta {
  id: string;
  title: string;
  hostId: string;
  hostName: string;
  createdAt: number;
}

export interface RoomView extends RoomMeta {
  /** Anlik kisi sayisi (canli odalardan) */
  active: number;
}

/* --------------------------- AI değerlendirme --------------------------- */

/** AI değerlendirmesinin tek rubrik kalemi. */
export interface EvaluationRubricItem {
  area: string;
  /** 0-100 */
  score: number;
  comment: string;
}

/**
 * Mülakat değerlendirmesi (AI asistanı tarafindan uretilir).
 * Notlar ve aday profili sunucu uzerinden AI'a gonderilir;
 * ses/video medyasi asla iletilmez.
 */
export interface EvaluationResult {
  /** 0-100 genel puan */
  score: number;
  rubric: EvaluationRubricItem[];
  strengths: string[];
  concerns: string[];
  recommendation: "hire" | "no_hire" | "uncertain";
  summary: string;
  model?: string;
}

/* --------------------------------- REST tipleri ------------------------------ */

export interface IceServerLike {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface ApiError {
  error: string;
}

/* ------------------------------- Socket sozlesmesi --------------------------- */

export interface IceCandidateLike {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export type RTCSignal =
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | { type: "ice"; candidate: IceCandidateLike | null };

export interface JoinPayload {
  roomId: string;
  name?: string;
}

export interface JoinAck {
  ok: boolean;
  error?: string;
  selfId?: string;
  /** Katilimcinin kendi bilgisi + paylasilan profili */
  self?: PeerInfo;
  peers?: PeerInfo[];
  chat?: ChatMessage[];
}

export interface PeerJoinedPayload {
  peer: PeerInfo;
}

export interface PeerLeftPayload {
  peerId: string;
}

export interface MediaStatePayload extends PeerMediaState {
  peerId: string;
}

export interface SignalPayload {
  from: string;
  signal: RTCSignal;
}

export interface ChatSendPayload {
  text: string;
}

export interface ChatMessagePayload {
  message: ChatMessage;
}

/** Sunucu -> istemci olay adlari */
export const EV = {
  JOIN: "room:join",
  PEER_JOINED: "room:peer-joined",
  PEER_LEFT: "room:peer-left",
  MEDIA: "media:state",
  SIGNAL: "rtc:signal",
  CHAT_SEND: "chat:send",
  CHAT_MESSAGE: "chat:message",
  ERROR: "room:error",
} as const;
