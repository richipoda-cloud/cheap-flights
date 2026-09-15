import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { COLORS } from "../theme/colors";
import { Card } from "../components/Card";
import { FlagIcon } from "../components/FlagIcon";
import { searchDirect, searchStopover } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useSearches } from "../hooks/useSearches";

function ResultRow({ result, filters, onClick }) {
  return (
    <Card onClick={onClick} style={{ padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FlagIcon countryCode={result.countryCode} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.ink }}>
              {result.destinationName ?? result.destination}
            </div>
            <div style={{ fontSize: 12, color: COLORS.inkSoft }}>
              {result.departDate} → {result.returnDate}
            </div>
          </div>
        </div>
        <div style={{ fontWeight: 600, fontSize: 15, color: COLORS.accent }}>
          {result.price} {result.currency ?? "€"}
        </div>
      </div>
    </Card>
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
      <div style={{ fontWeight: 600, fontSize: 20, color: COLORS.accent, marginBottom: 16 }}>
        Risultati
      </div>

      {error && <div style={{ color: COLORS.warn, marginBottom: 12 }}>{error}</div>}

      {loadingDirect && <div style={{ color: COLORS.inkSoft }}>Ricerca in corso…</div>}
      {!loadingDirect && directResults.length === 0 && (
        <div style={{ color: COLORS.inkSoft }}>Nessun risultato diretto trovato.</div>
      )}
      {directResults.map((r) => (
        <ResultRow key={r.id} result={r} filters={filters} onClick={() => openDetail(r)} />
      ))}

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
          {stopoverResults.map((r) => (
            <ResultRow key={r.id} result={r} filters={filters} onClick={() => openDetail(r)} />
          ))}
        </>
      )}
    </div>
  );
}
