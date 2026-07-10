import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { trackPage } from "./lib/analytics";
import { useApp } from "./context/AppContext";
import { useCabinet } from "./context/CabinetContext";
import type { SecretaryPermissions } from "./lib/cabinetTypes";
import { DEFAULT_SECRETARY_PERMISSIONS } from "./lib/cabinetTypes";
import { OnboardingWizard } from "./pages/OnboardingWizard";
import { WelcomeTour, hasSeenTour } from "./components/WelcomeTour";
import { HelpPage }              from "./pages/HelpPage";
import { AuthPage }              from "./pages/AuthPage";
import { BookingPage }           from "./pages/BookingPage";
import { DeleteAccountPage }     from "./pages/DeleteAccountPage";
import { AdminPage }             from "./pages/AdminPage";
import { DashboardPage }         from "./pages/DashboardPage";
import { ExplainPage }           from "./pages/ExplainPage";
import { ProfilePage }           from "./pages/ProfilePage";
import { AgendaPage }            from "./pages/AgendaPage";
import { AppointmentDetailPage } from "./pages/AppointmentDetailPage";
import { PatientsPage }          from "./pages/PatientsPage";
import { PatientDetailPage }     from "./pages/PatientDetailPage";
import { StatsPage }             from "./pages/StatsPage";
import { PayrollPage }           from "./pages/PayrollPage";
import { RemboursementsPage }    from "./pages/RemboursementsPage";
import { WaitingRoomPage }       from "./pages/WaitingRoomPage";
import { FacturesPage }          from "./pages/FacturesPage";
import { StocksSupplyPage }      from "./pages/StocksSupplyPage";
import { StockPage }             from "./pages/StockPage";
import { CalculateursPage }      from "./pages/CalculateursPage";
import { MessagesPage }          from "./pages/MessagesPage";
import { TeleconsultPage }       from "./pages/TeleconsultPage";
import { NotesPage }             from "./pages/NotesPage";
import { FournisseursPage }      from "./pages/FournisseursPage";
import { ExamensPage }           from "./pages/ExamensPage";
import { OrdonancesPage }        from "./pages/OrdonancesPage";
import { CertificatsPage }       from "./pages/CertificatsPage";
import { ReportPage }            from "./pages/ReportPage";
import { ComptabilitePage }      from "./pages/ComptabilitePage";
import { OptimisationPage }      from "./pages/OptimisationPage";
import { ParametresPage }        from "./pages/ParametresPage";
// ── Combined/merged pages ─────────────────────────────────────────────────────
import { DocumentsPage }         from "./pages/DocumentsPage";
import { CommunicationPage }     from "./pages/CommunicationPage";
import { RapportsPage }          from "./pages/RapportsPage";
import { FacturationPage }       from "./pages/FacturationPage";

function RequireAuth({ children, secretaryOk = false, perm }: {
  children: JSX.Element;
  secretaryOk?: boolean;
  perm?: keyof SecretaryPermissions;
}) {
  const { isAuthenticated, isSecretary } = useApp();
  const { doctorProfile } = useCabinet();
  // A secretary may only reach explicitly-allowed routes; everything else
  // bounces them to their home (the agenda). Routes flagged with a `perm` are
  // additionally gated on the granular permission the doctor granted.
  if (isSecretary) {
    if (!secretaryOk && !perm) return <Navigate to="/agenda" replace />;
    if (perm) {
      const perms = doctorProfile.secretaryPermissions ?? DEFAULT_SECRETARY_PERMISSIONS;
      if (!perms[perm]) return <Navigate to="/agenda" replace />;
    }
    return children;
  }
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function OnboardingGate() {
  const { isAuthenticated } = useApp();
  const { doctorProfile } = useCabinet();
  const [dismissed, setDismissed] = useState(false);

  const alreadyDone = !!localStorage.getItem("bp.onboarded");
  const needsOnboarding =
    isAuthenticated &&
    !alreadyDone &&
    !dismissed &&
    !doctorProfile.fullName;

  if (!needsOnboarding) return null;
  return <OnboardingWizard onDone={() => setDismissed(true)} />;
}

// First-time feature walkthrough. Shows once the profile is set up (so it never
// competes with the OnboardingWizard) and only for the doctor. Re-openable from
// the Help page via the "bp:open-tour" event.
function TourGate() {
  const { isAuthenticated, isSecretary } = useApp();
  const { doctorProfile } = useCabinet();
  const [open, setOpen] = useState(false);
  const [forced, setForced] = useState(false);

  useEffect(() => {
    const reopen = () => { setForced(true); setOpen(true); };
    window.addEventListener("bp:open-tour", reopen);
    return () => window.removeEventListener("bp:open-tour", reopen);
  }, []);

  useEffect(() => {
    if (forced) return;
    if (isAuthenticated && !isSecretary && !!doctorProfile.fullName && !hasSeenTour()) {
      setOpen(true);
    }
  }, [isAuthenticated, isSecretary, doctorProfile.fullName, forced]);

  return <WelcomeTour open={open} onClose={() => { setOpen(false); setForced(false); }} />;
}

function RouteTracker() {
  const loc = useLocation();
  useEffect(() => { trackPage(loc.pathname); }, [loc.pathname]);
  return null;
}

// Global guard against "modal drag-close": if a press STARTS inside a dialog and
// the release lands on the backdrop, the browser fires the click on the overlay
// and the modal closes — cancelling whatever the user was doing (selecting text,
// dragging a slider, a slightly-off button click). We only let an overlay click
// dismiss when the press also began on the overlay. One listener protects every
// modal in the app.
function ModalDragGuard() {
  useEffect(() => {
    let downOnOverlay = false;
    const isOverlay = (el: EventTarget | null) =>
      el instanceof HTMLElement && el.classList.contains("modal-overlay");
    const onDown = (e: MouseEvent) => { downOnOverlay = isOverlay(e.target); };
    const onClick = (e: MouseEvent) => {
      if (isOverlay(e.target) && !downOnOverlay) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("click", onClick, true);

    // Lock body scroll while any modal is open, so the page underneath can't
    // scroll behind the (fixed) overlay and reveal un-obscured content.
    const sync = () => {
      const open = document.querySelector(".modal-overlay") !== null;
      document.body.classList.toggle("modal-open", open);
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    sync();

    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("click", onClick, true);
      observer.disconnect();
      document.body.classList.remove("modal-open");
    };
  }, []);
  return null;
}

export function App() {
  return (
    <>
    <RouteTracker />
    <ModalDragGuard />
    <OnboardingGate />
    <TourGate />
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      {/* Public patient self-booking — no auth */}
      <Route path="/book/:slug" element={<BookingPage />} />
      {/* Public account-deletion page — reachable without the app (Play / GDPR) */}
      <Route path="/supprimer-compte" element={<DeleteAccountPage />} />
      <Route path="/delete-account"   element={<DeleteAccountPage />} />
      <Route path="/" element={
        <RequireAuth><DashboardPage /></RequireAuth>
      } />
      <Route path="/transactions" element={<Navigate to="/facturation" replace />} />
      <Route path="/admin" element={
        <RequireAuth><AdminPage /></RequireAuth>
      } />
      {/* ── Combined pages (new primary routes) ── */}
      <Route path="/documents" element={
        <RequireAuth perm="viewClinical"><DocumentsPage /></RequireAuth>
      } />
      <Route path="/communication" element={
        <RequireAuth perm="useCommunication"><CommunicationPage /></RequireAuth>
      } />
      <Route path="/rapports" element={
        <RequireAuth><RapportsPage /></RequireAuth>
      } />
      <Route path="/facturation" element={
        <RequireAuth perm="handleBilling"><FacturationPage /></RequireAuth>
      } />
      {/* ── Legacy routes (kept for deep links / bookmarks) ── */}
      <Route path="/expliquer"    element={<Navigate to="/rapports" replace />} />
      <Route path="/optimisation" element={<Navigate to="/rapports" replace />} />
      <Route path="/rapport"      element={<Navigate to="/rapports" replace />} />
      <Route path="/factures"     element={<Navigate to="/facturation" replace />} />
      <Route path="/remboursements" element={<Navigate to="/facturation" replace />} />
      <Route path="/ordonnances"  element={<Navigate to="/documents" replace />} />
      <Route path="/certificats"  element={<Navigate to="/documents" replace />} />
      <Route path="/messages"     element={<Navigate to="/communication" replace />} />
      <Route path="/teleconsult"  element={<Navigate to="/communication" replace />} />
      <Route path="/fournisseurs" element={<Navigate to="/stocks" replace />} />
      <Route path="/activite" element={<Navigate to="/analytiques" replace />} />
      <Route path="/agenda" element={
        <RequireAuth secretaryOk><AgendaPage /></RequireAuth>
      } />
      <Route path="/agenda/:apptId" element={
        <RequireAuth secretaryOk><AppointmentDetailPage /></RequireAuth>
      } />
      <Route path="/patients" element={
        <RequireAuth secretaryOk><PatientsPage /></RequireAuth>
      } />
      <Route path="/patients/:patientId" element={
        <RequireAuth secretaryOk><PatientDetailPage /></RequireAuth>
      } />
      <Route path="/rapport" element={
        <RequireAuth><ReportPage /></RequireAuth>
      } />
      <Route path="/comptabilite" element={
        <RequireAuth perm="viewFinances"><ComptabilitePage /></RequireAuth>
      } />
      <Route path="/optimisation" element={
        <RequireAuth><OptimisationPage /></RequireAuth>
      } />
      <Route path="/salaires" element={
        <RequireAuth perm="managePayroll"><PayrollPage /></RequireAuth>
      } />
      <Route path="/remboursements" element={
        <RequireAuth><RemboursementsPage /></RequireAuth>
      } />
      <Route path="/salle-attente" element={
        <RequireAuth secretaryOk><WaitingRoomPage /></RequireAuth>
      } />
      <Route path="/factures" element={
        <RequireAuth><FacturesPage /></RequireAuth>
      } />
      <Route path="/rappels" element={<Navigate to="/communication" replace />} />
      <Route path="/analytiques" element={<Navigate to="/rapports" replace />} />
      <Route path="/stocks" element={
        <RequireAuth perm="manageStock"><StocksSupplyPage /></RequireAuth>
      } />
      <Route path="/calculateurs" element={
        <RequireAuth perm="useCalculators"><CalculateursPage /></RequireAuth>
      } />
      <Route path="/messages" element={
        <RequireAuth><MessagesPage /></RequireAuth>
      } />
      <Route path="/teleconsult" element={
        <RequireAuth><TeleconsultPage /></RequireAuth>
      } />
      <Route path="/notes" element={
        <RequireAuth perm="useNotes"><NotesPage /></RequireAuth>
      } />
      <Route path="/fournisseurs" element={
        <RequireAuth><FournisseursPage /></RequireAuth>
      } />
      <Route path="/examens" element={
        <RequireAuth perm="viewClinical"><ExamensPage /></RequireAuth>
      } />
      <Route path="/ordonnances" element={
        <RequireAuth><OrdonancesPage /></RequireAuth>
      } />
      <Route path="/certificats" element={
        <RequireAuth><CertificatsPage /></RequireAuth>
      } />
      <Route path="/profil" element={
        <RequireAuth><ProfilePage /></RequireAuth>
      } />
      <Route path="/parametres" element={
        <RequireAuth><ParametresPage /></RequireAuth>
      } />
      <Route path="/aide" element={
        <RequireAuth secretaryOk><HelpPage /></RequireAuth>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
