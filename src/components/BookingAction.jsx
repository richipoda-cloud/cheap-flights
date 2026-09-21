import { COLORS, RADIUS } from "../theme/colors";
import { PrimaryButton } from "./PrimaryButton";

// Quando verify-price/search-stopover non trovano né uno schema diretto della compagnia
// né la sua homepage (vedi supabase/functions/_shared/airlineLinks.ts), deepLink resta
// null — prima qui finiva un fallback verso un sito terzo (Aviasales, poi Google Flights)
// MAI approvato dall'utente e infine rifiutato esplicitamente ("mi da lo stesso nervoso
// [di Aviasales]"). Niente più bottone-fantasma: compagnia/data/orario sono già mostrati
// sopra (LegBox/LegRow) — questo messaggio rimanda esplicitamente l'utente a prenotare da
// sé sul sito della compagnia, invece di un link che non porta da nessuna parte di utile.
export function BookingAction({ deepLink, airlineName, label = "Vai alla prenotazione →", style, disabled }) {
  if (deepLink) {
    return (
      <PrimaryButton
        variant="solid"
        onClick={() => window.open(deepLink, "_blank", "noopener,noreferrer")}
        disabled={disabled}
        style={style}
      >
        {label}
      </PrimaryButton>
    );
  }
  return (
    <div
      style={{
        fontSize: 12.5,
        color: COLORS.inkSoft,
        background: COLORS.cream,
        borderRadius: RADIUS.button,
        padding: "10px 12px",
        lineHeight: 1.4,
        ...style,
      }}
    >
      ✈️ Nessun link diretto{airlineName ? ` per ${airlineName}` : ""} — prenota da qui in
      autonomia sul sito della compagnia, con la data e l'orario mostrati sopra.
    </div>
  );
}
