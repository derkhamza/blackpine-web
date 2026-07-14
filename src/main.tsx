import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import { CabinetProvider } from "./context/CabinetContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { App } from "./App";
import { OfflineBanner, PWAUpdateToast } from "./components/PWAPrompts"
import { ToastProvider } from "./components/Toast";
import { ConfirmHost } from "./lib/confirm";
import { hydrateKvCache } from "./lib/cabinetStore";
import { initDarkMode } from "./lib/useDarkMode";
import "./styles/global.css";
import "./i18n";   // initialise i18next before first render

// Apply saved theme before first paint
initDarkMode();

/**
 * Sits inside AppProvider so it can read the current user, then mounts
 * CabinetProvider with a key equal to the user's ID.  Changing the key
 * forces a full remount, which re-initialises all cabinet reads from the
 * new user's namespaced keys — giving each account isolated data.
 */
function AccountBoundary({ children }: { children: ReactNode }) {
  const { user, secretaryOwner, endSecretarySession } = useApp();
  const userId = user?.id;

  // A secretary session takes precedence and mounts the provider in restricted mode.
  if (secretaryOwner) {
    return (
      <CabinetProvider
        key={`sec:${secretaryOwner.ownerUserId}`}
        secretarySession={{ ownerUserId: secretaryOwner.ownerUserId, ownerName: secretaryOwner.ownerName }}
        onSecretaryRevoked={endSecretarySession}
      >
        {children}
      </CabinetProvider>
    );
  }

  return (
    <CabinetProvider key={userId ?? "anon"} userId={userId}>
      {children}
    </CabinetProvider>
  );
}

// Warm the IndexedDB-backed cabinet cache BEFORE first render, so the synchronous
// state initializers in CabinetProvider read the (migrated) data. hydrateKvCache
// has its own hard timeout, so a slow/unavailable IndexedDB can never block
// startup — and `.finally` renders regardless.
hydrateKvCache().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <AppProvider>
            <AccountBoundary>
              <ToastProvider>
                <OfflineBanner />
                <PWAUpdateToast />
                <App />
                <ConfirmHost />
              </ToastProvider>
            </AccountBoundary>
          </AppProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>
  );
});
