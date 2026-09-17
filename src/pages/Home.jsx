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
        padding: 14,
        background: COLORS.accent,
        border: "none",
        boxShadow: "0 4px 16px rgba(33,30,43,0.22)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div style={{ fontSize: 24, lineHeight: 1 }}>🔍</div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 17, color: "#FFFFFF" }}>Cerca voli</div>
        <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.85)" }}>Ovunque · Sempre · Filtri</div>
      </div>
    </Card>
  );
}

function SmallCard({ icon, title, subtitle, onClick }) {
  return (
    <Card onClick={onClick} style={{ padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ fontSize: 18, lineHeight: 1 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14.5, color: COLORS.ink }}>{title}</div>
        {subtitle && (
          <div
            style={{
              fontSize: 11.5,
              color: COLORS.inkSoft,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
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
    <div style={{ padding: 20, minHeight: "100vh" }}>
      <div style={{ width: "100%", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontWeight: 600, fontSize: 24, color: COLORS.ink }}>Ciao 👋</div>
          <div style={{ fontSize: 14, color: COLORS.inkSoft, marginTop: 2 }}>Dove ti va di andare?</div>
        </div>
        <SearchCard onClick={() => navigate("/search")} />

        <div style={{ display: "flex", gap: 10 }}>
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

        <SmallCard icon="✨" title="Suggeriti per te" subtitle={suggestSubtitle} onClick={() => navigate("/suggestions")} />
      </div>
    </div>
  );
}
