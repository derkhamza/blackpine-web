import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { CabinetProvider } from "./context/CabinetContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { App } from "./App";
import { OfflineBanner, PWAUpdateToast } from "./components/PWAPrompts";
import { initDarkMode } from "./lib/useDarkMode";
import "./styles/global.css";

// Apply saved theme before first paint
initDarkMode();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <CabinetProvider>
            <OfflineBanner />
            <PWAUpdateToast />
            <App />
          </CabinetProvider>
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
