import { Navigate, Route, Routes } from "react-router-dom";
import { useApp } from "./context/AppContext";
import { AuthPage }         from "./pages/AuthPage";
import { DashboardPage }    from "./pages/DashboardPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { ExplainPage }      from "./pages/ExplainPage";
import { ProfilePage }      from "./pages/ProfilePage";
import { AgendaPage }            from "./pages/AgendaPage";
import { AppointmentDetailPage } from "./pages/AppointmentDetailPage";
import { PatientsPage }          from "./pages/PatientsPage";
import { PatientDetailPage }     from "./pages/PatientDetailPage";
import { StatsPage }             from "./pages/StatsPage";
import { PayrollPage }           from "./pages/PayrollPage";
import { RemboursementsPage }    from "./pages/RemboursementsPage";
import { WaitingRoomPage }       from "./pages/WaitingRoomPage";
import { FacturesPage }         from "./pages/FacturesPage";
import { RappelsPage }          from "./pages/RappelsPage";
import { AnalytiquesPage }      from "./pages/AnalytiquesPage";
import { StockPage }            from "./pages/StockPage";
import { CalculateursPage }     from "./pages/CalculateursPage";
import { MessagesPage }         from "./pages/MessagesPage";
import { TeleconsultPage }      from "./pages/TeleconsultPage";
import { ReportPage }            from "./pages/ReportPage";
import { ComptabilitePage }      from "./pages/ComptabilitePage";
import { OptimisationPage }      from "./pages/OptimisationPage";
import { ParametresPage }        from "./pages/ParametresPage";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated } = useApp();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/" element={
        <RequireAuth><DashboardPage /></RequireAuth>
      } />
      <Route path="/transactions" element={
        <RequireAuth><TransactionsPage /></RequireAuth>
      } />
      <Route path="/expliquer" element={
        <RequireAuth><ExplainPage /></RequireAuth>
      } />
      <Route path="/activite" element={
        <RequireAuth><StatsPage /></RequireAuth>
      } />
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
        <RequireAuth><StockPage /></RequireAuth>
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
      <Route path="/profil" element={
        <RequireAuth><ProfilePage /></RequireAuth>
      } />
      <Route path="/parametres" element={
        <RequireAuth><ParametresPage /></RequireAuth>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
