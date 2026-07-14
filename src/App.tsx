import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { trackPage } from "./lib/analytics";
import { useApp } from "./context/AppContext";
import { useCabinet } from "./context/CabinetContext";
import type { SecretaryPermissions } from "./lib/cabinetTypes";
import { DEFAULT_SECRETARY_PERMISSIONS } from "./lib/cabinetTypes";
import { isAdminEmail } from "./lib/owner";
import { OnboardingWizard } from "./pages/OnboardingWizard";
import { WelcomeTour, hasSeenTour } from "./components/WelcomeTour";
import { SignalBus } from "./components/SignalBus";
import { CalledPatientsBanner } from "./components/CalledPatientsBanner";
import { CabinetChat } from "./components/CabinetChat";
import { WhatsNew } from "./components/WhatsNew";
import { LockScreen } from "./components/LockScreen";
import { hasAppLock, isUnlocked } from "./lib/appLock";
import { HelpPage }              from "./pages/HelpPage";
import { AuthPage }              from "./pages/AuthPage";
import { BookingPage }           from "./pages/BookingPage";
import { DeleteAccountPage }     from "./pages/DeleteAccountPage";
import { AdminPage }             from "./pages/AdminPage";
import { DashboardPage }         from "./pages/DashboardPage";
import { SecretaryDashboardPage } from "./pages/SecretaryDashboardPage";
import { ProfilePage }           from "./pages/ProfilePage";
import { AgendaPage }            from "./pages/AgendaPage";
import { AppointmentDetailPage } from "./pages/AppointmentDetailPage";
import { PatientsPage }          from "./pages/PatientsPage";
import { PatientDetailPage }     from "./pages/PatientDetailPage";
import { PayrollPage }           from "./pages/PayrollPage";
import { WaitingRoomPage }       from "./pages/WaitingRoomPage";
import { StocksSupplyPage }      from "./pages/StocksSupplyPage";
import { CalculateursPage }      from "./pages/CalculateursPage";
import { NotesPage }             from "./pages/NotesPage";
import { ExamensPage }           from "./pages/ExamensPage";
import { ComptabilitePage }      from "./pages/ComptabilitePage";
import { ParametresPage }        from "./pages/ParametresPage";
// ── Combined/merged pages (each hosts the former standalone pages as tabs;
//    the old standalone routes now redirect here, so they aren't imported) ────
import { DocumentsPage }         from "./pages/DocumentsPage";
import { CommunicationPage }     from "./pages/CommunicationPage";
import { RapportsPage }          from "./pages/RapportsPage";
import { FacturationPage }       from "./pages/FacturationPage";

function RequireAuth({ children, secretaryOk = false, perm, adminOk = false }: {
  children: JSX.Element;
  secretaryOk?: boolean;
  perm?: keyof SecretaryPermissions;
  adminOk?: boolean;
}) {
  const { isAuthenticated, isSecretary, user } = useApp();
  const { doctorProfile } = useCabinet();
  // A secretary may only reach explicitly-allowed routes; everything else
  // bounces them to their home (the agenda). Routes flagged with a `perm` are
  // additionally gated on the granular permission the doctor granted.
  if (isSecretary) {
    if (!secretaryOk && !perm) return <Navigate to="/agenda" replace />;
    if (perm) {
      // Merge with defaults so keys added later (viewExams, manageStock…) grant the
      // new front-desk access unless the doctor explicitly turned them off.
      const perms = { ...DEFAULT_SECRETARY_PERMISSIONS, ...(doctorProfile.secretaryPermissions ?? {}) };
      if (!perms[perm]) return <Navigate to="/agenda" replace />;
    }
    return children;
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Product-owner accounts get a PURE admin console: every clinical route folds
  // back to /admin. Only routes explicitly flagged adminOk (the console itself)
  // are reachable. Keeps the operator login free of clinical clutter.
  if (isAdminEmail(user?.email) && !adminOk) return <Navigate to="/admin" replace />;
  return children;
}

// The "/" landing: a real secretary — AND a doctor previewing the secretary view
// — get the focused secretary dashboard; the doctor's own login gets the full
// clinical dashboard. Rendering the secretary dashboard in preview keeps the
// preview faithful (and lets "Tableau de bord" be a real tab in both).
function HomeDashboard() {
  const { isSecretary } = useApp();
  const { secretaryMode } = useCabinet();
  return (isSecretary || secretaryMode) ? <SecretaryDashboardPage /> : <DashboardPage />;
}

function OnboardingGate() {
  const { isAuthenticated, isSecretary } = useApp();
  const { doctorProfile, lastSynced } = useCabinet();
  const [dismissed, setDismissed] = useState(false);

  const alreadyDone = !!localStorage.getItem("bp.onboarded");
  // Only decide AFTER the initial sync has landed (lastSynced set): before that,
  // an existing user's profile hasn't loaded yet and doctorProfile.fullName is
  // transiently empty — showing onboarding then makes it flash for returning
  // users on a fresh device. A genuinely new account syncs an empty snapshot,
  // so fullName stays empty and onboarding still appears for them.
  const needsOnboarding =
    isAuthenticated &&
    !isSecretary &&
    !alreadyDone &&
    !dismissed &&
    lastSynced != null &&
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
  const variant = isSecretary ? "secretary" : "doctor";

  useEffect(() => {
    const reopen = () => { setForced(true); setOpen(true); };
    window.addEventListener("bp:open-tour", reopen);
    return () => window.removeEventListener("bp:open-tour", reopen);
  }, []);

  useEffect(() => {
    if (forced) return;
    if (!isAuthenticated || hasSeenTour(variant)) return;
    // Doctor: wait until the profile is set up (so it follows the profile
    // wizard). Secretary: show right away — they don't own a profile.
    if (isSecretary || !!doctorProfile.fullName) setOpen(true);
  }, [isAuthenticated, isSecretary, variant, doctorProfile.fullName, forced]);

  return <WelcomeTour open={open} variant={variant} onClose={() => { setOpen(false); setForced(false); }} />;
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
  const { user, isSecretary, isAuthenticated } = useApp();
  // App-lock gate: an authenticated user who set a PIN must unlock before any
  // clinical data renders (guards an unattended / shared device on reload).
  const [locked, setLocked] = useState(() => hasAppLock() && !isUnlocked());
  // Product-owner accounts run a pure admin console — none of the clinical
  // overlays (onboarding wizard, feature tour, doctor↔secretary signals & chat)
  // apply to them.
  const isAdmin = !isSecretary && isAdminEmail(user?.email);
  if (isAuthenticated && locked) return <LockScreen onUnlock={() => setLocked(false)} />;
  return (
    <>
    <RouteTracker />
    <ModalDragGuard />
    {!isAdmin && <OnboardingGate />}
    {!isAdmin && <TourGate />}
    {!isAdmin && <SignalBus />}
    {!isAdmin && <CalledPatientsBanner />}
    {!isAdmin && <CabinetChat />}
    {!isAdmin && <WhatsNew />}
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      {/* Public patient self-booking — no auth */}
      <Route path="/book/:slug" element={<BookingPage />} />
      {/* Public account-deletion page — reachable without the app (Play / GDPR) */}
      <Route path="/supprimer-compte" element={<DeleteAccountPage />} />
      <Route path="/delete-account"   element={<DeleteAccountPage />} />
      <Route path="/" element={
        <RequireAuth secretaryOk><HomeDashboard /></RequireAuth>
      } />
      <Route path="/transactions" element={<Navigate to="/facturation" replace />} />
      <Route path="/admin" element={
        <RequireAuth adminOk><AdminPage /></RequireAuth>
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
      <Route path="/comptabilite" element={
        <RequireAuth perm="viewFinances"><ComptabilitePage /></RequireAuth>
      } />
      <Route path="/salaires" element={
        <RequireAuth perm="managePayroll"><PayrollPage /></RequireAuth>
      } />
      <Route path="/salle-attente" element={
        <RequireAuth secretaryOk><WaitingRoomPage /></RequireAuth>
      } />
      <Route path="/rappels" element={<Navigate to="/communication" replace />} />
      <Route path="/analytiques" element={
        <RequireAuth perm="viewFinances"><RapportsPage initialTab="analytiques" /></RequireAuth>
      } />
      <Route path="/stocks" element={
        <RequireAuth perm="manageStock"><StocksSupplyPage /></RequireAuth>
      } />
      <Route path="/calculateurs" element={
        <RequireAuth perm="useCalculators"><CalculateursPage /></RequireAuth>
      } />
      <Route path="/notes" element={
        <RequireAuth perm="useNotes"><NotesPage /></RequireAuth>
      } />
      <Route path="/examens" element={
        <RequireAuth perm="viewExams"><ExamensPage /></RequireAuth>
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
