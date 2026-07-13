import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useCabinet } from "../context/CabinetContext";
import { useToast } from "./Toast";
import { chime } from "../lib/chime";
import { sendChatMessage, pollChat, getToken, getSecretaryToken, type ChatMessage } from "../api/client";

// Persistent doctor↔secretary chat as a floating widget. Polls faster while open,
// slower in the background (for the unread badge). Available to the doctor (not in
// secretary preview) and to a real secretary session.
const POLL_OPEN_MS = 3000;
const POLL_BG_MS   = 8000;
const LAST_SEEN_KEY = "bp.chat.lastSeen";

export function CabinetChat() {
  const { t } = useTranslation();
  const toast = useToast();
  const { role, secretaryMode, doctorProfile } = useCabinet();
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread]     = useState(0);
  const [draft, setDraft]       = useState("");
  const cursorRef = useRef<string | null>(null);
  const listRef   = useRef<HTMLDivElement>(null);
  const openRef   = useRef(open); openRef.current = open;

  const hasSession = !!(getToken() || getSecretaryToken());
  const show = hasSession && ((role === "doctor" && !secretaryMode) || role === "secretary");
  const myName = role === "doctor" ? (doctorProfile.fullName || undefined) : undefined;

  const merge = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    setMessages(prev => {
      const seen = new Set(prev.map(m => m.id));
      return [...prev, ...incoming.filter(m => !seen.has(m.id))].slice(-300);
    });
  }, []);

  // Poll loop
  useEffect(() => {
    if (!show) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (!alive) return;
      if (document.visibilityState === "visible") {
        const res = await pollChat(cursorRef.current);
        if (res && alive) {
          cursorRef.current = res.now;
          merge(res.messages);
          if (!openRef.current) {
            const ls = localStorage.getItem(LAST_SEEN_KEY);
            const fresh = res.messages.filter(m => m.fromRole !== role && (!ls || m.createdAt > ls));
            if (fresh.length) {
              setUnread(u => u + fresh.length);
              // Actively notify (not just a silent badge): toast + chime for the
              // newest incoming message so the other party sees it right away.
              const last = fresh[fresh.length - 1];
              const who = last.fromRole === "doctor"
                ? (last.fromName || t("chat.doctor"))
                : t("chat.secretary");
              toast(`💬 ${who} · ${last.body}`, "info");
              chime();
            }
          }
        }
      }
      if (alive) timer = setTimeout(tick, openRef.current ? POLL_OPEN_MS : POLL_BG_MS);
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [show, role, merge, t, toast]);

  // On open (and on new messages while open): clear unread + scroll to bottom.
  useEffect(() => {
    if (!open) return;
    setUnread(0);
    if (messages.length) localStorage.setItem(LAST_SEEN_KEY, messages[messages.length - 1].createdAt);
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    if (await sendChatMessage(body, myName)) {
      const res = await pollChat(cursorRef.current);   // pull my message straight back
      if (res) { cursorRef.current = res.now; merge(res.messages); }
    }
  };

  if (!show) return null;

  return (
    <>
      <button
        className={`chat-fab${open ? " open" : ""}`}
        onClick={() => setOpen(o => !o)}
        aria-label={t("chat.title")}
        title={t("chat.title")}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M3 4.5h14a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7l-3.5 3v-3H3a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M6 8h8M6 10.5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        )}
        {unread > 0 && <span className="chat-fab-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="chat-panel" role="dialog" aria-label={t("chat.title")}>
          <div className="chat-head">
            <span className="chat-head-title">{t("chat.title")}</span>
            <button className="chat-close" onClick={() => setOpen(false)} aria-label={t("common.close")}>×</button>
          </div>
          <div className="chat-list" ref={listRef}>
            {messages.length === 0
              ? <div className="chat-empty">{t("chat.empty")}</div>
              : messages.map(m => (
                  <div key={m.id} className={`chat-msg${m.fromRole === role ? " mine" : ""}`}>
                    <div className="chat-bubble">{m.body}</div>
                    <div className="chat-meta">
                      {m.fromRole === role
                        ? t("chat.you")
                        : m.fromRole === "doctor"
                          ? (m.fromName || t("chat.doctor"))
                          : t("chat.secretary")}
                      {" · "}
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                ))}
          </div>
          <form className="chat-input" onSubmit={e => { e.preventDefault(); send(); }}>
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder={t("chat.placeholder")}
              maxLength={2000}
              aria-label={t("chat.placeholder")}
            />
            <button type="submit" disabled={!draft.trim()}>{t("chat.send")}</button>
          </form>
        </div>
      )}
    </>
  );
}
