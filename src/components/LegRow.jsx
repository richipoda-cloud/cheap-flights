import { COLORS } from "../theme/colors";
import { Card } from "./Card";
import { BookingAction } from "./BookingAction";
import { formatTime } from "./LegBox";

// Un percorso creativo ha già legs[] con orario/compagnia/deep link pronti dalla ricerca
// (niente endpoint di verifica per-biglietto sensato, come nel dettaglio volo) — ogni
// tratta è un biglietto separato e va prenotata a sé.
//
// leg.approxDate (aggiunto 02/10/2026, stesso avviso già usato in LegBox): il fallback
// "con scalo" automatico ora accetta una tolleranza di qualche giorno sulla data quando la
// cache non ha un match esatto (richiesta esplicita dell'utente, vedi verify-price/index.ts)
// — senza questo avviso l'utente non avrebbe modo di saperlo, visto che le tratte con scalo
// passano sempre da qui (LegRow), non da LegBox.
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
      {leg.approxDate && (
        <div style={{ fontSize: 11, fontStyle: "italic", color: COLORS.inkSoft, marginBottom: 6 }}>
          data più vicina trovata, da confermare
        </div>
      )}
      <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 8 }}>{leg.airlineName ?? leg.airline}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink, flexShrink: 0 }}>{leg.price} €</div>
        <BookingAction deepLink={leg.deepLink} airlineName={leg.airlineName ?? leg.airline} label={`Prenota ${index} →`} style={{ flex: leg.deepLink ? undefined : 1 }} />
      </div>
    </Card>
  );
}
