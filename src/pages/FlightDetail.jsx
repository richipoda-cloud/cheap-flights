import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { COLORS, RADIUS } from "../theme/colors";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import { FlagIcon } from "../components/FlagIcon";
import { PrimaryButton } from "../components/PrimaryButton";
import { LegBox, formatTime } from "../components/LegBox";
import { verifyPrice } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useFavorites } from "../hooks/useFavorites";
import { cityName } from "../lib/cityNames";

// Un "percorso creativo" è N biglietti one-way separati e indipendenti (non un unico
// volo con scalo): ognuno va prenotato per conto proprio, col proprio deep link.
// Orario/compagnia/deep link arrivano già pronti da search-stopover (v3/prices_for_dates,
// one-way) — niente fetch di verifica extra, il prezzo è già quello trovato in ricerca.
function MultiLegTicket({ index, total, leg }) {
  const handleBooking = () => {
    if (leg.deepLink) window.open(leg.deepLink, "_blank", "noopener,noreferrer");
  };

  return (
    <Card style={{ padding: 16, marginBottom: 16, border: `1px solid ${COLORS.plum}` }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.plum, marginBottom: 8 }}>
        BIGLIETTO {index} DI {total}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: COLORS.ink }}>
          {leg.originAirport} → {leg.destinationAirport}
        </div>
        {leg.duration != null && (
          <div style={{ fontSize: 13, color: COLORS.inkSoft }}>{leg.duration} min</div>
        )}
      </div>
      <div style={{ fontSize: 13, color: COLORS.inkSoft, marginBottom: 12 }}>
        {leg.date} · {formatTime(leg.departureAt)} · {leg.airlineName ?? leg.airline}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16, color: COLORS.ink }}>{leg.price} €</div>
          <div style={{ fontSize: 11, color: COLORS.inkSoft }}>Prezzo dalla ricerca</div>
        </div>
        <PrimaryButton variant="solid" onClick={handleBooking} disabled={!leg.deepLink}>
          Prenota biglietto {index} →
        </PrimaryButton>
      </div>
    </Card>
  );
}

export function FlightDetail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addFavorite } = useFavorites(user?.id);

  const flight = location.state?.flight;
  const filters = location.state?.filters;

  const [verifiedPrice, setVerifiedPrice] = useState(null);
  const [deepLink, setDeepLink] = useState(flight?.deepLink ?? null);
  const [outboundLeg, setOutboundLeg] = useState(null);
  const [inboundLeg, setInboundLeg] = useState(null);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!flight) {
      navigate("/results");
      return;
    }
    if (flight.isStopover || (flight.viaHub && !Array.isArray(flight.legs))) {
      // stopover valido: verifica gestita dai MultiLegTicket, indipendenti
      // schema legacy: dato inaffidabile, non ha senso verificarlo — vedi isLegacySchema sotto
      setVerifying(false);
      return;
    }
    setVerifying(true);
    verifyPrice(flight)
      .then((data) => {
        setVerifiedPrice(data?.price ?? flight.price);
        if (data?.deepLink) setDeepLink(data.deepLink);
        if (data?.outboundLeg) setOutboundLeg(data.outboundLeg);
        if (data?.inboundLeg) setInboundLeg(data.inboundLeg);
      })
      .catch((e) => setError(e.message))
      .finally(() => setVerifying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!flight) return null;

  // Un preferito salvato da una versione precedente dell'app (percorso creativo con lo
  // schema vecchio leg1/leg2, o ancora prima) non ha legs[] — mostrarlo come se fosse
  // valido darebbe un itinerario incompleto o fuorviante (tratte mancanti, date perse).
  const isLegacySchema = Boolean(flight.viaHub) && !Array.isArray(flight.legs);

  const nights = flight.nights ?? "?";

  const handleBooking = () => {
    if (deepLink) window.open(deepLink, "_blank", "noopener,noreferrer");
  };

  const handleSaveFavorite = () => {
    addFavorite({ ...flight, price: verifiedPrice ?? flight.price, searchFilters: filters });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  return (
    <div style={{ padding: 20, paddingBottom: flight.isStopover ? 130 : 220 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <span onClick={() => navigate(-1)} style={{ fontSize: 20, color: COLORS.ink, cursor: "pointer" }}>
          ←
        </span>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FlagIcon countryCode={flight.countryCode} size={24} />
            <div style={{ fontWeight: 600, fontSize: 18, color: COLORS.ink }}>
              {cityName(flight.origin)} → {flight.destinationName ?? flight.destination}
            </div>
          </div>
          <Pill tone="accent">{nights} notti</Pill>
        </div>
      </div>

      {isLegacySchema ? (
        <div
          style={{
            background: COLORS.cream,
            border: `1px solid ${COLORS.warn}`,
            color: COLORS.warn,
            borderRadius: RADIUS.button,
            padding: "14px 16px",
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.5,
            marginBottom: 16,
          }}
        >
          ⚠️ Questo preferito è stato salvato con una versione precedente dell'app e potrebbe
          non essere più accurato — rifai la ricerca per un dato aggiornato.
        </div>
      ) : flight.isStopover ? (
        <>
          <div
            style={{
              background: COLORS.plumSoft,
              color: COLORS.plum,
              borderRadius: RADIUS.button,
              padding: "10px 14px",
              fontSize: 12.5,
              fontWeight: 600,
              marginBottom: 16,
              lineHeight: 1.4,
            }}
          >
            ✂️ Viaggio in {flight.legs.length} biglietti separati{flight.viaHub ? ` (via ${flight.viaHub})` : ""} —
            completa tutti gli acquisti, non solo l'ultimo. Prezzo totale indicativo: {flight.price} €.
          </div>

          {flight.legs.map((leg, i) => {
            const nextLeg = flight.legs[i + 1];
            // Stesso codice città (es. TCI) ma aeroporti fisicamente diversi (es. TFS/TFN
            // a Tenerife): l'itinerario resta valido ma serve un trasferimento in loco.
            const airportChange = nextLeg && nextLeg.originAirport !== leg.destinationAirport;
            return (
              <div key={leg.id}>
                <MultiLegTicket index={i + 1} total={flight.legs.length} leg={leg} />
                {airportChange && (
                  <div
                    style={{
                      background: COLORS.cream,
                      border: `1px solid ${COLORS.warn}`,
                      color: COLORS.warn,
                      borderRadius: RADIUS.button,
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      marginBottom: 16,
                      marginTop: -8,
                    }}
                  >
                    ⚠️ Attenzione: cambio aeroporto ({leg.destinationAirport} → {nextLeg.originAirport}),
                    verifica il trasferimento
                  </div>
                )}
              </div>
            );
          })}
        </>
      ) : (
        <>
          <LegBox
            title="Andata"
            leg={outboundLeg}
            route={`${flight.origin ?? "?"} → ${flight.destination ?? "?"}`}
            date={flight.departDate}
          />
          <LegBox
            title="Ritorno"
            leg={inboundLeg}
            route={`${flight.destination ?? "?"} → ${flight.origin ?? "?"}`}
            date={flight.returnDate}
          />
        </>
      )}

      {error && <div style={{ color: COLORS.warn, marginBottom: 12 }}>{error}</div>}

      {!isLegacySchema && (
        <button
          onClick={handleSaveFavorite}
          disabled={justSaved}
          style={{
            background: justSaved ? COLORS.accentSoft : "transparent",
            border: `1px solid ${justSaved ? COLORS.accent : COLORS.hairline}`,
            borderRadius: RADIUS.button,
            padding: "10px 16px",
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: 13,
            color: justSaved ? COLORS.accent : COLORS.plum,
            cursor: justSaved ? "default" : "pointer",
          }}
        >
          {justSaved ? "✓ Salvato nei preferiti" : "★ Salva nei preferiti"}
        </button>
      )}

      {!flight.isStopover && !isLegacySchema && (
        <div
          style={{
            position: "fixed",
            bottom: "calc(max(28px, env(safe-area-inset-bottom)) + 112px)",
            left: 0,
            right: 0,
            padding: 16,
            background: COLORS.bg,
            borderTop: `1px solid ${COLORS.hairline}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 18, color: COLORS.ink }}>
              {verifying ? "…" : `${verifiedPrice ?? flight.price} €`}
            </div>
            <div style={{ fontSize: 11, color: COLORS.inkSoft }}>
              {verifying ? "Verifica in corso…" : "Prezzo verificato ora"}
            </div>
          </div>
          <PrimaryButton variant="solid" onClick={handleBooking} disabled={verifying || !deepLink}>
            Vai alla prenotazione →
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}
