import { useEffect, useState } from "react";
import { COLORS, RADIUS } from "../theme/colors";
import { Card } from "../components/Card";
import { FlagIcon } from "../components/FlagIcon";
import { FreshnessBadge } from "../components/FreshnessBadge";
import { SwipeToDelete } from "../components/SwipeToDelete";
import { LegBox, formatTime } from "../components/LegBox";
import { PrimaryButton } from "../components/PrimaryButton";
import { verifyPrice } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useFavorites } from "../hooks/useFavorites";
import { cityName } from "../lib/cityNames";
import { formatDateRangeShort, formatRelativeTime } from "../lib/formatters";

// Un percorso creativo salvato ha già legs[] con orario/compagnia/deep link pronti dalla
// ricerca (niente endpoint di verifica per-biglietto sensato, come nel dettaglio volo).
function LegRow({ index, total, leg }) {
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

// Espande la card sul posto invece di navigare al dettaglio — stessa logica di
// verifica/orari del dettaglio volo, ma inline (richiesto esplicitamente: niente
// nuova schermata per un preferito già salvato).
function FavoriteDetails({ flight }) {
  const isLegacySchema = Boolean(flight.viaHub) && !Array.isArray(flight.legs);
  const [data, setData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(!flight.isStopover && !isLegacySchema);

  useEffect(() => {
    if (flight.isStopover || isLegacySchema) return;
    verifyPrice(flight)
      .then((d) => setData(d))
      .finally(() => setLoadingDetail(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLegacySchema) {
    return (
      <div style={{ fontSize: 12.5, color: COLORS.warn, fontWeight: 600, marginTop: 12 }}>
        ⚠️ Preferito salvato con una versione precedente dell'app — rifai la ricerca per un dato aggiornato.
      </div>
    );
  }

  if (flight.isStopover) {
    return (
      <div style={{ marginTop: 4 }}>
        {flight.legs?.map((leg, i) => (
          <LegRow key={leg.id} index={i + 1} total={flight.legs.length} leg={leg} />
        ))}
      </div>
    );
  }

  if (loadingDetail) {
    return <div style={{ fontSize: 12.5, color: COLORS.inkSoft, marginTop: 12 }}>Carico orari…</div>;
  }

  const deepLink = data?.deepLink ?? flight.deepLink;

  return (
    <div style={{ marginTop: 8 }}>
      <LegBox
        title="Andata"
        leg={data?.outboundLeg}
        route={`${flight.origin ?? "?"} → ${flight.destination ?? "?"}`}
        date={flight.departDate}
      />
      <LegBox
        title="Ritorno"
        leg={data?.inboundLeg}
        route={`${flight.destination ?? "?"} → ${flight.origin ?? "?"}`}
        date={flight.returnDate}
      />
      <PrimaryButton
        variant="solid"
        onClick={() => window.open(deepLink, "_blank", "noopener,noreferrer")}
        disabled={!deepLink}
        style={{ width: "100%", justifyContent: "center" }}
      >
        Vai alla prenotazione →
      </PrimaryButton>
    </div>
  );
}

function FavoriteCard({ fav, onVerify, onDelete }) {
  const [verifying, setVerifying] = useState(false);
  const [justVerified, setJustVerified] = useState(false); // il prezzo può non cambiare:
  // senza questo, un esito "nessuna variazione" sembra un bottone che non ha fatto nulla
  const [expanded, setExpanded] = useState(false);
  const flight = fav.flight_snapshot ?? {};
  const canVerify = !flight.isStopover; // percorsi creativi: niente singolo endpoint sensato

  const handleVerify = async (e) => {
    e.stopPropagation(); // non chiudere/aprire la card, resta qui a vedere l'esito
    setVerifying(true);
    await onVerify(fav);
    setVerifying(false);
    setJustVerified(true);
    setTimeout(() => setJustVerified(false), 2000);
  };

  return (
    <SwipeToDelete onDelete={onDelete}>
      <Card onClick={() => setExpanded(!expanded)} style={{ padding: 14, marginBottom: 0 }}>
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
              disabled={verifying || justVerified}
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 11,
                fontWeight: 600,
                color: justVerified ? COLORS.accent : COLORS.plum,
                background: justVerified ? COLORS.accentSoft : "transparent",
                border: `1px solid ${justVerified ? COLORS.accent : COLORS.hairline}`,
                borderRadius: RADIUS.pill,
                padding: "4px 10px",
                marginTop: 6,
                cursor: verifying || justVerified ? "default" : "pointer",
              }}
            >
              {verifying ? "…" : justVerified ? "✓ Verificato" : "🔄 Verifica prezzo"}
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
      {expanded && (
        <div onClick={(e) => e.stopPropagation()}>
          <FavoriteDetails flight={flight} />
        </div>
      )}
      </Card>
    </SwipeToDelete>
  );
}

export function Favorites() {
  const { user } = useAuth();
  const { favorites, loading, verifyFavorite, removeFavorite } = useFavorites(user?.id);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ fontWeight: 600, fontSize: 20, color: COLORS.accent, marginBottom: 16 }}>Preferiti</div>

      {loading && <div style={{ color: COLORS.inkSoft }}>Caricamento…</div>}
      {!loading && favorites.length === 0 && (
        <div style={{ color: COLORS.inkSoft }}>Nessun volo salvato ancora.</div>
      )}

      {favorites.map((fav) => (
        <FavoriteCard key={fav.id} fav={fav} onVerify={verifyFavorite} onDelete={() => removeFavorite(fav.id)} />
      ))}
    </div>
  );
}
