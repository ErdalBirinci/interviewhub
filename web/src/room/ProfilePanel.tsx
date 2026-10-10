import { useState } from "react";
import { Link } from "react-router-dom";
import { normalizeProfile, type LinkedInProfile, type PeerInfo } from "@ih/shared";
import { copyText } from "../lib/clipboard";
import { initials } from "./VideoTile";
import { useTranslation } from "../i18n/useTranslation";

interface ProfilePanelProps {
  peers: PeerInfo[];
  selfId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function safeLinkedInUrl(url: string): string | null {
  const value = url.trim();
  if (!value) return null;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(withProtocol);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function ProfileBody({ profile, peer }: { profile: LinkedInProfile; peer: PeerInfo }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const linkedIn = safeLinkedInUrl(profile.linkedinUrl);

  return (
    <div className="profile">
      <div className="profile__head">
        <div className="profile__avatar">
          {profile.fullName ? initials(profile.fullName) : "?"}
        </div>
        <div>
          <h3>{profile.fullName || peer.name}</h3>
          {profile.headline && <p className="profile__headline">{profile.headline}</p>}
          {profile.location && <p className="profile__meta">📍 {profile.location}</p>}
        </div>
      </div>

      <div className="profile__actions">
        {linkedIn && (
          <a className="btn btn--linkedin btn--sm" href={linkedIn} target="_blank" rel="noreferrer noopener">
            {t("room.sidePanel.profile.linkedInOpen")}
          </a>
        )}
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => {
            if (!linkedIn) return;
            void copyText(linkedIn).then((ok) => {
              if (!ok) return;
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            });
          }}
          disabled={!linkedIn}
        >
          {copied ? t("common.copied") : t("room.sidePanel.profile.copyLink")}
        </button>
      </div>

      {profile.summary && (
        <section className="profile__section">
          <h4>{t("room.sidePanel.profile.summary")}</h4>
          <p className="prewrap">{profile.summary}</p>
        </section>
      )}

      {profile.experience.length > 0 && (
        <section className="profile__section">
          <h4>{t("room.sidePanel.profile.experience")}</h4>
          <ul className="timeline">
            {profile.experience.map((exp, i) => (
              <li key={`${exp.company}-${i}`}>
                <strong>{exp.title}</strong>
                <span className="timeline__meta">
                  {exp.company} · {exp.period}
                </span>
                {exp.description && <p className="prewrap">{exp.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {profile.education.length > 0 && (
        <section className="profile__section">
          <h4>{t("room.sidePanel.profile.education")}</h4>
          <ul className="timeline">
            {profile.education.map((edu, i) => (
              <li key={`${edu.school}-${i}`}>
                <strong>{edu.school}</strong>
                <span className="timeline__meta">
                  {[edu.degree, edu.period].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {profile.skills.length > 0 && (
        <section className="profile__section">
          <h4>{t("room.sidePanel.profile.skills")}</h4>
          <div className="tags">
            {profile.skills.map((skill) => (
              <span key={skill} className="tag">
                {skill}
              </span>
            ))}
          </div>
        </section>
      )}

      <p className="hint">
        {t("room.sidePanel.profile.note")}
      </p>
    </div>
  );
}

export default function ProfilePanel({ peers, selfId, selectedId, onSelect }: ProfilePanelProps) {
  const { t } = useTranslation();
  const selected = peers.find((p) => p.id === selectedId) ?? peers[0] ?? null;

  return (
    <div className="panel">
      <div className="panel__people" role="tablist" aria-label={t("room.sidePanel.profile.peopleAriaLabel")}>
        {peers.map((peer) => (
          <button
            key={peer.id}
            role="tab"
            aria-selected={selected?.id === peer.id}
            className={`person ${selected?.id === peer.id ? "person--active" : ""}`}
            onClick={() => onSelect(peer.id)}
            title={peer.headline || peer.name}
          >
            <span className="person__avatar">{initials(peer.name)}</span>
            <span className="person__name">
              {peer.name}
              {peer.id === selfId && <em>(siz)</em>}
            </span>
            <span className={`person__dot ${peer.profile ? "person__dot--on" : ""}`} />
          </button>
        ))}
      </div>

      {!selected && (
        <p className="hint panel__empty">{t("room.sidePanel.profile.noParticipants")}</p>
      )}

      {selected &&
        (selected.profile ? (
          <ProfileBody profile={normalizeProfile(selected.profile)} peer={selected} />
        ) : (
          <div className="panel__empty">
            <p>
              <strong>{selected.name}</strong> {t("room.sidePanel.profile.notShared")}
            </p>
            {selected.id === selfId ? (
              <Link className="btn btn--primary btn--sm" to="/profile">
                {t("room.sidePanel.profile.editProfile")}
              </Link>
            ) : (
              <p className="hint">
                {t("room.sidePanel.profile.candidateNote")}
              </p>
            )}
          </div>
        ))}
    </div>
  );
}
