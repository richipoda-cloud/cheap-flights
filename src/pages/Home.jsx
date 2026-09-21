import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Card } from "../components/Card";
import { COLORS, RADIUS } from "../theme/colors";
import { useAuth } from "../hooks/useAuth";
import { useFavorites } from "../hooks/useFavorites";
import { useSearches } from "../hooks/useSearches";
import { useSuggestions } from "../hooks/useSuggestions";
import { destinationName } from "../lib/countryNames";
import { formatRelativeTime } from "../lib/formatters";

// Foto Islanda (altopiano di Landmannalaugar, rioliti verdi/rosse con chiazze di neve) via
// Unsplash CDN con resize on-the-fly — sostituita il 21/09/2026: la prima scelta (e quella
// proposta in una patch esterna con richiesta di riordino/theme-color, la cui firma
// "Claude"/sessione erano false, MAI verificate da me — vedi anche l'episodio simile con
// la patch fase2 homepage-fallback) risultava, aperta dal vivo, una foto di tutt'altro
// soggetto (interno di una tenda da campeggio) nonostante la descrizione dicesse Islanda.
// Questa è stata cercata e aperta dal vivo io stesso su unsplash.com/s/photos/landmannalaugar
// prima di usarla — Unsplash License, uso libero anche commerciale. w=1200/q=80/dpr=2 per
// restare nitida sugli schermi ad alta densità (era sfocata con la risoluzione precedente).
const HERO_IMAGE_URL =
  "https://images.unsplash.com/photo-1518413380322-fc82a14756f0?auto=format&fit=crop&w=1200&q=80&dpr=2";

// Altezza della fascia hero in quota di viewport (non px fisso) per sfruttare meglio lo
// schermo su dispositivi diversi mantenendo la stessa proporzione.
const HERO_HEIGHT_VH = 34;

// Riassunto compatto dell'ultima ricerca salvata (tabella `searches`, non i filtri
// "sticky" del form che cambiano ad ogni modifica) — usato come sottotitolo della card
// Cerca voli al posto del testo generico, solo se l'utente ha già cercato qualcosa.
function describeLastSearch(filters) {
  if (!filters) return null;
  const dest = filters.destination ? destinationName(filters.destination) : "Ovunque";
  const dateLabel = filters.dateMode === "fixed" ? "Date fisse" : "Sempre";
  const nights =
    filters.nightsMin != null || filters.nightsMax != null
      ? `${filters.nightsMin ?? 0}-${filters.nightsMax ?? "∞"} notti`
      : null;
  // Sempre almeno destinazione + date, altrimenti con una ricerca "Ovunque" senza
  // limite di notti mostrava solo "Ovunque" da solo — troppo povero come sottotitolo.
  return [dest, nights, dateLabel].filter(Boolean).join(" · ");
}

function SearchCard({ onClick, subtitle, lastSearchAt, onRepeat }) {
  return (
    <Card
      onClick={onClick}
      style={{
        padding: 18,
        background: COLORS.accent,
        border: "none",
        boxShadow: "0 4px 16px rgba(33,30,43,0.22)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
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
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <span>🕐</span>
            <span>{subtitle}</span>
          </div>
        </div>
        <ChevronRight size={24} color="rgba(255,255,255,0.85)" style={{ flexShrink: 0 }} />
      </div>

      {lastSearchAt && (
        <>
          <div style={{ height: 1, background: "rgba(255,255,255,0.25)", margin: "14px 0 12px" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
              Ultima ricerca: {formatRelativeTime(lastSearchAt)}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRepeat();
              }}
              style={{
                border: "none",
                background: "rgba(255,255,255,0.2)",
                color: "#FFFFFF",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: RADIUS.pill,
                padding: "6px 12px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              ↻ Ripeti
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

// Icona a sinistra del titolo (non più sopra, richiesto esplicitamente dall'utente) ma il
// sottotitolo resta su una riga propria a piena larghezza sotto — non condivide la riga con
// icona/freccia, altrimenti nelle due card strette (Preferiti/Storico) tornerebbe a
// troncarsi con "…" come nella versione precedente a quella verticale.
function SmallCard({ icon, title, subtitle, onClick }) {
  return (
    <Card onClick={onClick} style={{ padding: 15 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{icon}</div>
        <div style={{ fontWeight: 600, fontSize: 17, color: COLORS.ink, flex: 1, minWidth: 0 }}>{title}</div>
        <ChevronRight size={21} color={COLORS.inkSoft} style={{ flexShrink: 0 }} />
      </div>
      {subtitle && (
        <div style={{ fontSize: 13.5, color: COLORS.inkSoft, marginTop: 6 }}>{subtitle}</div>
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
  const lastSearch = searches[0];
  const lastSearchSubtitle = describeLastSearch(lastSearch?.filters) ?? "Ovunque · Sempre · Filtri";
  const repeatLastSearch = () => navigate("/results", { state: { filters: lastSearch.filters } });

  const suggestSubtitle =
    suggestions.topOrigins.length > 0
      ? `${suggestions.topOrigins[0]} · ${suggestions.topNights ? `viaggi di ${suggestions.topNights} notti` : "weekend brevi"} · in base alle tue ricerche`
      : "In base alle tue ricerche passate";

  // La fascia hero arriva fin sotto la status bar (env(safe-area-inset-top), niente
  // fascia dello sfondo pagina visibile sopra su iOS) — per non stonare col cielo chiaro
  // della foto, il theme-color della PWA (colore della status bar di sistema su Android)
  // viene schiarito solo per la durata di questa schermata, e ripristinato all'uscita per
  // non toccare le altre.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const previous = meta?.getAttribute("content");
    meta?.setAttribute("content", "#C9CCC0");
    return () => {
      if (previous != null) meta?.setAttribute("content", previous);
    };
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Hero con foto Islanda: taglio netto verso il pannello sotto (niente angoli
          stondati), estesa fin sotto la status bar e alta HERO_HEIGHT_VH invece di un
          valore in px fisso, per sfruttare meglio lo schermo. */}
      <div
        style={{
          height: `calc(${HERO_HEIGHT_VH}vh + env(safe-area-inset-top, 0px))`,
          marginTop: "calc(-1 * env(safe-area-inset-top, 0px))",
          flexShrink: 0,
          backgroundImage: `url(${HERO_IMAGE_URL})`,
          backgroundSize: "cover",
          backgroundPosition: "center 55%",
        }}
      />
      <div
        style={{
          flex: 1,
          background: COLORS.bg,
          padding: "24px 20px 20px",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontWeight: 600, fontSize: 28, color: COLORS.ink }}>Ciao 👋</div>
            <div style={{ fontSize: 16, color: COLORS.inkSoft, marginTop: 2 }}>Dove ti va di andare?</div>
          </div>
          <SearchCard
            onClick={() => navigate("/search")}
            subtitle={lastSearchSubtitle}
            lastSearchAt={lastSearch?.created_at}
            onRepeat={repeatLastSearch}
          />

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
    </div>
  );
}
