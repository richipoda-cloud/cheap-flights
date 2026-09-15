import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS, RADIUS } from "../theme/colors";
import { Card } from "../components/Card";
import { FlagIcon } from "../components/FlagIcon";
import { FreshnessBadge } from "../components/FreshnessBadge";
import { useAuth } from "../hooks/useAuth";
import { useFavorites } from "../hooks/useFavorites";

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FlagIcon countryCode={flight.countryCode} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.ink }}>
              {flight.destinationName ?? flight.destination}
            </div>
            <div style={{ fontSize: 12, color: COLORS.inkSoft }}>
              {flight.departDate} → {flight.returnDate}
            </div>
            <FreshnessBadge
              isFresh={fav.is_fresh}
              savedAt={fav.saved_at}
              price={fav.price}
              originalPrice={fav.original_price}
            />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
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
                cursor: verifying ? "default" : "pointer",
              }}
            >
              {verifying ? "…" : "🔄 Verifica prezzo"}
            </button>
          )}
        </div>
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
      <div style={{ fontWeight: 600, fontSize: 20, color: COLORS.accent, marginBottom: 16 }}>
        Preferiti
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
