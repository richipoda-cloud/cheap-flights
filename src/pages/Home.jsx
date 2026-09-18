import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Card } from "../components/Card";
import { COLORS, RADIUS } from "../theme/colors";
import { useAuth } from "../hooks/useAuth";
import { useFavorites } from "../hooks/useFavorites";
import { useSearches } from "../hooks/useSearches";
import { useSuggestions } from "../hooks/useSuggestions";
import { cityName } from "../lib/cityNames";

// Riassunto compatto dell'ultima ricerca salvata (tabella `searches`, non i filtri
// "sticky" del form che cambiano ad ogni modifica) — usato come sottotitolo della card
// Cerca voli al posto del testo generico, solo se l'utente ha già cercato qualcosa.
function describeLastSearch(filters) {
  if (!filters) return null;
  const dest = filters.destination ? cityName(filters.destination) : "Ovunque";
  if (filters.nightsMin == null && filters.nightsMax == null) return dest;
  return `${dest} · ${filters.nightsMin ?? 0}-${filters.nightsMax ?? "∞"} notti`;
}

function SearchCard({ onClick, subtitle }) {
  return (
    <Card
      onClick={onClick}
      style={{
        padding: 18,
        background: COLORS.accent,
        border: "none",
        boxShadow: "0 4px 16px rgba(33,30,43,0.22)",
        display: "flex",
        alignItems: "center",
        gap: 15,
      }}
    >
      <div style={{ fontSize: 29, lineHeight: 1 }}>🔍</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 20, color: "#FFFFFF" }}>Cerca voli</div>
        <div
          style={{
            fontSize: 15,
            color: "rgba(255,255,255,0.85)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {subtitle}
        </div>
      </div>
      <ChevronRight size={24} color="rgba(255,255,255,0.85)" style={{ flexShrink: 0 }} />
    </Card>
  );
}

// Verticale (icona+freccia sopra, titolo e sottotitolo sotto su riga propria) invece di
// tutto affiancato: nelle due card strette (Preferiti/Storico) l'orizzontale troncava il
// sottotitolo con "…" — qui ha sempre tutta la larghezza della card a disposizione.
function SmallCard({ icon, title, subtitle, onClick }) {
  return (
    <Card onClick={onClick} style={{ padding: 15 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 22, lineHeight: 1 }}>{icon}</div>
        <ChevronRight size={21} color={COLORS.inkSoft} style={{ flexShrink: 0 }} />
      </div>
      <div style={{ fontWeight: 600, fontSize: 17, color: COLORS.ink, marginTop: 8 }}>{title}</div>
      {subtitle && (
        <div style={{ fontSize: 13.5, color: COLORS.inkSoft, marginTop: 2 }}>{subtitle}</div>
      )}
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
  const lastSearchSubtitle = describeLastSearch(searches[0]?.filters) ?? "Ovunque · Sempre · Filtri";

  const suggestSubtitle =
    suggestions.topOrigins.length > 0
      ? `${suggestions.topOrigins[0]} · ${suggestions.topNights ? `viaggi di ${suggestions.topNights} notti` : "weekend brevi"} · in base alle tue ricerche`
      : "In base alle tue ricerche passate";

  return (
    <div style={{ padding: 20, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontWeight: 600, fontSize: 28, color: COLORS.ink }}>Ciao 👋</div>
          <div style={{ fontSize: 16, color: COLORS.inkSoft, marginTop: 2 }}>Dove ti va di andare?</div>
        </div>
        <SearchCard onClick={() => navigate("/search")} subtitle={lastSearchSubtitle} />

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <SmallCard
              icon="⭐"
              title="Preferiti"
              subtitle={favCount > 0 ? `${favCount} rott${favCount === 1 ? "a" : "e"} salvat${favCount === 1 ? "a" : "e"}` : null}
              onClick={() => navigate("/favorites")}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
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
