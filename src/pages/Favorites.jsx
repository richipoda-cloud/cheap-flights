import { useNavigate } from "react-router-dom";
import { COLORS } from "../theme/colors";
import { Card } from "../components/Card";
import { FlagIcon } from "../components/FlagIcon";
import { FreshnessBadge } from "../components/FreshnessBadge";
import { useAuth } from "../hooks/useAuth";
import { useFavorites } from "../hooks/useFavorites";

export function Favorites() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { favorites, loading } = useFavorites(user?.id);

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
          <Card
            key={fav.id}
            onClick={() => navigate("/flight", { state: { flight, filters: flight.searchFilters } })}
            style={{ padding: 14, marginBottom: 10 }}
          >
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
                  <FreshnessBadge isFresh={fav.is_fresh} savedAt={fav.saved_at} />
                </div>
              </div>
              <div style={{ fontWeight: 600, fontSize: 15, color: COLORS.accent }}>
                {fav.price} {fav.currency ?? "€"}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
