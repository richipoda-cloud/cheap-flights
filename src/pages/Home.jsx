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

// Colore reale del bordo inferiore della foto (campionato via canvas sul crop effettivo
// "cover" a proporzioni da telefono, non a occhio — stesso metodo già usato per il
// #73A8D9 del cielo in cima). Segnalato dall'utente: la foto finiva in una sfumatura
// scura poi dissolta in COLORS.bg (verdino chiaro, "#DBE4CC") — un verde estraneo alla
// foto che la faceva sembrare tagliata di netto invece di "completa". Questo è invece il
// tono muschioso vero del fondo dell'immagine: usato sia per la dissolvenza qui sotto sia
// come background_color del manifest (vedi public/manifest.json), cosi' la foto prosegue
// visivamente anche nella schermata di avvio dell'app installata, non solo nel browser.
const HERO_BOTTOM_COLOR = "#4E5541";

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
//
// Sfondo COLORS.accentSoft (verdino tenue, già in palette) invece del bianco pieno: ora
// anche queste tre card stanno sopra la foto hero (allungata apposta), non più in un
// pannello separato sotto — confermato esplicitamente dall'utente. Restano OPACHE (niente
// vetro/blur come SearchCard) così il testo scuro resta leggibile ovunque cadano sulla
// foto, senza dover oscurare quella porzione di immagine.
function SmallCard({ icon, title, subtitle, onClick }) {
  return (
    <Card
      onClick={onClick}
      style={{
        padding: 15,
        background: COLORS.accentSoft,
        border: "1px solid rgba(110,127,92,0.28)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.16)",
      }}
    >
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
    // Segnalato PIÙ VOLTE dall'utente: "Suggeriti per te" restava tagliato in fondo.
    // Due tentativi precedenti (height:100vh, poi 100dvh) presumevano di poter CALCOLARE
    // esattamente quanto spazio serve e bloccare la pagina a quella misura con
    // overflow:hidden — ma qualunque stima (altezza reale del testo su un dato telefono,
    // wrapping del sottotitolo Suggeriti su più righe, dimensione testo di sistema
    // dell'utente) può sbagliare, e con overflow:hidden un errore di stima non dà un
    // bordo brutto: NASCONDE del tutto il contenuto, senza modo di raggiungerlo — questo
    // è il difetto strutturale dietro tutti i tentativi precedenti, non un singolo bug.
    //
    // Ora: la foto è uno sfondo FISSO (position:fixed, non scrolla mai), il contenuto
    // (saluto + card) è in flusso normale dentro una colonna flex con un divisore
    // elastico (flex:1) che assorbe lo spazio vuoto — quando tutto ci sta (caso comune,
    // verificato dal vivo), le card restano ancorate in fondo esattamente come prima,
    // NESSUNA differenza visiva. Quando non ci sta (telefono più basso, testo più lungo,
    // dimensione carattere di sistema più grande), la colonna cresce oltre lo schermo e
    // la pagina scorre normalmente invece di tagliare via "Suggeriti" senza lasciare
    // traccia — una rete di sicurezza, non il comportamento normale atteso.
    <div style={{ position: "relative", minHeight: "100dvh" }}>
      <div
        ref={heroRef}
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: `url(${HERO_IMAGE_URL})`,
          backgroundSize: "cover",
          backgroundPosition: "center 62%",
          zIndex: 0,
        }}
      />
      {/* Sfumature scure alleggerite — segnalato dall'utente: coprivano troppo la
          foto ("non troppo coperta"). Restano solo dove serve davvero leggibilità
          (saluto in cima, card Cerca voli in vetro in fondo), molto più strette e
          meno opache di prima: gran parte della foto ora resta scoperta e visibile. */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          top: 0,
          height: "16%",
          background: "linear-gradient(to top, rgba(0,0,0,0) 0%, rgba(0,0,0,0.28) 100%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          top: "52%",
          bottom: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.42) 60%, rgba(0,0,0,0.46) 100%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {/* La foto si dissolve nel suo stesso tono di fondo reale (HERO_BOTTOM_COLOR),
          non più nel verdino della pagina (COLORS.bg) — stesso principio del trucco
          del colore in cima (theme-color sul cielo campionato): un colore preso dalla
          foto stessa, cosi' il taglio in fondo sembra una continuazione naturale
          invece che un bordo estraneo. */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          height: 64,
          background: `linear-gradient(to bottom, rgba(0,0,0,0) 0%, ${HERO_BOTTOM_COLOR} 100%)`,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {/* Colonna di contenuto in flusso normale (non più assoluta) — vedi commento sopra:
          il divisore elastico tiene le card in fondo quando tutto ci sta, ma lascia la
          colonna crescere (e la pagina scorrere) quando non ci sta. */}
      <div style={{ position: "relative", zIndex: 1, minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
        {/* Saluto in cima alla foto — padding-top con la safe-area cosicché non finisca
            sotto la status bar/dynamic island quando l'app è installata in Home. */}
        <div
          style={{
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

        {/* Divisore elastico: assorbe tutto lo spazio libero, spingendo le card in fondo
            quando c'è margine — si comprime a 0 (mai sotto, min-height:0 implicito su un
            flex item senza contenuto) quando lo spazio non basta, lasciando che la
            colonna cresca invece di sovrapporre o tagliare le card. */}
        <div style={{ flex: 1, minHeight: 24 }} />

        {/* Card Cerca voli + Preferiti/Storico + Suggeriti, impilate in un unico blocco
            in fondo alla foto — le tre card in più stanno sopra la foto invece che in un
            pannello bianco separato, confermato esplicitamente dall'utente. */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
          }}
        >
          <div style={{ width: "100%", maxWidth: 520, padding: "0 20px", display: "flex", flexDirection: "column", gap: 14 }}>
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
    </div>
  );
}
