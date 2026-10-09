/**
 * AI değerlendirme asistanı — OpenAI-uyumlu chat completions API'si.
 *
 * Yapılandırma (sunucu ortam değişkenleri):
 *   AI_API_URL    (varsayılan: https://api.openai.com/v1)
 *   AI_API_KEY    (zorunlu; yoksa özellik kapali kalir)
 *   AI_MODEL      (varsayılan: gpt-4o-mini)
 *
 * Gizlilik: yalnızca mülakat notları ve adayin kendi beyanı olan
 * profil bilgisi iletilir; ses/video medyası hiçbir zaman
 * sunucudan AI'a gönderilmez.
 */
import {
  normalizeProfile,
  type EvaluationResult,
  type LinkedInProfile,
} from "@ih/shared";
import { CFG } from "./config";

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI değerlendirmesi yapılandırılmadı (AI_API_URL / AI_API_KEY).");
    this.name = "AiNotConfiguredError";
  }
}

export function aiEnabled(): boolean {
  return Boolean(CFG.AI_API_KEY && CFG.AI_API_URL);
}

const SYSTEM_PROMPT = `Sen deneyimli bir mülakat değerlendirmecisisin.
Mülakat notlarına ve aday profiline dayanarak yapılandırılmış,
adil bir değerlendirme üret. Yalnızca VERİLEN notlara dayan;
uydurma yapma; notlarda olmayan bilgiyi 0 puan olarak değil,
"belirtilmedi" şeklinde yorumla.

Yanıtı HİÇBİR AÇIKLAMA OLMADAN, şu şemaya tam uygun bir JSON
nesnesi olarak ver (küme parantezleri arasında):
{
  "score": 0-100 arası tek bir sayı (genel değerlendirme),
  "rubric": [
    {"area": "Teknik bilgi", "score": 0-100, "comment": "kısa gerekçe"},
    {"area": "Problem çözme", "score": 0-100, "comment": "kısa gerekçe"},
    {"area": "İletişim", "score": 0-100, "comment": "kısa gerekçe"},
    {"area": "Deneyim uyumluğu", "score": 0-100, "comment": "kısa gerekçe"},
    {"area": "Kültür uyumluğu", "score": 0-100, "comment": "kısa gerekçe"}
  ],
  "strengths": ["güçlü yön 1", "..."],
  "concerns": ["geliştirilecek yön 1", "..."],
  "recommendation": "hire" | "no_hire" | "uncertain",
  "summary": "3-4 cümlelik özet"
}`;

/** AI yanıtından JSON'u çıkarır (markdown fenced block'u da atar). */
function parseEvaluation(text: string): EvaluationResult {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI yanıtından JSON çıkarılamadı.");
  }
  const data = JSON.parse(cleaned.slice(start, end + 1)) as Record<
    string,
    unknown
  >;

  const num = (value: unknown, fallback = 0): number =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(0, Math.min(100, value))
      : fallback;
  const strList = (value: unknown, max = 10): string[] =>
    Array.isArray(value)
      ? value
          .slice(0, max)
          .map((v) => String(v).trim())
          .filter(Boolean)
      : [];

  const rubric = Array.isArray(data.rubric)
    ? data.rubric
        .slice(0, 8)
        .map((item) => {
          const r = (item ?? {}) as Record<string, unknown>;
          return {
            area: String(r.area ?? "Genel").slice(0, 80),
            score: num(r.score),
            comment: String(r.comment ?? "").slice(0, 500),
          };
        })
    : [];

  const rec = data.recommendation;
  return {
    score: num(data.score),
    rubric,
    strengths: strList(data.strengths),
    concerns: strList(data.concerns),
    recommendation:
      rec === "hire" || rec === "no_hire" || rec === "uncertain"
        ? rec
        : "uncertain",
    summary: String(data.summary ?? "").slice(0, 1200),
  };
}

function candidateSection(candidate: LinkedInProfile | null): string {
  if (!candidate) return "Aday profili paylaşılmadı.";
  const exp = candidate.experience
    .slice(0, 8)
    .map((e) => `- ${e.title}${e.company ? ` @ ${e.company}` : ""}${e.period ? ` (${e.period})` : ""}`)
    .join("\n");
  const edu = candidate.education
    .slice(0, 4)
    .map((e) => `- ${e.school}${e.degree ? ` — ${e.degree}` : ""}`)
    .join("\n");
  return [
    candidate.fullName ? `İsim: ${candidate.fullName}` : "",
    candidate.headline ? `Başlık: ${candidate.headline}` : "",
    candidate.location ? `Konum: ${candidate.location}` : "",
    candidate.skills.length ? `Yetenekler: ${candidate.skills.join(", ")}` : "",
    exp ? `\nDeneyim:\n${exp}` : "",
    edu ? `\nEğitim:\n${edu}` : "",
    candidate.summary ? `\nÖzet:\n${candidate.summary.slice(0, 1500)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function evaluateInterview(input: {
  notes: string;
  candidate?: LinkedInProfile | null;
  position?: string;
}): Promise<EvaluationResult> {
  if (!aiEnabled()) throw new AiNotConfiguredError();

  const userPrompt = [
    input.position ? `Pozisyon: ${input.position}` : "Pozisyon: belirtilmedi",
    "",
    "## Aday profili",
    candidateSection(input.candidate ?? null),
    "",
    "## Görüşme notları",
    input.notes.slice(0, 4000),
    "",
    "Yukarıdaki şemaya göre JSON olarak değerlendir.",
  ].join("\n");

  const base = {
    model: CFG.AI_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
  };

  const url = `${CFG.AI_API_URL.replace(/\/+$/, "")}/chat/completions`;
  const headers = {
    Authorization: `Bearer ${CFG.AI_API_KEY}`,
    "Content-Type": "application/json",
  };

  const call = (extra: Record<string, unknown> = {}) =>
    fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...base, ...extra }),
      signal: AbortSignal.timeout(30_000),
    });

  // JSON modu bazı uyumlu endpoint'ler tarafından reddedilebilir;
  // o durumda modsuz tekrar deneriz.
  let res = await call({ response_format: { type: "json_object" } });
  if (!res.ok && res.status >= 400 && res.status < 500) {
    res = await call();
  }
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    throw new Error(`AI API ${res.status}: ${detail}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: unknown } }[];
    model?: string;
  };
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("AI yanıtından içerik çıkarılamadı.");
  }

  const evaluation = parseEvaluation(text);
  if (data.model) evaluation.model = data.model;
  return evaluation;
}

/** Rota katmanı için profili normalize eder. */
export function normalizeCandidateProfile(
  raw: unknown,
): LinkedInProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const profile = normalizeProfile(raw as Partial<LinkedInProfile>);
  const hasContent =
    Boolean(profile.fullName || profile.headline || profile.summary) ||
    profile.experience.length > 0 ||
    profile.education.length > 0 ||
    profile.skills.length > 0;
  return hasContent ? profile : null;
}
