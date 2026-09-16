import { COLORS } from "../theme/colors";
import { Card } from "./Card";
import { PrimaryButton } from "./PrimaryButton";
import { formatTime } from "./LegBox";

// Un percorso creativo ha già legs[] con orario/compagnia/deep link pronti dalla ricerca
// (niente endpoint di verifica per-biglietto sensato, come nel dettaglio volo) — ogni
// tratta è un biglietto separato e va prenotata a sé.
export function LegRow({ index, total, leg }) {
  const handleBooking = () => {
    if (leg.deepLink) window.open(leg.deepLink, "_blank", "noopener,noreferrer");
  };
  return (
    <Card style={{ padding: 12, marginTop: 8, border: `1px solid ${COLORS.plum}` }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.plum, marginBottom: 6 }}>
        BIGLIETTO {index} DI {total}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink }}>
          {leg.originAirport} → {leg.destinationAirport}
        </div>
        <div style={{ fontSize: 12, color: COLORS.inkSoft }}>
          {leg.date} · {formatTime(leg.departureAt)}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink }}>{leg.price} €</div>
        <PrimaryButton variant="solid" onClick={handleBooking} disabled={!leg.deepLink}>
          Prenota {index} →
        </PrimaryButton>
      </div>
    </Card>
  );
}
