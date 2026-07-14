import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useCabinet } from "../context/CabinetContext";
import { useToast } from "./Toast";
import { chime } from "../lib/chime";
import { sendChatMessage, pollChat, getToken, getSecretaryToken, emitSignal, type ChatMessage } from "../api/client";

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
  // Show the chat for the doctor, a real secretary, AND the doctor's secretary
  // preview — so the preview faithfully shows the secretary has chat access.
  const show = hasSession && (role === "doctor" || role === "secretary");
  const myName = role === "doctor" ? (doctorProfile.fullName || undefined) : undefined;

  // Intercom — the doctor rings the secretary (a one-shot "come in" alert) from
  // inside the chat, instead of a separate button in the page header.
  const canRing = role === "doctor" && !secretaryMode;
  const ring = () => {
    emitSignal("intercom", {}, doctorProfile.fullName || undefined);
    toast(t("signals.calledSecretary"), "success");
  };

  const merge = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    setMessages(prev => {
      const seen = new Set(prev.map(m => m.id));
      return [...prev, ...incoming.filter(m => !seen.has(m.id))].slice(-300);
    });
  }, []);

  // Poll loop. Runs even when the tab is BACKGROUNDED — a receptionist usually
  // keeps Blackpine in a background tab, and the previous visibility gate meant
  // she never saw new messages until she refocused. The unread badge + tab title
  // now stay current; the toast/chime still only fire when the tab is in front.
  useEffect(() => {
    if (!show) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (!alive) return;
      const res = await pollChat(cursorRef.current);
      if (res && alive) {
        cursorRef.current = res.now;
        const ls = localStorage.getItem(LAST_SEEN_KEY);
        const fresh = res.messages.filter(m => m.fromRole !== role && (!ls || m.createdAt > ls));
        merge(res.messages);   // the badge is derived from the merged list (effect below)
        // Loud alert (toast + chime) only for brand-new incoming messages, and only
        // when the tab is in front with the panel closed.
        if (fresh.length && !openRef.current && document.visibilityState === "visible") {
          const last = fresh[fresh.length - 1];
          const who  = last.fromRole === "doctor" ? (last.fromName || t("chat.doctor")) : t("chat.secretary");
          const many = fresh.length > 1 ? `(${fresh.length}) ` : "";
          toast(`💬 ${many}${who} · ${last.body}`, "warning");   // warning = lingers ~7s (info died in 3.8s)
          chime();
        }
      }
      if (alive) timer = setTimeout(tick, openRef.current ? POLL_OPEN_MS : POLL_BG_MS);
    };
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [show, role, merge, t, toast]);

  // Unread badge — DERIVED from the message list vs lastSeen, so it's authoritative
  // and survives a reload (no incremental drift / double-count). Zero while open.
  useEffect(() => {
    if (open) { setUnread(0); return; }
    const ls = localStorage.getItem(LAST_SEEN_KEY);
    setUnread(messages.filter(m => m.fromRole !== role && (!ls || m.createdAt > ls)).length);
  }, [messages, open, role]);

  // Reflect unread in the browser tab title, so a backgrounded secretary sees it.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s+/, "");
    document.title = unread > 0 ? `(${unread}) ${base}` : base;
    return () => { document.title = document.title.replace(/^\(\d+\)\s+/, ""); };
  }, [unread]);

  // On open (and on new messages while open): mark seen + scroll to bottom.
  useEffect(() => {
    if (!open) return;
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
        className={`chat-fab${open ? " open" : ""}${unread > 0 ? " has-unread" : ""}`}
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
            <div className="chat-head-actions">
              {canRing && (
                <button className="chat-ring" onClick={ring} title={t("signals.callSecretary")} aria-label={t("signals.callSecretary")}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 2a3.4 3.4 0 0 1 3.4 3.4c0 2.4 1 3.3 1.5 3.9a.4.4 0 0 1-.3.7H3.4a.4.4 0 0 1-.3-.7c.5-.6 1.5-1.5 1.5-3.9A3.4 3.4 0 0 1 8 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                    <path d="M6.5 12.4a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                </button>
              )}
              <button className="chat-close" onClick={() => setOpen(false)} aria-label={t("common.close")}>×</button>
            </div>
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
