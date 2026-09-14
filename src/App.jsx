import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { COLORS } from "./theme/colors";
import { useAuth } from "./hooks/useAuth";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { Search } from "./pages/Search";
import { Results } from "./pages/Results";
import { FlightDetail } from "./pages/FlightDetail";
import { Favorites } from "./pages/Favorites";
import { History } from "./pages/History";
import { Suggestions } from "./pages/Suggestions";

export default function App() {
  const { user, loading } = useAuth();

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
      </div>
    </BrowserRouter>
  );
}
