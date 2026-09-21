import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { COLORS, RADIUS } from "../theme/colors";
import { FlagIcon } from "../components/FlagIcon";
import { LegBox } from "../components/LegBox";
import { LegRow } from "../components/LegRow";
import { PrimaryButton } from "../components/PrimaryButton";
import { searchDirect, verifyPrice } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useSearches } from "../hooks/useSearches";

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

// Espande sul posto invece di navigare al dettaglio (stesso pattern di Preferiti) —
// per i diretti riusa il verifyData già ottenuto per il badge "✓ verificato" (nessuna
// chiamata doppia), per i percorsi creativi mostra le tratte già pronte da search-stopover.
function ResultRow({ result, isLast, expanded, onToggle, verifiedPrice, verifyData }) {
  const price = verifiedPrice ?? result.price;
  const deepLink = verifyData?.deepLink ?? result.deepLink;
  // "✓ verificato" solo se verify-price ha davvero trovato cache abbastanza fresca da
  // confermare il prezzo (somma tratte one-way o match aggregato) — se è ricaduto sul
  // prezzo originale non ricontrollato, resta onestamente "~" come i risultati non ancora
  // verificati, invece di promettere un'affidabilità che non c'è.
  const confirmed = Boolean(verifyData?.confirmed);

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
            <div style={{ fontSize: 10.5, color: COLORS.accent }}>✓ verificato</div>
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
            result.legs?.map((leg, i) => (
              <LegRow key={leg.id} index={i + 1} total={result.legs.length} leg={leg} />
            ))
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
                  />
                  <LegBox
                    title="Ritorno"
                    leg={inboundLeg}
                    route={`${inboundLeg?.originAirport ?? result.destination ?? "?"} → ${inboundLeg?.destinationAirport ?? result.origin ?? "?"}`}
                    date={result.returnDate}
                  />
                  {verifyData.returnsElsewhere && (
                    <div style={{ fontSize: 11.5, color: COLORS.plum, marginBottom: 8, marginTop: -4 }}>
                      ✈️ Ritorno {inboundLeg.originAirport}→{inboundLeg.destinationAirport} invece di{" "}
                      {result.destination}→{result.origin} — conviene, ma sono due biglietti separati
                    </div>
                  )}
                  {verifyData.returnsElsewhere ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <PrimaryButton
                        variant="solid"
                        onClick={() => window.open(outboundLeg?.deepLink, "_blank", "noopener,noreferrer")}
                        disabled={!outboundLeg?.deepLink}
                        style={{ flex: 1, justifyContent: "center" }}
                      >
                        Prenota andata →
                      </PrimaryButton>
                      <PrimaryButton
                        variant="solid"
                        onClick={() => window.open(inboundLeg?.deepLink, "_blank", "noopener,noreferrer")}
                        disabled={!inboundLeg?.deepLink}
                        style={{ flex: 1, justifyContent: "center" }}
                      >
                        Prenota ritorno →
                      </PrimaryButton>
                    </div>
                  ) : (
                    <PrimaryButton
                      variant="solid"
                      onClick={() => window.open(deepLink, "_blank", "noopener,noreferrer")}
                      disabled={!deepLink}
                      style={{ width: "100%", justifyContent: "center" }}
                    >
                      Vai alla prenotazione →
                    </PrimaryButton>
                  )}
                </>
              );
            })()
          ) : (
            <div style={{ fontSize: 12.5, color: COLORS.inkSoft }}>Carico orari…</div>
          )}
        </div>
      )}
    </div>
  );
}

export function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { recordSearch } = useSearches(user?.id);

  const filters = location.state?.filters;
  const [directResults, setDirectResults] = useState([]);
  const [verifiedData, setVerifiedData] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [loadingDirect, setLoadingDirect] = useState(true);
  const [error, setError] = useState(null);
  const recordedRef = useRef(false);
  const mountedRef = useRef(true);
  const stopCheckedRef = useRef(new Set());
  useEffect(() => () => (mountedRef.current = false), []);

  // Separato dall'effect di ricerca: user?.id arriva async (sessione risolta dopo il
  // mount), quindi va aspettato con la sua dependency, non catturato nella closure
  // stale di un effect a dependency [] — altrimenti recordSearch(userId=undefined)
  // ritorna subito senza salvare nulla, silenziosamente.
  useEffect(() => {
    if (!filters || !user?.id || recordedRef.current) return;
    recordedRef.current = true;
    recordSearch(filters);
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
          };
          verifyPrice(payload)
            .then((v) => {
              if (!mountedRef.current || v?.price == null) return;
              setVerifiedData((prev) => ({ ...prev, [r.id]: v }));
            })
            .catch(() => {});
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
  const sortedResults = useMemo(() => {
    return [...directResults].sort((a, b) => {
      const priceA = verifiedData[a.id]?.price ?? a.price;
      const priceB = verifiedData[b.id]?.price ?? b.price;
      return priceA - priceB;
    });
  }, [directResults, verifiedData]);

  if (!filters) return null;

  const toggleExpand = (id) => {
    setExpandedId((current) => (current === id ? null : id));
    // "Andata/Ritorno con scalo": ricerca costosa (5 hub candidati x 2 chiamate ciascuno),
    // per questo NON gira per tutti i 10 risultati come le altre flessibilità, ma solo per
    // la card che l'utente apre davvero, e solo una volta (stopCheckedRef).
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

  return (
    <div style={{ padding: 20, paddingBottom: 130 }}>
      <div style={{ fontWeight: 600, fontSize: 20, color: COLORS.accent, marginBottom: 4 }}>
        Risultati
      </div>
      <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 16 }}>
        Prezzi indicativi (~) — si aggiornano da soli in pochi secondi
      </div>

      {error && <div style={{ color: COLORS.warn, marginBottom: 12 }}>{error}</div>}

      {loadingDirect && <div style={{ color: COLORS.inkSoft }}>Ricerca in corso…</div>}
      {!loadingDirect && directResults.length === 0 && (
        <div style={{ color: COLORS.inkSoft }}>Nessun risultato diretto trovato.</div>
      )}
      {sortedResults.length > 0 && (
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
            />
          ))}
        </FlatList>
      )}
    </div>
  );
}
