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
      {/* paddingTop di sicurezza: da index.html la status bar è "black-translucent" (per
          far arrivare l'hero di Home fin sotto barra di stato/dynamic island, richiesto
          esplicitamente), quindi su iOS TUTTE le pagine ora disegnano fin sotto quella
          barra — senza questo padding qui, titoli/contenuti di Cerca/Risultati/ecc.
          finirebbero nascosti sotto barra di stato e dynamic island. Home compensa questo
          stesso valore con un margin-top negativo sul proprio hero (vedi Home.jsx), così
          resta l'unica pagina che arriva davvero in cima. */}
      <div style={{ minHeight: "100vh", background: COLORS.bg, paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <AppRoutes />
      </div>
    </BrowserRouter>
  );
}
