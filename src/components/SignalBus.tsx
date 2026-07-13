import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "./Toast";
import { useCabinet } from "../context/CabinetContext";
import { pollSignals, getToken, getSecretaryToken, type CabinetSignal } from "../api/client";
import { enableWebPush, webPushPermission } from "../lib/webPush";
import { chime } from "../lib/chime";

// Featherweight doctor↔secretary live channel. Polls the tiny /cabinet/signals
// endpoint (NOT the heavy snapshot) only while a session is active and the tab
// is visible, and turns each signal into a toast + soft chime. On "patient
// called" it also forces a snapshot refresh so the waiting-room board reflects
// the move at once instead of on the next 25 s poll.
const POLL_MS = 2500;

// Module-level so the cursor + de-dupe survive route remounts (the component is
// re-created on navigation, but the polling should continue seamlessly).
let cursor: string | null = null;
const shown = new Set<string>();
// Silently (re)register web push once per session for users who already granted
// notification permission — so a backgrounded/closed tab still gets alerted.
let pushToken: string | null = null;

export function SignalBus() {
  const { t } = useTranslation();
  const toast = useToast();
  const { refreshNow } = useCabinet();
  // Keep the latest refresh/toast in refs so the poll loop needn't restart.
  const refreshRef = useRef(refreshNow);
  refreshRef.current = refreshNow;
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const handle = (s: CabinetSignal) => {
      if (shown.has(s.id)) return;
      shown.add(s.id);
      if (shown.size > 300) shown.clear();
      const tr = tRef.current;
      const who = s.fromName
        || (s.fromRole === "doctor" ? tr("signals.theDoctor") : tr("signals.theSecretary"));
      if (s.type === "patient_called") {
        const patient = s.payload?.patientName || tr("signals.aPatient");
        toastRef.current("🔔 " + tr("signals.patientCalled", { who, patient }), "info");
        // Reflect the board at once, then again after the doctor's debounced
        // snapshot push (~1.2 s) has landed on the server.
        void refreshRef.current();
        setTimeout(() => void refreshRef.current(), 1600);
      } else if (s.type === "intercom") {
        toastRef.current("🔔 " + tr("signals.intercom", { who }), "warning");
      } else {
        toastRef.current("🔔 " + who, "info");
      }
      chime();
    };

    const tick = async () => {
      if (!alive) return;
      const hasSession = !!(getToken() || getSecretaryToken());
      // Re-register web push once per session (only if already permitted — never
      // prompts here; the explicit opt-in lives in Settings).
      if (hasSession && webPushPermission() === "granted") {
        const tok = getToken() || getSecretaryToken();
        if (tok && pushToken !== tok) { pushToken = tok; void enableWebPush(false); }
      }
      if (hasSession && document.visibilityState === "visible") {
        const res = await pollSignals(cursor);
        if (res) {
          cursor = res.now;
          for (const s of res.signals) handle(s);
        }
      }
      if (alive) timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => { alive = false; clearTimeout(timer); };
  }, []);

  return null;
}
