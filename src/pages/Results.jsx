import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { COLORS, RADIUS } from "../theme/colors";
import { FlagIcon } from "../components/FlagIcon";
import { searchDirect, searchStopover } from "../lib/api";
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

function ResultRow({ result, isLast, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "14px 16px",
        borderBottom: isLast ? "none" : `1px solid ${COLORS.hairline}`,
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
            {result.isStopover && ` · via ${result.viaHub}`}
          </div>
          {result.nights != null && (
            <div style={{ fontSize: 11.5, color: COLORS.inkSoft }}>{result.nights} notti</div>
          )}
        </div>
      </div>
      <div style={{ fontWeight: 600, fontSize: 15, color: COLORS.accent }}>
        ~{result.price} {result.currency ?? "€"}
      </div>
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
  const [loadingDirect, setLoadingDirect] = useState(true);
  const [loadingStopover, setLoadingStopover] = useState(false);
  const [error, setError] = useState(null);
  const recordedRef = useRef(false);

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
      .then((data) => setDirectResults(data?.results ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoadingDirect(false));

    if (filters.flexDeparture || filters.flexArrival) {
      setLoadingStopover(true);
      searchStopover(filters)
        .then((data) => setStopoverResults(data?.results ?? []))
        .catch((e) => setError(e.message))
        .finally(() => setLoadingStopover(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!filters) return null;

  const openDetail = (result) => navigate("/flight", { state: { flight: result, filters } });

  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontWeight: 600, fontSize: 20, color: COLORS.accent, marginBottom: 4 }}>
        Risultati
      </div>
      <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 16 }}>
        Prezzi indicativi (~) — si confermano aprendo il dettaglio del volo
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
              onClick={() => openDetail(r)}
            />
          ))}
        </FlatList>
      )}

      {(filters.flexDeparture || filters.flexArrival) && (
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
                  onClick={() => openDetail(r)}
                />
              ))}
            </FlatList>
          )}
        </>
      )}
    </div>
  );
}
