import { Navigate, Route, Routes } from "react-router-dom";
import { useState } from "react";
import { useApp } from "./context/AppContext";
import { useCabinet } from "./context/CabinetContext";
import { OnboardingWizard } from "./pages/OnboardingWizard";
import { AuthPage }              from "./pages/AuthPage";
import { DashboardPage }         from "./pages/DashboardPage";
import { TransactionsPage }      from "./pages/TransactionsPage";
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
import { RappelsPage }           from "./pages/RappelsPage";
import { AnalytiquesPage }       from "./pages/AnalytiquesPage";
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

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useApp();
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

export function App() {
  return (
    <>
    <OnboardingGate />
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/" element={
        <RequireAuth><DashboardPage /></RequireAuth>
      } />
      <Route path="/transactions" element={
        <RequireAuth><TransactionsPage /></RequireAuth>
      } />
      {/* ── Combined pages (new primary routes) ── */}
      <Route path="/documents" element={
        <RequireAuth><DocumentsPage /></RequireAuth>
      } />
      <Route path="/communication" element={
        <RequireAuth><CommunicationPage /></RequireAuth>
      } />
      <Route path="/rapports" element={
        <RequireAuth><RapportsPage /></RequireAuth>
      } />
      <Route path="/facturation" element={
        <RequireAuth><FacturationPage /></RequireAuth>
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
      <Route path="/profil"       element={<Navigate to="/parametres" replace />} />
      <Route path="/activite" element={<Navigate to="/analytiques" replace />} />
      <Route path="/agenda" element={
        <RequireAuth><AgendaPage /></RequireAuth>
      } />
      <Route path="/agenda/:apptId" element={
        <RequireAuth><AppointmentDetailPage /></RequireAuth>
      } />
      <Route path="/patients" element={
        <RequireAuth><PatientsPage /></RequireAuth>
      } />
      <Route path="/patients/:patientId" element={
        <RequireAuth><PatientDetailPage /></RequireAuth>
      } />
      <Route path="/rapport" element={
        <RequireAuth><ReportPage /></RequireAuth>
      } />
      <Route path="/comptabilite" element={
        <RequireAuth><ComptabilitePage /></RequireAuth>
      } />
      <Route path="/optimisation" element={
        <RequireAuth><OptimisationPage /></RequireAuth>
      } />
      <Route path="/salaires" element={
        <RequireAuth><PayrollPage /></RequireAuth>
      } />
      <Route path="/remboursements" element={
        <RequireAuth><RemboursementsPage /></RequireAuth>
      } />
      <Route path="/salle-attente" element={
        <RequireAuth><WaitingRoomPage /></RequireAuth>
      } />
      <Route path="/factures" element={
        <RequireAuth><FacturesPage /></RequireAuth>
      } />
      <Route path="/rappels" element={
        <RequireAuth><RappelsPage /></RequireAuth>
      } />
      <Route path="/analytiques" element={
        <RequireAuth><AnalytiquesPage /></RequireAuth>
      } />
      <Route path="/stocks" element={
        <RequireAuth><StocksSupplyPage /></RequireAuth>
      } />
      <Route path="/calculateurs" element={
        <RequireAuth><CalculateursPage /></RequireAuth>
      } />
      <Route path="/messages" element={
        <RequireAuth><MessagesPage /></RequireAuth>
      } />
      <Route path="/teleconsult" element={
        <RequireAuth><TeleconsultPage /></RequireAuth>
      } />
      <Route path="/notes" element={
        <RequireAuth><NotesPage /></RequireAuth>
      } />
      <Route path="/fournisseurs" element={
        <RequireAuth><FournisseursPage /></RequireAuth>
      } />
      <Route path="/examens" element={
        <RequireAuth><ExamensPage /></RequireAuth>
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
