import { useNavigate } from "react-router-dom";
import { COLORS } from "../theme/colors";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { SwipeToDelete } from "../components/SwipeToDelete";
import { useAuth } from "../hooks/useAuth";
import { useSearches } from "../hooks/useSearches";
import { cityName } from "../lib/cityNames";
import { formatRelativeTime } from "../lib/formatters";

function describeFilters(f) {
  const origin = f.origins?.map(cityName).join(", ") ?? "?";
  const dest = f.destination ? cityName(f.destination) : "Ovunque";
  const dates = f.dateMode === "fixed" ? `${f.dateFrom} → ${f.dateTo}` : "Sempre";
  return `${origin} → ${dest} · ${dates}`;
}

// Riga secondaria: senza questa, ricerche diverse verso la stessa destinazione/date
// (es. con o senza scalo libero, notti diverse) risultavano indistinguibili in lista.
function describeDetails(f) {
  const parts = [];
  if (f.nightsMin != null || f.nightsMax != null) {
    parts.push(`${f.nightsMin ?? 0}-${f.nightsMax ?? "∞"} notti`);
  }
  if (f.flexDeparture || f.flexArrival) {
    const which = [f.flexDeparture && "ripartenza", f.flexArrival && "arrivo"].filter(Boolean).join(" e ");
    parts.push(`scalo libero (${which})`);
  }
  if (f.excludedCountries?.length) {
    parts.push(`esclusi ${f.excludedCountries.length} paes${f.excludedCountries.length === 1 ? "e" : "i"}`);
  }
  return parts.join(" · ");
}

export function History() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { searches, loading, removeSearch } = useSearches(user?.id);

  const resume = (filters) => navigate("/results", { state: { filters } });

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span onClick={() => navigate(-1)} style={{ fontSize: 20, color: COLORS.ink, cursor: "pointer" }}>
          ←
        </span>
        <div style={{ fontWeight: 600, fontSize: 20, color: COLORS.accent }}>Storico</div>
      </div>

      {loading && <div style={{ color: COLORS.inkSoft }}>Caricamento…</div>}
      {!loading && searches.length === 0 && (
        <div style={{ color: COLORS.inkSoft }}>Nessuna ricerca ancora.</div>
      )}

      {searches.map((s) => {
        const details = describeDetails(s.filters);
        return (
          <SwipeToDelete key={s.id} onDelete={() => removeSearch(s.id)}>
            <Card style={{ padding: 14, marginBottom: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink }}>{describeFilters(s.filters)}</div>
                  {details && (
                    <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginTop: 2 }}>{details}</div>
                  )}
                  <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginTop: 4 }}>
                    {formatRelativeTime(s.created_at)}
                  </div>
                </div>
                <PrimaryButton variant="solid" onClick={() => resume(s.filters)}>
                  ↻ Riprendi
                </PrimaryButton>
              </div>
            </Card>
          </SwipeToDelete>
        );
      })}
    </div>
  );
}
