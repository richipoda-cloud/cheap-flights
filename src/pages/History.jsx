import { useNavigate } from "react-router-dom";
import { COLORS } from "../theme/colors";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { useAuth } from "../hooks/useAuth";
import { useSearches } from "../hooks/useSearches";

function describeFilters(f) {
  const origin = f.origins?.join(", ") ?? "?";
  const dest = f.destination ?? "Ovunque";
  const dates = f.dateMode === "fixed" ? `${f.dateFrom} → ${f.dateTo}` : "Sempre";
  return `${origin} → ${dest} · ${dates}`;
}

export function History() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { searches, loading } = useSearches(user?.id);

  const resume = (filters) => navigate("/results", { state: { filters } });

  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontWeight: 600, fontSize: 20, color: COLORS.accent, marginBottom: 16 }}>
        Storico
      </div>

      {loading && <div style={{ color: COLORS.inkSoft }}>Caricamento…</div>}
      {!loading && searches.length === 0 && (
        <div style={{ color: COLORS.inkSoft }}>Nessuna ricerca ancora.</div>
      )}

      {searches.map((s) => (
        <Card key={s.id} style={{ padding: 14, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 13, color: COLORS.ink }}>{describeFilters(s.filters)}</div>
            <PrimaryButton onClick={() => resume(s.filters)}>↻ Riprendi</PrimaryButton>
          </div>
        </Card>
      ))}
    </div>
  );
}
