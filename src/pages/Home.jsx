import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Card } from "../components/Card";
import { COLORS, RADIUS } from "../theme/colors";
import { useAuth } from "../hooks/useAuth";
import { useSearches } from "../hooks/useSearches";
import { destinationName } from "../lib/countryNames";
import { formatRelativeTime } from "../lib/formatters";
import { destinationPhotoUrl } from "../data/destinationPhotos";
import { getCachedHeroColors, getLastShownHero, setLastShownHero, sampleHeroColors } from "../lib/heroColors";
import { pickRotatingDestination, peekNextDestination, consumeNextRotationSync } from "../lib/heroRotation";

// Foto Islanda via Unsplash CDN con resize on-the-fly — sostituita di nuovo il 21/09/2026
// su richiesta esplicita dell'utente ("più verde"): la versione precedente (rioliti di
// Landmannalaugar, toni bruno/rossi) era corretta come soggetto ma poco verde. Questa è
// una valle glaciale muschiosa con fiume, cercata e aperta dal vivo io stesso su
// unsplash.com/s/photos/iceland-moss-mountains, controllando che fosse gratuita (prefisso
// "photo-", non "premium_photo-" = Unsplash+, non usabile senza abbonamento) prima di
// sceglierla. w=1200/q=80/dpr=2 per restare nitida sugli schermi ad alta densità.
const DEFAULT_HERO_URL =
  "https://images.unsplash.com/photo-1530295314625-30d3b777ac7a?auto=format&fit=crop&w=1200&q=80&dpr=2";

// Colore del cielo dell'hero di default (Islanda), stesso principio di HERO_BOTTOM_COLOR
// sotto — estratto qui come costante cosi' da poterlo riusare come fallback quando una
// foto per destinazione non ha ancora restituito il proprio colore campionato.
const DEFAULT_HERO_SKY_COLOR = "#73A8D9";

// Colore reale del bordo inferiore della foto (campionato via canvas sul crop effettivo
// "cover" a proporzioni da telefono, non a occhio — stesso metodo già usato per il
// #73A8D9 del cielo in cima). Segnalato dall'utente: la foto finiva in una sfumatura
// scura poi dissolta in COLORS.bg (verdino chiaro, "#DBE4CC") — un verde estraneo alla
// foto che la faceva sembrare tagliata di netto invece di "completa". Questo è invece il
// tono muschioso vero del fondo dell'immagine: usato sia per la dissolvenza qui sotto sia
// come background_color del manifest (vedi public/manifest.json), cosi' la foto prosegue
// visivamente anche nella schermata di avvio dell'app installata, non solo nel browser.
const DEFAULT_HERO_BOTTOM_COLOR = "#4E5541";

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

// Riga cliccabile "Cerca voli" — non più una Card a sé, ora vive dentro l'unica card
// grande insieme a Preferiti/Storico/Suggeriti (richiesto esplicitamente dall'utente:
// "allungare la card Cerca voli... per inglobare i tre bottoni" invece di card separate).
function SearchRow({ onClick, subtitle }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 15, cursor: "pointer" }}>
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
  );
}

// Divisore sottile riusato tra le sezioni della card grande (era solo tra "Cerca voli" e
// "Ultima ricerca" prima — ora separa anche i blocchi grigi Preferiti/Storico/Suggeriti).
function HomeDivider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.25)", margin: "14px 0" }} />;
}

// Stesso identico vetro grigio del bottone "Ripeti" (rgba(255,255,255,0.2), niente
// bordo) — richiesto esplicitamente dall'utente ("prendi il colore del bottone Ripeti e
// usalo anche per i tre bottoni"). Testo bianco invece di scuro: sullo stesso sfondo
// traslucido di Ripeti il testo scuro perdeva contrasto nelle zone più chiare della foto,
// il bianco resta leggibile come nel resto della card (stesso trattamento già in uso lì).
// Sottotitolo (conteggio preferiti/ricerche, riassunto suggeriti) tolto — richiesto
// esplicitamente dall'utente: solo icona + titolo, niente altro sotto.
function GreyChip({ icon, title, onClick, style }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "rgba(255,255,255,0.2)",
        borderRadius: RADIUS.card,
        padding: 13,
        cursor: "pointer",
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{icon}</div>
        <div style={{ fontWeight: 600, fontSize: 16, color: "#FFFFFF", flex: 1, minWidth: 0 }}>{title}</div>
        <ChevronRight size={19} color="rgba(255,255,255,0.85)" style={{ flexShrink: 0 }} />
      </div>
    </div>
  );
}

// Calcola lo stato iniziale dell'hero in modo SINCRONO, prima del primo render — chiamata
// una sola volta per istanza del componente (vedi initialHeroRef sotto). Per le foto in
// rotazione "Ovunque" non si limita a rileggere l'ultima foto mostrata (che sarebbe quella
// VECCHIA): fa avanzare subito il mazzo di rotazione (consumeNextRotationSync, stessa
// fonte in localStorage usata da pickRotatingDestination) cosi' si parte già dalla foto
// NUOVA di questa apertura — esattamente quella che l'effect sotto sceglierebbe comunque
// una volta noti i dati reali da Supabase, ma senza dover aspettare e senza passare prima
// dalla foto precedente. Segnalato dall'utente: dopo aver tolto il flash sull'Islanda,
// restava identico lo scambio "prima la foto precedente, poi quella nuova" — stesso
// problema, causa diversa (qui la vecchia foto salvata NON è quella da mostrare ora,
// perché la rotazione deve comunque avanzare ad ogni apertura).
function computeInitialHero() {
  const lastShown = getLastShownHero();

  if (lastShown?.rotationSignature) {
    const nextCode = consumeNextRotationSync(lastShown.rotationSignature);
    const nextUrl = nextCode ? destinationPhotoUrl(nextCode) : null;
    // Si usa la foto avanzata solo se i suoi colori sono già in cache (precampionati alla
    // chiusura precedente, vedi peekNextDestination + sampleHeroColors sotto) — altrimenti
    // si ricadrebbe comunque in un "flash" (foto giusta ma colori sbagliati per un
    // istante), lo stesso problema che questa cache serve ad evitare.
    const cachedColors = nextUrl ? getCachedHeroColors(nextUrl) : null;
    if (nextUrl && cachedColors) {
      return {
        url: nextUrl,
        skyColor: cachedColors.skyColor,
        bottomColor: cachedColors.bottomColor,
        consumedRotation: { signature: lastShown.rotationSignature, code: nextCode },
      };
    }
  }

  return {
    url: lastShown?.url ?? DEFAULT_HERO_URL,
    skyColor: lastShown?.skyColor ?? DEFAULT_HERO_SKY_COLOR,
    bottomColor: lastShown?.bottomColor ?? DEFAULT_HERO_BOTTOM_COLOR,
    consumedRotation: null,
  };
}

export function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { searches, loading: loadingSearches } = useSearches(user?.id);

  const lastSearch = searches[0];

  // Calcolato una sola volta per istanza del componente (non ad ogni render) — pattern
  // "lazy ref init": la prima volta initialHeroRef.current è null e lo si valorizza, le
  // volte successive si salta il calcolo. Necessario tenerlo in un ref (non in uno dei tre
  // useState sotto) perché serve anche dopo il primo render, nell'effect, per sapere se la
  // rotazione è già stata fatta avanzare qui e non ripeterla (vedi uso di
  // initialHeroRef.current.consumedRotation più sotto).
  const initialHeroRef = useRef(null);
  if (initialHeroRef.current === null) {
    initialHeroRef.current = computeInitialHero();
  }
  const initialHero = initialHeroRef.current;

  const [heroUrl, setHeroUrl] = useState(initialHero.url);
  const [heroSkyColor, setHeroSkyColor] = useState(initialHero.skyColor);
  const [heroBottomColor, setHeroBottomColor] = useState(initialHero.bottomColor);

  // Imposta la foto hero E la salva come "ultima mostrata" (vedi sopra) cosi' il prossimo
  // avvio parte da qui. rotationSignature: passata solo quando questa foto viene dalla
  // rotazione "Ovunque" (non da una destinazione fissa) — permette al prossimo avvio di
  // far avanzare il mazzo in modo sincrono invece di ripartire da questa stessa foto.
  const applyHero = (url, skyColor, bottomColor, rotationSignature = null) => {
    setHeroUrl(url);
    setHeroSkyColor(skyColor);
    setHeroBottomColor(bottomColor);
    setLastShownHero(url, skyColor, bottomColor, rotationSignature);
  };

  useEffect(() => {
    // Aspetta che lo Storico sia stato caricato da Supabase prima di decidere qualcosa —
    // altrimenti, al primo render, lastSearch è ancora undefined (non "nessuna ricerca
    // fatta per davvero", solo "non ancora arrivata") e l'effect applicherebbe il default
    // per un istante prima di correggersi, ricreando lo stesso flash che si vuole evitare
    // partendo dall'ultima foto mostrata (vedi useState sopra).
    if (loadingSearches) return;

    const destination = lastSearch?.filters?.destination;
    let url = destinationPhotoUrl(destination);
    let rotationSignature = null;

    // Ricerca "Ovunque" (nessuna destinazione precisa scelta): se l'ultima ricerca di
    // questo tipo ha trovato risultati, i loro codici sono stati salvati a posteriori
    // dentro filters._resultDestinations (vedi Results.jsx, attachResultDestinations) —
    // si ruota tra le foto di quelle destinazioni invece di restare sempre sulla foto di
    // default, una diversa ad ogni apertura dell'app, ordine casuale ma senza ripetizioni
    // finché non sono comparse tutte (poi si rimescola, vedi heroRotation.js). Richiesto
    // esplicitamente dall'utente.
    if (!url) {
      const candidates = (lastSearch?.filters?._resultDestinations ?? []).filter(
        (code) => destinationPhotoUrl(code) != null
      );
      if (candidates.length > 0) {
        const signature = String(lastSearch.id);
        rotationSignature = signature;

        // Se il calcolo sincrono dello stato iniziale ha già fatto avanzare il mazzo per
        // QUESTA stessa firma (stesso lotto di ricerca), si riusa quella scelta invece di
        // richiamare pickRotatingDestination — che consumerebbe un SECONDO elemento dal
        // mazzo, saltando una destinazione della rotazione. Se invece la firma è diversa
        // (nel frattempo è stata registrata una nuova ricerca "Ovunque"), si sceglie da
        // capo normalmente.
        const consumed = initialHeroRef.current?.consumedRotation;
        const picked = consumed && consumed.signature === signature ? consumed.code : pickRotatingDestination(signature, candidates);
        url = destinationPhotoUrl(picked);

        // Prepara in anticipo, mentre l'app è ancora aperta, la foto che uscirà alla
        // PROSSIMA apertura (non solo quella di adesso) — richiesto esplicitamente
        // dall'utente per evitare il flash sulla foto di default anche per le
        // destinazioni in rotazione. Campionamento in background: non tocca lo stato
        // mostrato ora, si limita a scaldare la cache (vedi heroColors.js) cosi' la
        // prossima volta il colore è già pronto. Se il mazzo è esaurito (il prossimo
        // giro rimescolerà) non c'è nulla di deterministico da preparare, si salta.
        const nextCode = peekNextDestination(signature);
        const nextUrl = nextCode ? destinationPhotoUrl(nextCode) : null;
        if (nextUrl) sampleHeroColors(nextUrl).catch(() => {});
      }
    }

    if (!url) {
      applyHero(DEFAULT_HERO_URL, DEFAULT_HERO_SKY_COLOR, DEFAULT_HERO_BOTTOM_COLOR);
      return;
    }

    // Se questa foto è già in cache (vista in precedenza, preparata in anticipo
    // all'apertura scorsa, o già impostata come stato iniziale sincrono qui sopra), si
    // mostra subito senza passare dal default — elimina il flash "prima la foto
    // sbagliata poi quella vera" segnalato dall'utente.
    const cachedColors = getCachedHeroColors(url);
    if (cachedColors) {
      applyHero(url, cachedColors.skyColor, cachedColors.bottomColor, rotationSignature);
      return;
    }

    let cancelled = false;
    sampleHeroColors(url)
      .then(({ skyColor, bottomColor }) => {
        if (cancelled) return;
        applyHero(url, skyColor, bottomColor, rotationSignature);
      })
      .catch(() => {
        // Campionamento fallito (rete assente, immagine non raggiungibile) — resta sulla
        // foto di default invece di rischiare foto giusta + colori sbagliati.
        if (cancelled) return;
        applyHero(DEFAULT_HERO_URL, DEFAULT_HERO_SKY_COLOR, DEFAULT_HERO_BOTTOM_COLOR);
      });
    return () => {
      cancelled = true;
    };
  }, [loadingSearches, lastSearch?.id, lastSearch?.filters?.destination, lastSearch?.filters?._resultDestinations]);

  const lastSearchSubtitle = describeLastSearch(lastSearch?.filters) ?? "Ovunque · Sempre · Filtri";
  const repeatLastSearch = () => navigate("/results", { state: { filters: lastSearch.filters } });

  // In Safari con l'indirizzo digitato (non installata in Home) la barra di stato/URL
  // resta sempre opaca sopra la pagina — nessun sito può davvero disegnarci sotto, quindi
  // qui è solo un trucco visivo: si tinge quella barra (theme-color, che Safari iOS legge
  // anche in tab normale, non solo da installata) con lo stesso azzurro del cielo in cima
  // alla foto, campionato dal pixel reale dell'immagine (rgb 115,168,217 = #73A8D9, non a
  // occhio) cosi' la barra sembra continuare la foto invece di tagliarla con una fascia
  // verde. Da installata in Home il fix vero (index.html, status bar black-translucent)
  // fa già disegnare la foto sotto la barra per davvero, questo qui non serve né disturba.
  //
  // Segnalato dall'utente: scorrendo oltre la foto (46vh) la barra tornava verde, ma un
  // verde SBAGLIATO — "#6E7F5C" (l'accento scuro dei bottoni, valore di default in
  // index.html) invece del vero sfondo pagina COLORS.bg ("#DBE4CC", più chiaro) che a quel
  // punto è davvero quello che si vede in cima. Prima si tingeva solo una volta al mount,
  // ora segue lo scroll con IntersectionObserver sull'hero: azzurro finché è visibile,
  // COLORS.bg appena esce dallo schermo — sempre il colore vero di quel che c'è in cima.
  // Segnalato dall'utente: "mi risulta ancora possibile scorrere su e giù" anche dopo
  // aver messo overflow:hidden sul contenitore della pagina — quello impedisce solo al
  // CONTENUTO di scorrere dentro il proprio box, non al bounce/rubber-band nativo di
  // Safari iOS (e delle PWA), che agisce a livello di html/body definiti in fonts.css
  // (niente overflow lì, serve altrove per le altre pagine che DEVONO scorrere). Bloccato
  // qui solo per la durata di Home, ripristinato allo smontaggio così le altre pagine
  // restano scorrevoli come sempre.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  const heroRef = useRef(null);
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const previous = meta?.getAttribute("content");
    const setColor = (visible) => meta?.setAttribute("content", visible ? heroSkyColor : COLORS.bg);
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
  }, [heroSkyColor]);

  return (
    // STORIA (da leggere prima di ritoccare questo): "Suggeriti per te" restava tagliato
    // in fondo con height:100dvh + overflow:hidden — qualunque stima di quanto spazio
    // serva (testo più lungo, dimensione carattere di sistema, telefono più basso) poteva
    // sbagliare, e un errore di stima con overflow:hidden non dà un bordo brutto: NASCONDE
    // del tutto il contenuto, senza modo di raggiungerlo. Per questo era stata tolta la
    // rete di sicurezza dello scroll.
    //
    // Richiesto ora esplicitamente dall'utente ("non voglio che si possa scorrere nella
    // home"): overflow:hidden reintrodotto qui, accettando consapevolmente lo stesso
    // rischio di prima — con i sottotitoli tolti sotto Preferiti/Storico/Suggeriti il
    // contenuto è molto più compatto e ci sta su schermi più piccoli di prima (verificato
    // dal vivo su 375×812), ma su un telefono ANCORA più basso o un testo di sistema molto
    // più grande potrebbe di nuovo tagliare via l'ultima riga senza alcun modo di
    // raggiungerla — non c'è più lo scroll a fare da paracadute.
    <div style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
      <div
        ref={heroRef}
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: `url(${heroUrl})`,
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
          background: `linear-gradient(to bottom, rgba(0,0,0,0) 0%, ${heroBottomColor} 100%)`,
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
            // Alzato da 14 a 6px — richiesto esplicitamente dall'utente ("alza
            // leggermente il titolo in alto"), resta comunque sotto la safe-area (status
            // bar/dynamic island quando installata).
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 6px)",
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

        {/* Un'unica card grande di vetro (Cerca voli + Ultima ricerca/Ripeti +
            Preferiti/Storico/Suggeriti come blocchi grigi annidati) invece di 4 card
            separate — richiesto esplicitamente dall'utente ("allungare la card Cerca
            voli... per inglobare i tre bottoni"). */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            // Alzato da 20 a 44px — richiesto esplicitamente dall'utente ("alza
            // leggermente gli elementi... senza dover scorrere"): più margine dal bordo
            // inferiore, la card resta comunque ancorata in basso (divisore elastico sopra)
            // ma un po' più in alto invece che a filo schermo.
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 44px)",
          }}
        >
          <div style={{ width: "100%", maxWidth: 520, padding: "0 20px" }}>
            <Card
              style={{
                padding: 18,
                background: "rgba(255,255,255,0.16)",
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
                border: "1px solid rgba(255,255,255,0.35)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
              }}
            >
              <SearchRow onClick={() => navigate("/search")} subtitle={lastSearchSubtitle} />

              {/* Segnalato dall'utente: la card "si espandeva" un attimo dopo l'apertura —
                  useSearches parte con searches=[] finché la query a Supabase non torna,
                  quindi questa riga appariva di scatto (e allungava la card) un istante
                  dopo il primo render invece di esserci già. Skeleton della STESSA altezza
                  durante il caricamento: la card non cambia più dimensione quando arriva
                  il dato vero (per chi ha già cercato — per chi non ha mai cercato resta un
                  piccolo restringimento quando lo skeleton sparisce, caso raro e molto meno
                  fastidioso di un'espansione improvvisa). */}
              {(loadingSearches || lastSearch?.created_at) && (
                <>
                  <HomeDivider />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    {loadingSearches ? (
                      <>
                        <div style={{ height: 13, width: 140, borderRadius: 4, background: "rgba(255,255,255,0.15)" }} />
                        <div style={{ height: 25, width: 74, borderRadius: RADIUS.pill, background: "rgba(255,255,255,0.12)" }} />
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
                          Ultima ricerca: {formatRelativeTime(lastSearch.created_at)}
                        </div>
                        <button
                          onClick={repeatLastSearch}
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
                      </>
                    )}
                  </div>
                </>
              )}

              <HomeDivider />
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <GreyChip icon="⭐" title="Preferiti" onClick={() => navigate("/favorites")} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <GreyChip icon="🕐" title="Storico" onClick={() => navigate("/history")} />
                </div>
              </div>
              <div style={{ height: 10 }} />
              <GreyChip icon="✨" title="Suggeriti per te" onClick={() => navigate("/suggestions")} />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
