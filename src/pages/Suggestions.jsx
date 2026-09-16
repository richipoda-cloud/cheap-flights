import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS } from "../theme/colors";
import { Card } from "../components/Card";
import { FlagIcon } from "../components/FlagIcon";
import { searchDirect } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useSuggestions } from "../hooks/useSuggestions";

export function Suggestions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { suggestions, loading: loadingSuggestions } = useSuggestions(user?.id);

  const [results, setResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);

  useEffect(() => {
    if (loadingSuggestions || suggestions.topOrigins.length === 0) return;
    const [nightsMin, nightsMax] = (suggestions.topNights ?? "").split("-").map(Number);
    const filters = {
      origins: suggestions.topOrigins,
      destination: null,
      dateMode: "anytime",
      nightsMin: Number.isFinite(nightsMin) ? nightsMin : null,
      nightsMax: Number.isFinite(nightsMax) ? nightsMax : null,
      flexDeparture: false,
      flexArrival: false,
    };
    setLoadingResults(true);
    searchDirect(filters)
      .then((data) => setResults(data?.results ?? []))
      .finally(() => setLoadingResults(false));
  }, [loadingSuggestions, suggestions]);

  const reasonFor = () => {
    const origin = suggestions.topOrigins[0];
    const nights = suggestions.topNights;
    if (origin && nights) return `Parti spesso da ${origin}, viaggi tipici di ${nights} notti`;
    if (origin) return `Parti spesso da ${origin}`;
    return "Basato sulle tue ricerche recenti";
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontWeight: 600, fontSize: 20, color: COLORS.accent, marginBottom: 4 }}>
        Suggeriti per te
      </div>
      {results.length > 0 && (
        <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 16 }}>
          Prezzi indicativi (~) — si confermano aprendo il dettaglio del volo
        </div>
      )}

      {(loadingSuggestions || loadingResults) && (
        <div style={{ color: COLORS.inkSoft }}>Caricamento…</div>
      )}
      {!loadingSuggestions && suggestions.topOrigins.length === 0 && (
        <div style={{ color: COLORS.inkSoft }}>
          Fai qualche ricerca: qui compariranno suggerimenti basati sulle tue abitudini.
        </div>
      )}

      {results.map((r) => (
        <Card
          key={r.id}
          onClick={() => navigate("/flight", { state: { flight: r } })}
          style={{ padding: 14, marginBottom: 10 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <FlagIcon countryCode={r.countryCode} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.ink }}>
                  {r.destinationName ?? r.destination}
                </div>
                <div style={{ fontSize: 12, color: COLORS.inkSoft }}>
                  {r.departDate} → {r.returnDate}
                </div>
              </div>
            </div>
            <div style={{ fontWeight: 600, fontSize: 15, color: COLORS.accent }}>
              ~{r.price} {r.currency ?? "€"}
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: COLORS.plum, marginTop: 6 }}>{reasonFor()}</div>
        </Card>
      ))}
    </div>
  );
}
