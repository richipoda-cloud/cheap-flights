import { COLORS } from "../theme/colors";
import { Card } from "./Card";
import { BookingAction } from "./BookingAction";
import { formatTime } from "./LegBox";

// Un percorso creativo ha già legs[] con orario/compagnia/deep link pronti dalla ricerca
// (niente endpoint di verifica per-biglietto sensato, come nel dettaglio volo) — ogni
// tratta è un biglietto separato e va prenotata a sé.
export function LegRow({ index, total, leg }) {
  return (
    <Card style={{ padding: 12, marginTop: 8, border: `1px solid ${COLORS.plum}` }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.plum, marginBottom: 6 }}>
        BIGLIETTO {index} DI {total}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink }}>
          {leg.originAirport} → {leg.destinationAirport}
        </div>
        <div style={{ fontSize: 12, color: COLORS.inkSoft }}>
          {leg.date} · {formatTime(leg.departureAt)}
        </div>
      </div>
      <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 8 }}>{leg.airlineName ?? leg.airline}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink, flexShrink: 0 }}>{leg.price} €</div>
        <BookingAction deepLink={leg.deepLink} airlineName={leg.airlineName ?? leg.airline} label={`Prenota ${index} →`} style={{ flex: leg.deepLink ? undefined : 1 }} />
      </div>
    </Card>
  );
}
