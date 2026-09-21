import { useEffect, useRef } from "react";
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

// Foto Islanda via Unsplash CDN con resize on-the-fly — sostituita di nuovo il 21/09/2026
// su richiesta esplicita dell'utente ("più verde"): la versione precedente (rioliti di
// Landmannalaugar, toni bruno/rossi) era corretta come soggetto ma poco verde. Questa è
// una valle glaciale muschiosa con fiume, cercata e aperta dal vivo io stesso su
// unsplash.com/s/photos/iceland-moss-mountains, controllando che fosse gratuita (prefisso
// "photo-", non "premium_photo-" = Unsplash+, non usabile senza abbonamento) prima di
// sceglierla. w=1200/q=80/dpr=2 per restare nitida sugli schermi ad alta densità.
const HERO_IMAGE_URL =
  "https://images.unsplash.com/photo-1530295314625-30d3b777ac7a?auto=format&fit=crop&w=1200&q=80&dpr=2";

// Altezza della fascia hero in quota di viewport (non px fisso) — alzata da 34 a 46, poi
// 58 e ora 66 su richiesta esplicita dell'utente ("allunga la foto", non "sposta le
// card"): con la card di ricerca dentro la foto (vetro smerigliato) e solo 3 card sotto
// (ancorate subito sotto, niente centraggio), una foto più alta lascia meno spazio vuoto
// reale nella sezione sotto su schermi comuni, invece di limitarsi a ridistribuirlo.
const HERO_HEIGHT_VH = 66;

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

// Sfondo "vetro smerigliato" (translucido + blur di quel che c'è dietro) invece del
// riquadro verde pieno di prima — richiesto esplicitamente dall'utente per poter
// sovrapporre la card alla foto hero senza coprirla con un pannello opaco. Testo già
// bianco/bianco trasparente (pensato per leggersi sul verde accent) resta leggibile
// invariato anche sul vetro, complice la sfumatura scura sotto la foto (vedi Home()).
function SearchCard({ onClick, subtitle, lastSearchAt, onRepeat }) {
  return (
    <Card
      onClick={onClick}
      style={{
        padding: 18,
        background: "rgba(255,255,255,0.16)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        border: "1px solid rgba(255,255,255,0.35)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
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

  // In Safari con l'indirizzo digitato (non installata in Home) la barra di stato/URL
  // resta sempre opaca sopra la pagina — nessun sito può davvero disegnarci sotto, quindi
  // qui è solo un trucco visivo: si tinge quella barra (theme-color, che Safari iOS legge
  // anche in tab normale, non solo da installata) con lo stesso azzurro del cielo in cima
  // alla foto, campionato dal pixel reale dell'immagine (rgb 115,168,217 = #73A8D9, non a
  // occhio) così la barra sembra continuare la foto invece di tagliarla con una fascia
  // verde. Da installata in Home il fix vero (index.html, status bar black-translucent)
  // fa già disegnare la foto sotto la barra per davvero, questo qui non serve né disturba.
  //
  // Segnalato dall'utente: scorrendo oltre la foto (46vh) la barra tornava verde, ma un
  // verde SBAGLIATO — "#6E7F5C" (l'accento scuro dei bottoni, valore di default in
  // index.html) invece del vero sfondo pagina COLORS.bg ("#DBE4CC", più chiaro) che a quel
  // punto è davvero quello che si vede in cima. Prima si tingeva solo una volta al mount,
  // ora segue lo scroll con IntersectionObserver sull'hero: azzurro finché è visibile,
  // COLORS.bg appena esce dallo schermo — sempre il colore vero di quel che c'è in cima.
  const heroRef = useRef(null);
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const previous = meta?.getAttribute("content");
    const setColor = (visible) => meta?.setAttribute("content", visible ? "#73A8D9" : COLORS.bg);
    setColor(true);

    const el = heroRef.current;
    const observer = el
      ? new IntersectionObserver(([entry]) => setColor(entry.isIntersecting), { threshold: 0 })
      : null;
    if (el && observer) observer.observe(el);

    return () => {
      observer?.disconnect();
      if (previous != null) meta?.setAttribute("content", previous);
    };
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Hero con foto Islanda: taglio netto verso il pannello sotto (niente angoli
          stondati), estesa fin sotto la status bar e alta HERO_HEIGHT_VH invece di un
          valore in px fisso, per sfruttare meglio lo schermo. position:relative per
          sovrapporre saluto + card "Cerca voli" (vetro smerigliato) alla foto stessa,
          invece di stare sotto in un riquadro separato — richiesto esplicitamente
          dall'utente. */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div
          ref={heroRef}
          style={{
            height: `calc(${HERO_HEIGHT_VH}vh + env(safe-area-inset-top, 0px))`,
            marginTop: "calc(-1 * env(safe-area-inset-top, 0px))",
            backgroundImage: `url(${HERO_IMAGE_URL})`,
            backgroundSize: "cover",
            backgroundPosition: "center 55%",
          }}
        />
        {/* Sfumatura scura in alto (per il saluto) e in basso (per la card): senza, testo
            e card in bianco/vetro si leggerebbero male su un cielo chiaro come questo. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: "35%",
            background: "linear-gradient(to top, rgba(0,0,0,0) 0%, rgba(0,0,0,0.4) 100%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "55%",
            background: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 100%)",
            pointerEvents: "none",
          }}
        />
        {/* Saluto portato in cima alla foto (non più sopra la card in fondo), richiesto
            esplicitamente dall'utente — padding-top con la safe-area cosicché non finisca
            sotto la status bar/dynamic island quando l'app è installata in Home. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div style={{ width: "100%", maxWidth: 520, padding: "0 20px" }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 22,
                color: "#FFFFFF",
                textShadow: "0 1px 6px rgba(0,0,0,0.35)",
                whiteSpace: "nowrap",
              }}
            >
              ✈️ Dove ti va di andare?
            </div>
          </div>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 24, display: "flex", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 520, padding: "0 20px" }}>
            <SearchCard
              onClick={() => navigate("/search")}
              subtitle={lastSearchSubtitle}
              lastSearchAt={lastSearch?.created_at}
              onRepeat={repeatLastSearch}
            />
          </div>
        </div>
      </div>
      {/* Il centraggio verticale (provato prima) staccava le card dalla foto lasciando
          un vuoto SOPRA di loro invece che sotto — segnalato dall'utente, era peggio, non
          meglio. Tornate ancorate in alto (subito sotto la foto, padding-top piccolo);
          la foto stessa ora è allungata abbastanza (HERO_HEIGHT_VH) da lasciare poco
          spazio vuoto sotto le card, invece di "nascondere" il problema centrandole. */}
      <div
        style={{
          flex: 1,
          background: COLORS.bg,
          padding: "20px 20px 20px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
        }}
      >
        <div style={{ width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: 14 }}>
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
