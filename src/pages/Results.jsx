import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { COLORS, RADIUS } from "../theme/colors";
import { FlagIcon } from "../components/FlagIcon";
import { LegBox } from "../components/LegBox";
import { LegRow } from "../components/LegRow";
import { PrimaryButton } from "../components/PrimaryButton";
import { searchDirect, searchStopover, verifyPrice } from "../lib/api";
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
            {verifiedPrice == null ? "~" : ""}
            {price} {result.currency ?? "€"}
          </div>
          {verifiedPrice != null && (
            <div style={{ fontSize: 10.5, color: COLORS.accent }}>✓ verificato</div>
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
            <>
              <LegBox
                title="Andata"
                leg={verifyData.outboundLeg}
                route={`${result.origin ?? "?"} → ${result.destination ?? "?"}`}
                date={result.departDate}
              />
              <LegBox
                title="Ritorno"
                leg={verifyData.inboundLeg}
                route={`${result.destination ?? "?"} → ${verifyData.inboundLeg?.destinationAirport ?? result.origin ?? "?"}`}
                date={result.returnDate}
              />
              {verifyData.returnsElsewhere && (
                <div style={{ fontSize: 11.5, color: COLORS.plum, marginBottom: 8, marginTop: -4 }}>
                  ✈️ Ritorno su {verifyData.inboundLeg.destinationAirport} invece di {result.origin} — conviene, ma
                  sono due biglietti separati
                </div>
              )}
              {verifyData.returnsElsewhere ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <PrimaryButton
                    variant="solid"
                    onClick={() => window.open(verifyData.outboundLeg?.deepLink, "_blank", "noopener,noreferrer")}
                    disabled={!verifyData.outboundLeg?.deepLink}
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    Prenota andata →
                  </PrimaryButton>
                  <PrimaryButton
                    variant="solid"
                    onClick={() => window.open(verifyData.inboundLeg?.deepLink, "_blank", "noopener,noreferrer")}
                    disabled={!verifyData.inboundLeg?.deepLink}
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
  const [stopoverResults, setStopoverResults] = useState([]);
  const [verifiedData, setVerifiedData] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [loadingDirect, setLoadingDirect] = useState(true);
  const [loadingStopover, setLoadingStopover] = useState(false);
  const [error, setError] = useState(null);
  const recordedRef = useRef(false);
  const mountedRef = useRef(true);
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
          // "Aeroporto di ritorno diverso dalla partenza": funzione distinta dai Percorsi
          // creativi (scalo/altra destinazione) — stessa destinazione, il ritorno viene
          // cercato su tutti gli aeroporti di Partenza dell'utente, non solo quello di andata.
          const payload = filters.flexArrival ? { ...r, homeAirports: filters.origins } : r;
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

    if (filters.flexDeparture) {
      setLoadingStopover(true);
      searchStopover(filters)
        .then((data) => setStopoverResults(data?.results ?? []))
        .catch((e) => setError(e.message))
        .finally(() => setLoadingStopover(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!filters) return null;

  const toggleExpand = (id) => setExpandedId((current) => (current === id ? null : id));

  return (
    <div style={{ padding: 20 }}>
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
      {directResults.length > 0 && (
        <FlatList>
          {directResults.map((r, i) => (
            <ResultRow
              key={r.id}
              result={r}
              isLast={i === directResults.length - 1}
              expanded={expandedId === r.id}
              onToggle={() => toggleExpand(r.id)}
              verifiedPrice={verifiedData[r.id]?.price}
              verifyData={verifiedData[r.id]}
            />
          ))}
        </FlatList>
      )}

      {filters.flexDeparture && (
        <>
          <div
            style={{
              fontWeight: 600,
              fontSize: 16,
              color: COLORS.plum,
              marginTop: 24,
              marginBottom: 12,
            }}
          >
            Percorsi creativi
          </div>
          <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 12 }}>
            Comprando andata e ritorno come due biglietti separati (invece che un unico A/R) a
            volte si risparmia — se compare "via" è un vero scalo intermedio, altrimenti è la
            stessa destinazione, solo un biglietto in più.
          </div>
          {loadingStopover && <div style={{ color: COLORS.inkSoft }}>Ricerca scali alternativi…</div>}
          {!loadingStopover && stopoverResults.length === 0 && (
            <div style={{ color: COLORS.inkSoft }}>Nessun percorso alternativo conveniente trovato.</div>
          )}
          {stopoverResults.length > 0 && (
            <FlatList>
              {stopoverResults.map((r, i) => (
                <ResultRow
                  key={r.id}
                  result={r}
                  isLast={i === stopoverResults.length - 1}
                  expanded={expandedId === r.id}
                  onToggle={() => toggleExpand(r.id)}
                />
              ))}
            </FlatList>
          )}
        </>
      )}
    </div>
  );
}
