import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { COLORS, RADIUS } from "../theme/colors";
import { Card } from "../components/Card";
import { Pill } from "../components/Pill";
import { FlagIcon } from "../components/FlagIcon";
import { PrimaryButton } from "../components/PrimaryButton";
import { verifyPrice } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useFavorites } from "../hooks/useFavorites";

// v2/prices/latest (Data API gratuita) non fornisce orari/compagnia/durata per singolo
// volo, solo un prezzo aggregato per coppia di date — quel dettaglio si vede solo al
// passo di prenotazione (deep link). Se in futuro un leg dettagliato è disponibile,
// questo componente lo mostra per intero; altrimenti mostra rotta+data note onestamente.
function LegBox({ title, leg, route, date }) {
  if (leg) {
    return (
      <Card style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.inkSoft, marginBottom: 8 }}>
          {title}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: COLORS.ink }}>
            {leg.originAirport} → {leg.destinationAirport}
          </div>
          <div style={{ fontSize: 13, color: COLORS.inkSoft }}>{leg.duration}</div>
        </div>
        <div style={{ fontSize: 13, color: COLORS.inkSoft }}>
          {leg.departTime} — {leg.arriveTime} · {leg.airline}
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.inkSoft, marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: COLORS.ink }}>{route}</div>
        <div style={{ fontSize: 13, color: COLORS.inkSoft }}>{date}</div>
      </div>
      <div style={{ fontSize: 12, color: COLORS.inkSoft, fontStyle: "italic" }}>
        Orari e compagnia disponibili al passo di prenotazione
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
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!flight) {
      navigate("/results");
      return;
    }
    setVerifying(true);
    verifyPrice(flight)
      .then((data) => {
        setVerifiedPrice(data?.price ?? flight.price);
        if (data?.deepLink) setDeepLink(data.deepLink);
      })
      .catch((e) => setError(e.message))
      .finally(() => setVerifying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!flight) return null;

  const nights = flight.nights ?? "?";

  const handleBooking = () => {
    if (deepLink) window.open(deepLink, "_blank", "noopener,noreferrer");
  };

  const handleSaveFavorite = () => {
    addFavorite({ ...flight, price: verifiedPrice ?? flight.price, searchFilters: filters });
  };

  return (
    <div style={{ padding: 20, paddingBottom: 100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FlagIcon countryCode={flight.countryCode} size={28} />
          <div style={{ fontWeight: 600, fontSize: 20, color: COLORS.ink }}>
            {flight.destinationName ?? flight.destination}
          </div>
        </div>
        <Pill tone="accent">{nights} notti</Pill>
      </div>

      <LegBox
        title="Andata"
        leg={flight.outbound}
        route={`${flight.origin ?? "?"} → ${flight.destination ?? "?"}`}
        date={flight.departDate}
      />
      <LegBox
        title="Ritorno"
        leg={flight.inbound}
        route={`${flight.destination ?? "?"} → ${flight.origin ?? "?"}`}
        date={flight.returnDate}
      />

      {error && <div style={{ color: COLORS.warn, marginBottom: 12 }}>{error}</div>}

      <button
        onClick={handleSaveFavorite}
        style={{
          background: "transparent",
          border: `1px solid ${COLORS.hairline}`,
          borderRadius: RADIUS.button,
          padding: "10px 16px",
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600,
          fontSize: 13,
          color: COLORS.plum,
          cursor: "pointer",
        }}
      >
        ★ Salva nei preferiti
      </button>

      <div
        style={{
          position: "fixed",
          bottom: 0,
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
          Vai alla prenotazione
        </PrimaryButton>
      </div>
    </div>
  );
}
