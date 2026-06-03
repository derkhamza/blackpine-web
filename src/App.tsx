import { Navigate, Route, Routes } from "react-router-dom";
import { useApp } from "./context/AppContext";
import { AuthPage }         from "./pages/AuthPage";
import { DashboardPage }    from "./pages/DashboardPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { ExplainPage }      from "./pages/ExplainPage";
import { ProfilePage }      from "./pages/ProfilePage";

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
      <Route path="/profil" element={
        <RequireAuth><ProfilePage /></RequireAuth>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
