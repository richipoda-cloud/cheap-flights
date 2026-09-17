import { useNavigate } from "react-router-dom";
import { Card } from "../components/Card";
import { COLORS, RADIUS } from "../theme/colors";
import { useAuth } from "../hooks/useAuth";
import { useFavorites } from "../hooks/useFavorites";
import { useSearches } from "../hooks/useSearches";
import { useSuggestions } from "../hooks/useSuggestions";

function SearchCard({ onClick }) {
  return (
    <Card
      onClick={onClick}
      style={{
        padding: 16,
        background: COLORS.accent,
        border: "none",
        boxShadow: "0 4px 16px rgba(33,30,43,0.22)",
      }}
    >
      <div style={{ fontSize: 26, lineHeight: 1, marginBottom: 4 }}>🔍</div>
      <div style={{ fontWeight: 600, fontSize: 20, color: "#FFFFFF", marginBottom: 2 }}>
        Cerca voli
      </div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>Ovunque · Sempre · Filtri</div>
    </Card>
  );
}

function SmallCard({ icon, title, subtitle, onClick }) {
  return (
    <Card onClick={onClick} style={{ padding: 14 }}>
      <div style={{ fontSize: 20, lineHeight: 1, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontWeight: 600, fontSize: 16, color: COLORS.ink, marginBottom: 2 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: COLORS.inkSoft }}>{subtitle}</div>}
    </Card>
  );
}

export function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { favorites } = useFavorites(user?.id);
  const { searches } = useSearches(user?.id);
  const { suggestions } = useSuggestions(user?.id);

  const favCount = favorites.length;
  const searchCount = searches.length;

  const suggestSubtitle =
    suggestions.topOrigins.length > 0
      ? `${suggestions.topOrigins[0]} · ${suggestions.topNights ? `viaggi di ${suggestions.topNights} notti` : "weekend brevi"} · in base alle tue ricerche`
      : "In base alle tue ricerche passate";

  return (
    <div style={{ padding: 20, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontWeight: 600, fontSize: 24, color: COLORS.ink }}>Ciao 👋</div>
          <div style={{ fontSize: 14, color: COLORS.inkSoft, marginTop: 2 }}>Dove ti va di andare?</div>
        </div>
        <SearchCard onClick={() => navigate("/search")} />

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <SmallCard
              icon="⭐"
              title="Preferiti"
              subtitle={favCount > 0 ? `${favCount} rott${favCount === 1 ? "a" : "e"} salvat${favCount === 1 ? "a" : "e"}` : null}
              onClick={() => navigate("/favorites")}
            />
          </div>
          <div style={{ flex: 1 }}>
            <SmallCard
              icon="🕐"
              title="Storico"
              subtitle={searchCount > 0 ? `${searchCount} ricerch${searchCount === 1 ? "a" : "e"}` : null}
              onClick={() => navigate("/history")}
            />
          </div>
        </div>

        <Card onClick={() => navigate("/suggestions")} style={{ padding: 16 }}>
          <div style={{ fontSize: 22, lineHeight: 1, marginBottom: 4 }}>✨</div>
          <div style={{ fontWeight: 600, fontSize: 20, color: COLORS.ink, marginBottom: 2 }}>
            Suggeriti per te
          </div>
          <div style={{ fontSize: 13, color: COLORS.inkSoft }}>{suggestSubtitle}</div>
        </Card>
      </div>
    </div>
  );
}
