import { COLORS } from "../theme/colors";
import { Card } from "./Card";

// v2/prices/latest (round-trip aggregato, usato per lista+prezzo) non fornisce
// orari/compagnia/durata — per quello, verify-price interroga in più anche
// aviasales/v3/prices_for_dates (one-way, stesso endpoint dei Percorsi creativi) sulla
// data esatta. Se in cache c'è un match, questo box mostra il dato reale; altrimenti
// resta onesto sul limite invece di inventare o lasciare vuoto.
export function LegBox({ title, leg, route, date }) {
  if (leg) {
    return (
      <Card style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.inkSoft, marginBottom: 8 }}>
          {title} · {leg.date}
          {leg.approxDate && (
            <span style={{ fontWeight: 400, fontStyle: "italic" }}> · data più vicina trovata, da confermare</span>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: 600, fontSize: 16, color: COLORS.ink }}>{leg.originAirport}</div>
            <div style={{ fontSize: 13, color: COLORS.inkSoft }}>{formatTime(leg.departureAt)}</div>
          </div>
          <span style={{ fontSize: 18 }}>✈️</span>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 600, fontSize: 16, color: COLORS.ink }}>{leg.destinationAirport}</div>
            <div style={{ fontSize: 13, color: COLORS.inkSoft }}>{formatTime(leg.arrivalAt)}</div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 10,
            paddingTop: 10,
            borderTop: `1px dashed ${COLORS.hairline}`,
            fontSize: 12,
            color: COLORS.inkSoft,
          }}
        >
          <div>{leg.airlineName ?? leg.airline} · Diretto</div>
          {leg.duration != null && <div>{formatDuration(leg.duration)}</div>}
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.inkSoft, marginBottom: 8 }}>{title}</div>
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

export function formatTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export function formatDuration(minutes) {
  if (minutes == null) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
