import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { COLORS, RADIUS } from "../theme/colors";
import { FlagIcon } from "../components/FlagIcon";
import { LegBox } from "../components/LegBox";
import { LegRow } from "../components/LegRow";
import { BookingAction } from "../components/BookingAction";
import { searchDirect, verifyPrice } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useSearches } from "../hooks/useSearches";
import { useFavorites } from "../hooks/useFavorites";

// Lista piatta con separatori sottili tra le righe (non una card per riga) — un unico
// box bianco arrotondato che contiene tutte le righe di un gruppo (diretti o creativi).
function FlatList({ children }) {
  return (
    <div
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.hairline}`,
        borderRadius: RADIUS.card,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

// Bottone icona per salvare il volo direttamente dalla lista dei Risultati — richiesto
// esplicitamente dall'utente ("dove ti ho indicato bisogna inserire un bottone con
// l'icona della stella... per poter effettivamente salvare il volo"): prima l'unico modo
// era aprire il dettaglio del volo (FlightDetail, bottone "★ Salva nei preferiti"), qui
// stesso principio ma senza dover navigare via. `onSave` è undefined quando l'utente non
// è loggato (nessun favorites possibile) — in quel caso il bottone non compare affatto.
// justSaved locale (non nel genitore): ogni riga tiene il proprio stato del bottone,
// stesso pattern di FlightDetail (2s poi torna cliccabile — dedup doppio click resta un
// bug noto, non introdotto qui, vedi TODO.md).
// Colore allineato al verde del bottone di prenotazione affiancato (COLORS.accent, non
// più COLORS.plum) — richiesto esplicitamente dall'utente ("la stella non la voglio
// rosso ma dello stesso verde del bottone di fianco"). Bordo/testo verdi invece di pieno
// (che è già il trattamento del bottone di prenotazione) per restare un'azione secondaria
// riconoscibile, non una seconda CTA identica. Testo "Salva tratta" aggiunto accanto
// all'icona — richiesto esplicitamente dall'utente, prima era solo l'icona.
// justSaved NON torna più a false dopo i 2s (bug segnalato dall'utente: aspettando la
// fine dell'animazione e ricliccando sulla stessa tratta, si creava un secondo preferito
// identico — nessun controllo di duplicato, solo il timer del feedback visivo). Ora resta
// "✓ Salvata" e disabilitato per il resto della sessione su questa riga, una volta salvata.
function SaveFavoriteButton({ onSave }) {
  const [justSaved, setJustSaved] = useState(false);
  if (!onSave) return null;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (justSaved) return;
        onSave();
        setJustSaved(true);
      }}
      disabled={justSaved}
      style={{
        flexShrink: 0,
        whiteSpace: "nowrap",
        borderRadius: RADIUS.button,
        border: `1px solid ${COLORS.accent}`,
        background: justSaved ? COLORS.accentSoft : "transparent",
        color: COLORS.accent,
        fontFamily: "'Inter', sans-serif",
        fontWeight: 600,
        fontSize: 13,
        padding: "0 14px",
        cursor: justSaved ? "default" : "pointer",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span>{justSaved ? "✓" : "★"}</span>
      <span>{justSaved ? "Salvata" : "Salva tratta"}</span>
    </button>
  );
}

// Espande sul posto invece di navigare al dettaglio (stesso pattern di Preferiti) —
// per i diretti riusa il verifyData già ottenuto per il badge "✓ verificato" (nessuna
// chiamata doppia), per i percorsi creativi mostra le tratte già pronte da search-stopover.
function ResultRow({ result, isLast, expanded, onToggle, verifiedPrice, verifyData, onSaveFavorite }) {
  const price = verifiedPrice ?? result.price;
  const deepLink = verifyData?.deepLink ?? result.deepLink;
  // "✓ verificato" solo se verify-price ha davvero trovato cache abbastanza fresca da
  // confermare il prezzo (somma tratte one-way o match aggregato) — se è ricaduto sul
  // prezzo originale non ricontrollato, resta onestamente "~" come i risultati non ancora
  // verificati, invece di promettere un'affidabilità che non c'è.
  const confirmed = Boolean(verifyData?.confirmed);
  // Richiesto dall'utente (02/10/2026): le proposte trovate SOLO cercando anche gli scali
  // (vedi sezione "con scalo" in Results sotto) vanno riconoscibili a colpo d'occhio dalla
  // lista principale, non solo aprendo il dettaglio — altrimenti sembrerebbero diretti.
  const hasStopBadge = Boolean(verifyData?.hasStop);
  // Stesso identico snapshot costruito da FlightDetail (handleSaveFavorite) — prezzo
  // migliore disponibile + i filtri che hanno prodotto questo risultato, non solo il
  // volo nudo. isFresh: i percorsi creativi non hanno un concetto di "confermato" (vedi
  // useFavorites.js), gli altri seguono l'esito reale della verifica.
  const handleSave = () => onSaveFavorite?.(price, result.isStopover ? true : confirmed);

  return (
    <div style={{ borderBottom: isLast ? "none" : `1px solid ${COLORS.hairline}` }}>
      <div
        onClick={onToggle}
        style={{
          padding: "14px 16px",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FlagIcon countryCode={result.countryCode} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.ink }}>
              {result.destinationName ?? result.destination}
            </div>
            <div style={{ fontSize: 12, color: COLORS.inkSoft }}>
              {result.departDate} → {result.returnDate}
              {result.isStopover && result.viaHub && ` · via ${result.viaHub}`}
            </div>
            {result.nights != null && (
              <div style={{ fontSize: 11.5, color: COLORS.inkSoft }}>{result.nights} notti</div>
            )}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: COLORS.accent }}>
            {confirmed ? "" : "~"}
            {price} {result.currency ?? "€"}
          </div>
          {confirmed ? (
            <div style={{ fontSize: 10.5, color: COLORS.accent }}>
              ✓ verificato{hasStopBadge ? " · con scalo" : ""}
            </div>
          ) : (
            verifiedPrice != null && (
              <div style={{ fontSize: 10.5, color: COLORS.inkSoft }}>da confermare al link</div>
            )
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "0 16px 16px" }} onClick={(e) => e.stopPropagation()}>
          {result.isStopover ? (
            <>
              {result.legs?.map((leg, i) => (
                <LegRow key={leg.id} index={i + 1} total={result.legs.length} leg={leg} />
              ))}
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <SaveFavoriteButton onSave={handleSave} />
              </div>
            </>
          ) : verifyData ? (
            (() => {
              const outboundLegs = verifyData.outboundLegs ?? (verifyData.outboundLeg ? [verifyData.outboundLeg] : []);
              const inboundLegs = verifyData.inboundLegs ?? (verifyData.inboundLeg ? [verifyData.inboundLeg] : []);
              const hasStop = verifyData.hasStop || outboundLegs.length > 1 || inboundLegs.length > 1;

              // Con uno scalo (andata e/o ritorno) l'itinerario è sempre a biglietti
              // separati — stessa presentazione già usata per i vecchi percorsi creativi.
              if (hasStop) {
                const allLegs = [...outboundLegs, ...inboundLegs];
                return allLegs.map((leg, i) => (
                  <LegRow key={leg.id ?? i} index={i + 1} total={allLegs.length} leg={leg} />
                ));
              }

              const outboundLeg = outboundLegs[0];
              const inboundLeg = inboundLegs[0];
              return (
                <>
                  <LegBox
                    title="Andata"
                    leg={outboundLeg}
                    route={`${result.origin ?? "?"} → ${result.destination ?? "?"}`}
                    date={result.departDate}
                    numberOfChanges={verifyData.numberOfChanges}
                  />
                  <LegBox
                    title="Ritorno"
                    leg={inboundLeg}
                    route={`${inboundLeg?.originAirport ?? result.destination ?? "?"} → ${inboundLeg?.destinationAirport ?? result.origin ?? "?"}`}
                    date={result.returnDate}
                    numberOfChanges={verifyData.numberOfChanges}
                  />
                  {verifyData.returnsElsewhere && (
                    <div style={{ fontSize: 11.5, color: COLORS.plum, marginBottom: 8, marginTop: -4 }}>
                      ✈️ Ritorno {inboundLeg.originAirport}→{inboundLeg.destinationAirport} invece di{" "}
                      {result.destination}→{result.origin} — conviene, ma sono due biglietti separati
                    </div>
                  )}
                  {verifyData.returnsElsewhere ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <SaveFavoriteButton onSave={handleSave} />
                      <BookingAction
                        deepLink={outboundLeg?.deepLink}
                        airlineName={outboundLeg?.airlineName ?? outboundLeg?.airline}
                        route={`${result.origin ?? "?"} → ${result.destination ?? "?"}`}
                        departDate={result.departDate}
                        unverified={Boolean(outboundLeg?.unverified)}
                        label="Prenota andata →"
                        style={{ flex: 1, justifyContent: "center" }}
                      />
                      <BookingAction
                        deepLink={inboundLeg?.deepLink}
                        airlineName={inboundLeg?.airlineName ?? inboundLeg?.airline}
                        route={`${result.destination ?? "?"} → ${result.origin ?? "?"}`}
                        departDate={result.returnDate}
                        unverified={Boolean(inboundLeg?.unverified)}
                        label="Prenota ritorno →"
                        style={{ flex: 1, justifyContent: "center" }}
                      />
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      <SaveFavoriteButton onSave={handleSave} />
                      <BookingAction
                        deepLink={deepLink}
                        airlineName={outboundLeg?.airlineName ?? outboundLeg?.airline ?? inboundLeg?.airlineName ?? inboundLeg?.airline}
                        route={`${result.origin ?? "?"} → ${result.destination ?? "?"}`}
                        departDate={result.departDate}
                        returnDate={result.returnDate}
                        numberOfChanges={verifyData.numberOfChanges}
                        unverified={Boolean(outboundLeg?.unverified || inboundLeg?.unverified)}
                        style={{ flex: 1, justifyContent: "center" }}
                      />
                    </div>
                  )}
                </>
              );
            })()
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 12.5, color: COLORS.inkSoft, flex: 1 }}>Carico orari…</div>
              <SaveFavoriteButton onSave={handleSave} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Diagnostica "con scalo" mostrata direttamente in pagina (03/10/2026, al posto di
// chiedere all'utente di controllare i log su Supabase — richiesta esplicitamente
// declinata: "non ho voglia"): ogni tentativo è un hub provato da cheapestConnection sul
// backend (verify-price), con cosa ha trovato (o non trovato) per ciascuna delle due
// tratte. Pensata per essere leggibile con un semplice screenshot, non per essere bella.
function ScaloDebugPanel({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 6 }}>
        Dettaglio tecnico di cosa è stato provato (per capire perché non si trova nulla):
      </div>
      {items.map(({ label, debug }, i) => (
        <div
          key={i}
          style={{
            background: COLORS.surface,
            border: `1px solid ${COLORS.hairline}`,
            borderRadius: RADIUS.card,
            padding: 10,
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.ink, marginBottom: 4 }}>{label}</div>
          {["outbound", "return"].map((dir) =>
            debug?.[dir]?.length ? (
              <div key={dir} style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 10.5, color: COLORS.inkSoft, fontWeight: 600 }}>
                  {dir === "outbound" ? "Andata" : "Ritorno"}:
                </div>
                {debug[dir].map((a, j) => (
                  <div
                    key={j}
                    style={{
                      fontSize: 10.5,
                      fontFamily: "monospace",
                      color: COLORS.inkSoft,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {a.hub}: leg1={a.leg1 ?? `nessuno (pool ${a.leg1PoolSize})`}
                    {a.leg1 ? `, leg2=${a.leg2 ?? `nessuno (pool ${a.leg2PoolSize}, in finestra ${a.leg2CandidatesInWindow})`}` : ""}
                    {" — "}
                    {a.outcome}
                  </div>
                ))}
              </div>
            ) : null
          )}
        </div>
      ))}
    </div>
  );
}

export function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { recordSearch, attachResultDestinations } = useSearches(user?.id);
  const { addFavorite } = useFavorites(user?.id);

  const filters = location.state?.filters;
  const [directResults, setDirectResults] = useState([]);
  const [verifiedData, setVerifiedData] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [loadingDirect, setLoadingDirect] = useState(true);
  // Segnalato dall'utente: i risultati comparivano e poi, dopo qualche secondo, sparivano.
  // Causa: il filtro sotto (sortedResults) nasconde un risultato appena verifyPrice torna
  // con ENTRAMBE le tratte nulle (voluto, vedi commento più sotto) — ma la lista veniva
  // mostrata SUBITO, prima che le verifiche finissero, quindi l'utente vedeva la card e poi
  // la vedeva sparire sotto i suoi occhi. Aspettare che TUTTE le verifiche siano arrivate
  // (o fallite) prima di mostrare la lista elimina lo sparire a schermo: il filtro agisce
  // prima del primo render della card, non dopo.
  const [verifyingAll, setVerifyingAll] = useState(false);
  const pendingVerifyRef = useRef(0);
  const [error, setError] = useState(null);
  const recordedRef = useRef(false);
  const recordedSearchRef = useRef(null);
  const mountedRef = useRef(true);
  const stopCheckedRef = useRef(new Set());
  useEffect(() => () => (mountedRef.current = false), []);

  // Ricerca "con scalo" automatica di ripiego (richiesta dall'utente 02/10/2026, al posto
  // di un semplice messaggio "prova ad attivare il filtro"): quando NESSUN risultato diretto
  // risulta confermato, invece di lasciare l'utente a dover tornare indietro e riattivare un
  // filtro a mano, si rilancia da sola la stessa verifica ma con checkOutboundStop/
  // checkReturnStop forzati a true (normalmente attivi solo se l'utente accende i toggle
  // "Con scalo" nei filtri) — mostrate poi in una sezione separata, mai mescolate
  // silenziosamente tra i diretti (vedi hasStopBadge sopra e la UI sotto).
  //
  // BUG SCOPERTO IL 02/10/2026 (segnalato dall'utente: pure la Thailandia, rotta
  // documentata come ricca di voli diretti — vedi COUNTRY_MAJOR_CITIES in search-direct —
  // tornava zero risultati): la prima versione lanciava verifyPrice per TUTTI i risultati
  // diretti (fino a 10) IN PARALLELO, ognuno con checkOutboundStop+checkReturnStop attivi —
  // fino a ~20 chiamate Travelpayouts a risultato (cheapestConnection in verify-price:
  // CONNECTION_HUB_CANDIDATES hub x 2 chiamate x 2 direzioni), quindi fino a ~200 chiamate
  // TUTTE INSIEME per una singola ricerca. fetchOneWayPrices scarta silenziosamente
  // qualunque risposta non-OK (quindi anche un rate limit, 429) come "nessun dato" — un
  // limite di frequenza colpito si presentava quindi indistinguibile da scarsità di dati
  // reale, su QUALSIASI rotta, non solo quelle genuinamente povere. Due correzioni:
  // (1) qui ci si limita alle poche proposte dirette più economiche, non tutte e 10;
  // (2) le si verifica IN SEQUENZA (una alla volta, await) invece che tutte insieme in
  // parallelo, per restare ben sotto qualunque soglia plausibile anche nel caso peggiore.
  const SCALO_FALLBACK_LIMIT = 3;
  const [scaloVerifiedData, setScaloVerifiedData] = useState({});
  const [verifyingScalo, setVerifyingScalo] = useState(false);
  const pendingScaloRef = useRef(0);
  const scaloAttemptedRef = useRef(false);
  // Diagnostica per-candidato raccolta durante il fallback con scalo (vedi ScaloDebugPanel
  // sopra) — tenuta a parte da scaloVerifiedData perché serve anche quando la verifica NON
  // trova nulla (scaloVerifiedData in quel caso resta vuoto per quel risultato).
  const [scaloDebugData, setScaloDebugData] = useState([]);

  // Separato dall'effect di ricerca: user?.id arriva async (sessione risolta dopo il
  // mount), quindi va aspettato con la sua dependency, non catturato nella closure
  // stale di un effect a dependency [] — altrimenti recordSearch(userId=undefined)
  // ritorna subito senza salvare nulla, silenziosamente.
  useEffect(() => {
    if (!filters || !user?.id || recordedRef.current) return;
    recordedRef.current = true;
    // Tiene la riga appena inserita (serve il suo id per attachResultDestinations sotto,
    // una volta che i risultati di una ricerca "Ovunque" sono pronti).
    recordSearch(filters).then((row) => {
      if (row) recordedSearchRef.current = row;
    });
  }, [filters, user?.id, recordSearch]);

  useEffect(() => {
    if (!filters) {
      navigate("/search");
      return;
    }

    setLoadingDirect(true);
    searchDirect(filters)
      .then((data) => {
        const list = data?.results ?? [];
        setDirectResults(list);
        pendingVerifyRef.current = list.length;
        setVerifyingAll(list.length > 0);
        // Lista tenuta volutamente corta (10 al massimo, vedi search-direct) proprio per
        // poterla verificare TUTTA dal vivo appena arriva, invece di lasciarla indicativa
        // finché non si apre il dettaglio — stessa somma tratte one-way del dettaglio.
        list.forEach((r) => {
          // "Aeroporto di ritorno diverso dalla partenza": il ritorno atterra su un
          // aeroporto vicino a casa a scelta tra quelli di Partenza, non solo quello di
          // andata. "Ripartenza flessibile": il ritorno PARTE da un aeroporto vicino alla
          // destinazione invece che da quella esatta. Due leve indipendenti, entrambe
          // gestite nello stesso verify-price (si possono anche combinare).
          const payload = {
            ...r,
            ...(filters.flexArrival ? { homeAirports: filters.origins } : {}),
            ...(filters.flexDeparture ? { flexReturnOrigin: true } : {}),
            // Coerenza col filtro "solo diretti di default" di search-direct (segnalato
            // dall'utente): senza questo verify-price poteva rifiutare di confermare un
            // prezzo con scalo che search-direct aveva incluso apposta perché il toggle
            // "Con scalo" è attivo.
            allowStops: Boolean(filters.flexOutboundStop || filters.flexReturnStop),
          };
          verifyPrice(payload)
            .then((v) => {
              if (!mountedRef.current || v?.price == null) return;
              setVerifiedData((prev) => ({ ...prev, [r.id]: v }));
            })
            .catch(() => {})
            .finally(() => {
              pendingVerifyRef.current -= 1;
              if (mountedRef.current && pendingVerifyRef.current <= 0) setVerifyingAll(false);
            });
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingDirect(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // search-direct ordina già per prezzo, ma quello è il prezzo AGGREGATO non ancora
  // verificato — man mano che verify-price conferma i prezzi reali (somma tratte one-way,
  // vedi fix del 21/09/2026) l'ordine vero può cambiare, anche di parecchio, e la lista
  // restava ferma nell'ordine iniziale invece di riflettere il prezzo verificato più basso.
  // Riordina lato client usando il prezzo verificato quando c'è, altrimenti quello originale.
  //
  // DECISIONE 02/10/2026 (richiesta esplicita dell'utente, dopo aver visto dal vivo un
  // risultato USA con prezzo "✓ verificato" ma volo "⚠️ Non confermato" di un altro giorno:
  // "non mi interessa trovare un prezzo per un volo che non posso sapere... io devo trovare
  // un volo vero"): prima bastava `confirmed` (prezzo confermato, anche solo dalla cache
  // aggregata v2 senza dettaglio di volo) O una qualunque tratta v3 trovata (anche solo
  // approssimata/non confermata) per tenere il risultato in lista — risultato: su rotte
  // intercontinentali si mostrava spesso un prezzo vero abbinato a un volo indovinato di
  // un'altra data, che sembrava riferirsi a quel prezzo ma non era così. Ora si tiene SOLO
  // se verify-price conferma `flightConfirmed` (volo reale, compagnia/orario su ENTRAMBE le
  // tratte, per le date esatte cercate) — i percorsi creativi (isStopover) non c'entrano,
  // le loro tratte vengono già da un match one-way vero in search-stopover, mai approssimato.
  const sortedResults = useMemo(() => {
    return [...directResults]
      .filter((r) => {
        if (r.isStopover) return true;
        const v = verifiedData[r.id];
        if (!v) return true; // verifica ancora in corso, non nascondere in anticipo
        return Boolean(v.flightConfirmed);
      })
      .sort((a, b) => {
        const priceA = verifiedData[a.id]?.price ?? a.price;
        const priceB = verifiedData[b.id]?.price ?? b.price;
        return priceA - priceB;
      });
  }, [directResults, verifiedData]);

  // Scatta UNA SOLA VOLTA (scaloAttemptedRef) quando le verifiche dirette sono finite e
  // NESSUN risultato è rimasto confermato — vedi commento sullo stato sopra. Se nel
  // frattempo l'utente aveva già chiesto esplicitamente "con scalo" nei filtri, le verifiche
  // dirette qui sopra l'hanno già cercato (allowStops) quindi questo fallback non serve;
  // riprovarlo comunque non fa danni, nel peggiore dei casi ritrova zero risultati anche lui.
  //
  // Limitato alle SCALO_FALLBACK_LIMIT proposte più economiche e lanciato IN SEQUENZA
  // (non in parallelo) — vedi il commento sullo stato sopra per il bug di rate limit che
  // questo corregge.
  useEffect(() => {
    if (loadingDirect || verifyingAll) return;
    if (scaloAttemptedRef.current) return;
    if (directResults.length === 0 || sortedResults.length > 0) return;
    scaloAttemptedRef.current = true;
    const candidates = [...directResults].sort((a, b) => a.price - b.price).slice(0, SCALO_FALLBACK_LIMIT);
    pendingScaloRef.current = candidates.length;
    setVerifyingScalo(true);
    (async () => {
      for (const r of candidates) {
        if (!mountedRef.current) break;
        const payload = {
          ...r,
          ...(filters?.flexArrival ? { homeAirports: filters.origins } : {}),
          ...(filters?.flexDeparture ? { flexReturnOrigin: true } : {}),
          allowStops: true,
          checkOutboundStop: true,
          checkReturnStop: true,
        };
        try {
          const v = await verifyPrice(payload);
          if (mountedRef.current && v?.price != null) {
            setScaloVerifiedData((prev) => ({ ...prev, [r.id]: v }));
          }
          // Diagnostica raccolta a prescindere dall'esito (anche quando non trova nulla —
          // è esattamente il caso che serve capire, vedi ScaloDebugPanel).
          if (mountedRef.current && v?.scaloDebug) {
            setScaloDebugData((prev) => [
              ...prev,
              {
                label: `${r.destinationName ?? r.destination} (${r.departDate} → ${r.returnDate})`,
                debug: v.scaloDebug,
              },
            ]);
          }
        } catch {
          // ignorato, stesso comportamento di prima
        } finally {
          pendingScaloRef.current -= 1;
          if (mountedRef.current && pendingScaloRef.current <= 0) setVerifyingScalo(false);
        }
      }
    })();
  }, [loadingDirect, verifyingAll, directResults, sortedResults, filters]);

  // Stessa idea di sortedResults, ma sui risultati del fallback "con scalo": tenuti solo
  // se davvero confermati (compagnia/orario reali su entrambe le tratte, anche con scalo).
  const scaloResults = useMemo(() => {
    return directResults
      .filter((r) => Boolean(scaloVerifiedData[r.id]?.flightConfirmed))
      .sort((a, b) => (scaloVerifiedData[a.id]?.price ?? a.price) - (scaloVerifiedData[b.id]?.price ?? b.price));
  }, [directResults, scaloVerifiedData]);

  // Solo per ricerche "Ovunque" (filters.destination vuoto/null): una volta che i
  // risultati sono stabili (niente più caricamento/verifiche in corso), salviamo i codici
  // delle destinazioni trovate (già ordinati per prezzo, deduplicati, max 10) nella ricerca
  // appena registrata — usati poi in Home per far ruotare la foto hero tra queste
  // destinazioni invece di restare sempre sulla foto di default. Una tantum per ricerca
  // (attachedRef), non riparte ad ogni piccola variazione successiva di verifiedData.
  const attachedRef = useRef(false);
  useEffect(() => {
    if (attachedRef.current) return;
    if (loadingDirect || verifyingAll) return;
    if (filters?.destination) return;
    if (!recordedSearchRef.current) return;
    if (sortedResults.length === 0) return;
    attachedRef.current = true;
    const codes = [...new Set(sortedResults.map((r) => r.destination).filter(Boolean))].slice(0, 10);
    if (codes.length > 0) {
      attachResultDestinations(recordedSearchRef.current.id, recordedSearchRef.current.filters, codes);
    }
  }, [loadingDirect, verifyingAll, filters, sortedResults, attachResultDestinations]);

  if (!filters) return null;

  const toggleExpand = (id) => {
    setExpandedId((current) => (current === id ? null : id));
    // "Con scalo": ricerca costosa (hub candidati x 2 chiamate ciascuno), per questo NON
    // gira per tutti i 10 risultati come le altre flessibilità, ma solo per la card che
    // l'utente apre davvero, e solo una volta (stopCheckedRef).
    if ((filters.flexOutboundStop || filters.flexReturnStop) && !stopCheckedRef.current.has(id)) {
      stopCheckedRef.current.add(id);
      const result = directResults.find((r) => r.id === id);
      if (!result) return;
      const payload = {
        ...result,
        ...(filters.flexArrival ? { homeAirports: filters.origins } : {}),
        ...(filters.flexDeparture ? { flexReturnOrigin: true } : {}),
        ...(filters.flexOutboundStop ? { checkOutboundStop: true } : {}),
        ...(filters.flexReturnStop ? { checkReturnStop: true } : {}),
      };
      verifyPrice(payload)
        .then((v) => {
          if (!mountedRef.current || v?.price == null) return;
          setVerifiedData((prev) => ({ ...prev, [id]: v }));
        })
        .catch(() => {});
    }
  };

  // Stesso identico toggle, ma per le righe del fallback "con scalo" (expandedId/stato
  // condiviso con la lista principale — un solo risultato alla volta espanso in pagina,
  // le due liste non si vedono mai contemporaneamente visto che una sostituisce l'altra).
  const toggleExpandScalo = (id) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  return (
    <div style={{ padding: 20, paddingBottom: 130 }}>
      <div style={{ fontWeight: 600, fontSize: 20, color: COLORS.accent, marginBottom: 4 }}>
        Risultati
      </div>
      <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 16 }}>
        Prezzi indicativi (~) — si aggiornano da soli in pochi secondi
      </div>

      {error && <div style={{ color: COLORS.warn, marginBottom: 12 }}>{error}</div>}

      {(loadingDirect || verifyingAll) && (
        <div style={{ color: COLORS.inkSoft }}>
          {loadingDirect ? "Ricerca in corso…" : "Verifica dati in corso…"}
        </div>
      )}
      {!loadingDirect && !verifyingAll && directResults.length === 0 && (
        <div style={{ color: COLORS.inkSoft }}>Nessun risultato diretto trovato.</div>
      )}
      {!verifyingAll && sortedResults.length > 0 && (
        <FlatList>
          {sortedResults.map((r, i) => (
            <ResultRow
              key={r.id}
              result={r}
              isLast={i === sortedResults.length - 1}
              expanded={expandedId === r.id}
              onToggle={() => toggleExpand(r.id)}
              verifiedPrice={verifiedData[r.id]?.price}
              verifyData={verifiedData[r.id]}
              onSaveFavorite={
                user?.id
                  ? (price, isFresh) => addFavorite({ ...r, price, searchFilters: filters }, isFresh)
                  : undefined
              }
            />
          ))}
        </FlatList>
      )}

      {/* Fallback "con scalo" (richiesto dall'utente 02/10/2026): quando NESSUN diretto è
          confermato, invece di un semplice messaggio che chiede di riattivare un filtro a
          mano, si mostrano QUI direttamente le proposte trovate cercando anche gli scali —
          vedi l'effect scaloAttemptedRef sopra. Sezione separata (mai mescolata ai diretti),
          ogni riga già etichettata "· con scalo" dentro ResultRow. */}
      {!loadingDirect && !verifyingAll && directResults.length > 0 && sortedResults.length === 0 && (
        <>
          {verifyingScalo && (
            <div style={{ color: COLORS.inkSoft }}>Nessun diretto confermato — cerco anche con scalo…</div>
          )}
          {!verifyingScalo && scaloResults.length > 0 && (
            <>
              <div style={{ fontSize: 12.5, color: COLORS.inkSoft, marginBottom: 8 }}>
                Nessun volo diretto confermato per queste date — solo con scalo:
              </div>
              <FlatList>
                {scaloResults.map((r, i) => (
                  <ResultRow
                    key={r.id}
                    result={r}
                    isLast={i === scaloResults.length - 1}
                    expanded={expandedId === r.id}
                    onToggle={() => toggleExpandScalo(r.id)}
                    verifiedPrice={scaloVerifiedData[r.id]?.price}
                    verifyData={scaloVerifiedData[r.id]}
                    onSaveFavorite={
                      user?.id
                        ? (price, isFresh) => addFavorite({ ...r, price, searchFilters: filters }, isFresh)
                        : undefined
                    }
                  />
                ))}
              </FlatList>
            </>
          )}
          {!verifyingScalo && scaloResults.length === 0 && (
            <>
              <div style={{ color: COLORS.inkSoft }}>
                Nessun volo reale trovato per queste date, nemmeno con scalo (compagnia e orario
                certi) — riprova con date diverse o una destinazione fissa.
              </div>
              <ScaloDebugPanel items={scaloDebugData} />
            </>
          )}
        </>
      )}
    </div>
  );
}
