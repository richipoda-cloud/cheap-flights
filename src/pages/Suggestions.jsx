import { useEffect, useMemo, useRef, useState } from "react";
import { COLORS } from "../theme/colors";
import { Card } from "../components/Card";
import { FlagIcon } from "../components/FlagIcon";
import { LegBox } from "../components/LegBox";
import { BookingAction } from "../components/BookingAction";
import { searchDirect, verifyPrice } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useSuggestions } from "../hooks/useSuggestions";

export function Suggestions() {
  const { user } = useAuth();
  const { suggestions, loading: loadingSuggestions } = useSuggestions(user?.id);

  const [results, setResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [verifiedData, setVerifiedData] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const mountedRef = useRef(true);
  useEffect(() => () => (mountedRef.current = false), []);

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
      .then((data) => {
        const list = data?.results ?? [];
        setResults(list);
        // Stesso trattamento di Risultati: lista corta (10 al massimo lato server),
        // verificata tutta dal vivo appena arriva invece di restare solo indicativa.
        list.forEach((r) => {
          verifyPrice(r)
            .then((v) => {
              if (!mountedRef.current || v?.price == null) return;
              setVerifiedData((prev) => ({ ...prev, [r.id]: v }));
            })
            .catch(() => {});
        });
      })
      .finally(() => setLoadingResults(false));
  }, [loadingSuggestions, suggestions]);

  const toggleExpand = (id) => setExpandedId((current) => (current === id ? null : id));

  // Stesso fix di Results.jsx: il prezzo verificato può differire da quello aggregato
  // usato per l'ordinamento iniziale — riordina col prezzo più affidabile disponibile.
  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      const priceA = verifiedData[a.id]?.price ?? a.price;
      const priceB = verifiedData[b.id]?.price ?? b.price;
      return priceA - priceB;
    });
  }, [results, verifiedData]);

  const reasonFor = () => {
    const origin = suggestions.topOrigins[0];
    const nights = suggestions.topNights;
    if (origin && nights) return `Parti spesso da ${origin}, viaggi tipici di ${nights} notti`;
    if (origin) return `Parti spesso da ${origin}`;
    return "Basato sulle tue ricerche recenti";
  };

  return (
    <div style={{ padding: 20, paddingBottom: 130 }}>
      <div style={{ fontWeight: 600, fontSize: 20, color: COLORS.accent, marginBottom: 4 }}>
        Suggeriti per te
      </div>
      {results.length > 0 && (
        <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 16 }}>
          Prezzi indicativi (~) — si aggiornano da soli in pochi secondi
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

      {sortedResults.map((r) => {
        const verify = verifiedData[r.id];
        const price = verify?.price ?? r.price;
        const confirmed = Boolean(verify?.confirmed);
        const expanded = expandedId === r.id;
        return (
          <Card key={r.id} onClick={() => toggleExpand(r.id)} style={{ padding: 14, marginBottom: 10 }}>
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
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: COLORS.accent }}>
                  {confirmed ? "" : "~"}
                  {price} {r.currency ?? "€"}
                </div>
                {confirmed ? (
                  <div style={{ fontSize: 10.5, color: COLORS.accent }}>✓ verificato</div>
                ) : (
                  verify != null && (
                    <div style={{ fontSize: 10.5, color: COLORS.inkSoft }}>da confermare al link</div>
                  )
                )}
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: COLORS.plum, marginTop: 6 }}>{reasonFor()}</div>

            {expanded && (
              <div style={{ marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
                {verify ? (
                  <>
                    <LegBox
                      title="Andata"
                      leg={verify.outboundLeg}
                      route={`${r.origin ?? "?"} → ${r.destination ?? "?"}`}
                      date={r.departDate}
                    />
                    <LegBox
                      title="Ritorno"
                      leg={verify.inboundLeg}
                      route={`${r.destination ?? "?"} → ${r.origin ?? "?"}`}
                      date={r.returnDate}
                    />
                    <BookingAction
                      deepLink={verify.deepLink ?? r.deepLink}
                      airlineName={verify.outboundLeg?.airlineName ?? verify.outboundLeg?.airline ?? verify.inboundLeg?.airlineName ?? verify.inboundLeg?.airline}
                      route={`${r.origin ?? "?"} → ${r.destination ?? "?"}`}
                      departDate={r.departDate}
                      returnDate={r.returnDate}
                      style={{ width: "100%", justifyContent: "center" }}
                    />
                  </>
                ) : (
                  <div style={{ fontSize: 12.5, color: COLORS.inkSoft }}>Carico orari…</div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
