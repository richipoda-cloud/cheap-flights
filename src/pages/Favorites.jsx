import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS, RADIUS } from "../theme/colors";
import { Card } from "../components/Card";
import { FlagIcon } from "../components/FlagIcon";
import { FreshnessBadge } from "../components/FreshnessBadge";
import { useAuth } from "../hooks/useAuth";
import { useFavorites } from "../hooks/useFavorites";
import { cityName } from "../lib/cityNames";
import { formatDateRangeShort, formatRelativeTime } from "../lib/formatters";

function FavoriteCard({ fav, onOpen, onVerify }) {
  const [verifying, setVerifying] = useState(false);
  const flight = fav.flight_snapshot ?? {};
  const canVerify = !flight.isStopover; // percorsi creativi: niente singolo endpoint sensato

  const handleVerify = async (e) => {
    e.stopPropagation(); // non aprire il dettaglio, resta qui a vedere l'esito
    setVerifying(true);
    await onVerify(fav);
    setVerifying(false);
  };

  return (
    <Card onClick={onOpen} style={{ padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FlagIcon countryCode={flight.countryCode} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.ink }}>
              {cityName(flight.origin)} → {flight.destinationName ?? flight.destination}
            </div>
            <div style={{ fontSize: 12, color: COLORS.inkSoft }}>
              {formatDateRangeShort(flight.departDate, flight.returnDate)} · {flight.nights ?? "?"} notti
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: COLORS.accent }}>
            {fav.price} {fav.currency ?? "€"}
          </div>
          {canVerify && (
            <button
              onClick={handleVerify}
              disabled={verifying}
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 11,
                fontWeight: 600,
                color: COLORS.plum,
                background: "transparent",
                border: `1px solid ${COLORS.hairline}`,
                borderRadius: RADIUS.pill,
                padding: "4px 10px",
                marginTop: 6,
                cursor: verifying ? "default" : "pointer",
              }}
            >
              {verifying ? "…" : "🔄 Verifica prezzo"}
            </button>
          )}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 10,
          paddingTop: 10,
          borderTop: `1px dashed ${COLORS.hairline}`,
        }}
      >
        <span style={{ fontSize: 12, color: COLORS.inkSoft }}>Salvato {formatRelativeTime(fav.saved_at)}</span>
        <FreshnessBadge isFresh={fav.is_fresh} price={fav.price} originalPrice={fav.original_price} />
      </div>
    </Card>
  );
}

export function Favorites() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { favorites, loading, verifyFavorite } = useFavorites(user?.id);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span onClick={() => navigate(-1)} style={{ fontSize: 20, color: COLORS.ink, cursor: "pointer" }}>
          ←
        </span>
        <div style={{ fontWeight: 600, fontSize: 20, color: COLORS.accent }}>Preferiti</div>
      </div>

      {loading && <div style={{ color: COLORS.inkSoft }}>Caricamento…</div>}
      {!loading && favorites.length === 0 && (
        <div style={{ color: COLORS.inkSoft }}>Nessun volo salvato ancora.</div>
      )}

      {favorites.map((fav) => {
        const flight = fav.flight_snapshot ?? {};
        return (
          <FavoriteCard
            key={fav.id}
            fav={fav}
            onOpen={() => navigate("/flight", { state: { flight, filters: flight.searchFilters } })}
            onVerify={verifyFavorite}
          />
        );
      })}
    </div>
  );
}
