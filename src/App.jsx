import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { COLORS } from "./theme/colors";
import { isSupabaseConfigured } from "./lib/supabaseClient";
import { useAuth } from "./hooks/useAuth";
import { Login } from "./pages/Login";
import { SetupNeeded } from "./pages/SetupNeeded";
import { Home } from "./pages/Home";
import { Search } from "./pages/Search";
import { Results } from "./pages/Results";
import { FlightDetail } from "./pages/FlightDetail";
import { Favorites } from "./pages/Favorites";
import { History } from "./pages/History";
import { Suggestions } from "./pages/Suggestions";
import { TabBar } from "./components/TabBar";

function AppRoutes() {
  const location = useLocation();
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/results" element={<Results />} />
        <Route path="/flight" element={<FlightDetail />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/history" element={<History />} />
        <Route path="/suggestions" element={<Suggestions />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {location.pathname !== "/" && <TabBar />}
    </>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (!isSupabaseConfigured) return <SetupNeeded />;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: COLORS.inkSoft }}>Caricamento…</div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <BrowserRouter>
      <div style={{ minHeight: "100vh", background: COLORS.bg }}>
        <AppRoutes />
      </div>
    </BrowserRouter>
  );
}
