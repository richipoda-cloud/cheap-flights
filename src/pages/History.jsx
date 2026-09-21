import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS, RADIUS } from "../theme/colors";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { SwipeToDelete } from "../components/SwipeToDelete";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useAuth } from "../hooks/useAuth";
import { useSearches } from "../hooks/useSearches";
import { cityName } from "../lib/cityNames";
import { destinationName } from "../lib/countryNames";
import { formatRelativeTime } from "../lib/formatters";

// Icona rotazione piena (arco ~300° + freccia), non il glifo unicode ↻ che risultava
// troppo sottile/incompleto — stroke currentColor per ereditare il bianco del bottone.
function RefreshIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path
        d="M21 12a9 9 0 1 1-3.2-6.88"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M21 3v6h-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function describeFilters(f) {
  const origin = f.origins?.map(cityName).join(", ") ?? "?";
  const dest = f.destination ? destinationName(f.destination) : "Ovunque";
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
  const { searches, loading, removeSearch, removeAllSearches } = useSearches(user?.id);
  const [confirmingClearAll, setConfirmingClearAll] = useState(false);

  const resume = (filters) => navigate("/results", { state: { filters } });

  return (
    <div style={{ padding: 20, paddingBottom: 130 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 20, color: COLORS.accent }}>Storico</div>
        {searches.length > 0 && (
          <button
            onClick={() => setConfirmingClearAll(true)}
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              fontSize: 11.5,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: COLORS.plum,
              background: COLORS.surface,
              border: `1px solid ${COLORS.hairline}`,
              borderRadius: RADIUS.pill,
              padding: "5px 12px",
              cursor: "pointer",
            }}
          >
            Cancella tutti
          </button>
        )}
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
                  <RefreshIcon /> Riprendi
                </PrimaryButton>
              </div>
            </Card>
          </SwipeToDelete>
        );
      })}

      <ConfirmDialog
        open={confirmingClearAll}
        title="Cancellare tutto lo storico?"
        message="Tutte le ricerche salvate verranno rimosse. L'operazione non si può annullare."
        confirmLabel="Cancella tutti"
        onCancel={() => setConfirmingClearAll(false)}
        onConfirm={() => {
          removeAllSearches();
          setConfirmingClearAll(false);
        }}
      />
    </div>
  );
}
