import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

// ── Offline banner ─────────────────────────────────────────────────────────────

export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on  = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  if (!offline) return null;

  return (
    <div className="pwa-offline-banner" role="status" aria-live="polite">
      <span className="pwa-offline-icon">📡</span>
      <span>Mode hors-ligne — les données locales restent accessibles</span>
    </div>
  );
}

// ── SW update toast ────────────────────────────────────────────────────────────

export function PWAUpdateToast() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      if (r) console.log("[PWA] SW registered");
    },
    onRegisterError(e: unknown) {
      console.warn("[PWA] SW registration error", e);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="pwa-update-toast" role="alert">
      <span className="pwa-update-icon">🔄</span>
      <div className="pwa-update-text">
        <div className="pwa-update-title">Mise à jour disponible</div>
        <div className="pwa-update-sub">Une nouvelle version de l'app est prête.</div>
      </div>
      <button className="pwa-update-btn" onClick={() => updateServiceWorker(true)}>
        Mettre à jour
      </button>
    </div>
  );
}

// ── Install button (used in ParametresPage) ────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
});

export function useInstallPWA() {
  const [canInstall, setCanInstall] = useState(false);
  const [installed,  setInstalled]  = useState(
    window.matchMedia("(display-mode: standalone)").matches,
  );

  useEffect(() => {
    if (deferredPrompt) setCanInstall(true);

    const handler = () => { deferredPrompt = null; setCanInstall(true); };
    window.addEventListener("beforeinstallprompt", handler);

    const mq = window.matchMedia("(display-mode: standalone)");
    const mqHandler = (e: MediaQueryListEvent) => setInstalled(e.matches);
    mq.addEventListener("change", mqHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      mq.removeEventListener("change", mqHandler);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      deferredPrompt = null;
      setCanInstall(false);
      setInstalled(true);
    }
  };

  return { canInstall, installed, install };
}
