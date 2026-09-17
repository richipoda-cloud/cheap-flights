import { Clock, Sparkles, House, Star, Search } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { COLORS } from "../theme/colors";

// Porta 1:1 la tab bar del progetto guardaroba (stessa pillola bianca fluttuante con
// "morso" ellittico e cerchio verde centrale che sporge sopra il bordo) — geometria e
// SVG copiati dal suo App.jsx (mask/path/percentuali identiche), semplificata a 5 voci
// SEMPRE fisse (niente rotazione dinamica né ricerca-a-comparsa: qui Cerca è già una
// sua schermata, non un campo testo). Cerchio centrale = Home (non un "+" contestuale).
const ITEMS = [
  { key: "history", label: "Storico", icon: Clock, path: "/history", cx: 11.01 },
  { key: "suggestions", label: "Suggeriti", icon: Sparkles, path: "/suggestions", cx: 28.72 },
  { key: "favorites", label: "Preferiti", icon: Star, path: "/favorites", cx: 71.55 },
  { key: "search", label: "Cerca", icon: Search, path: "/search", cx: 89.08 },
];

export function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: "max(16px, env(safe-area-inset-bottom))",
        height: 96,
        zIndex: 20,
      }}
    >
      <svg
        width="100%"
        height="116"
        viewBox="0 -50 328 116"
        preserveAspectRatio="none"
        style={{ position: "absolute", top: 0, left: 0, filter: "drop-shadow(0 4px 18px rgba(33,30,43,0.16))" }}
      >
        <defs>
          <mask id="tabbar-pill-mask">
            <path
              d="M 20 0 L 308 0 A 20 20 0 0 1 328 20 L 328 26 A 20 20 0 0 1 308 46 L 20 46 A 20 20 0 0 1 0 26 L 0 20 A 20 20 0 0 1 20 0 Z"
              fill="#fff"
            />
            <ellipse cx="164" cy="23" rx="35.46" ry="40" fill="#000" />
          </mask>
        </defs>
        <path
          d="M 20 0 L 308 0 A 20 20 0 0 1 328 20 L 328 26 A 20 20 0 0 1 308 46 L 20 46 A 20 20 0 0 1 0 26 L 0 20 A 20 20 0 0 1 20 0 Z"
          fill={COLORS.surface}
          mask="url(#tabbar-pill-mask)"
        />
      </svg>

      <div
        style={{
          position: "absolute",
          top: 41,
          left: "50%",
          transform: "translateX(-50%)",
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: COLORS.accent,
          pointerEvents: "none",
        }}
      />

      {ITEMS.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.key}
            onClick={() => navigate(item.path)}
            aria-label={item.label}
            style={{
              position: "absolute",
              top: 50,
              left: `${item.cx}%`,
              transform: "translateX(-50%)",
              height: 46,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              border: "none",
              cursor: "pointer",
              background: "none",
              padding: 0,
              WebkitTapHighlightColor: "transparent",
              outline: "none",
            }}
          >
            <item.icon size={17} color={isActive ? COLORS.accent : COLORS.inkSoft} strokeWidth={isActive ? 2.4 : 2} />
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 9,
                fontWeight: isActive ? 700 : 600,
                whiteSpace: "nowrap",
                color: isActive ? COLORS.accent : COLORS.inkSoft,
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}

      <button
        onClick={() => navigate("/")}
        aria-label="Home"
        style={{
          position: "absolute",
          top: 41,
          left: "50%",
          transform: "translateX(-50%)",
          width: 64,
          height: 64,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          border: "none",
          cursor: "pointer",
          background: "none",
          padding: 0,
          WebkitTapHighlightColor: "transparent",
          outline: "none",
        }}
      >
        <House size={19} color="#fff" strokeWidth={2.4} />
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, fontWeight: 700, color: "#fff" }}>Home</span>
      </button>
    </div>
  );
}
