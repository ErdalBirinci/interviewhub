import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessage } from "@ih/shared";
import { useTranslation } from "../i18n/useTranslation";

interface ChatPanelProps {
  messages: ChatMessage[];
  selfId: string | null;
  onSend: (text: string) => void;
  disabled?: boolean;
}

export default function ChatPanel({ messages, selfId, onSend, disabled }: ChatPanelProps) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText("");
  };

  return (
    <div className="chat">
      <div className="chat__list" role="log" aria-live="polite" aria-label={t("room.sidePanel.chat.ariaLabel")}>
        {messages.length === 0 && (
          <p className="hint">{t("room.sidePanel.chat.empty")}</p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`msg ${m.from === selfId ? "msg--mine" : ""}`}
          >
            <div className="msg__meta">
              <strong>{m.from === selfId ? "Siz" : m.fromName}</strong>
              <span>{new Date(m.ts).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <div className="msg__text">{m.text}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form className="chat__form" onSubmit={submit}>
        <label className="sr-only" htmlFor="chat-input">Mesaj</label>
        <input
          id="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={disabled ? t("room.sidePanel.chat.disconnected") : t("room.sidePanel.chat.placeholder")}
          disabled={disabled}
          maxLength={2000}
        />
        <button className="btn btn--primary" type="submit" disabled={disabled || !text.trim()}>
          {t("room.sidePanel.chat.send")}
        </button>
      </form>
    </div>
  );
}
