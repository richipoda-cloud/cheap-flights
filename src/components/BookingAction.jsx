import { COLORS, RADIUS } from "../theme/colors";
import { PrimaryButton } from "./PrimaryButton";

// Quando verify-price/search-stopover non trovano né uno schema diretto della compagnia
// né la sua homepage (vedi supabase/functions/_shared/airlineLinks.ts), deepLink resta
// null — prima qui finiva un fallback verso un sito terzo (Aviasales, poi Google Flights)
// MAI approvato dall'utente e infine rifiutato esplicitamente ("mi da lo stesso nervoso
// [di Aviasales]"). Niente più bottone-fantasma: compagnia/data/orario sono già mostrati
// sopra (LegBox/LegRow) — questo messaggio rimanda esplicitamente l'utente a prenotare da
// sé sul sito della compagnia, invece di un link che non porta da nessuna parte di utile.
//
// Segnalato dall'utente su rotte intercontinentali (es. Milano-Los Angeles): la Data API
// gratuita di Travelpayouts spesso non ha PROPRIO cache one-way per queste tratte — non
// solo la compagnia è sconosciuta, TUTTO il leg è null (vedi verify-price/index.ts), quindi
// il messaggio restava vago ("prenota con la data mostrata sopra" quando sopra non c'era
// nessuna data). route/departDate/returnDate (sempre noti dal risultato di ricerca, anche
// senza alcun match one-way) coprono questo buco: mostra almeno la rotta e le date, cosi'
// l'utente sa ESATTAMENTE cosa cercare anche nel caso più povero di dati.
//
// numberOfChanges (v2, segnalato dall'utente — "se il volo è diretto perché non ha
// compagnia?"): spesso non è affatto diretto, v2/prices/latest non lo garantisce e la
// ricerca one-way qui sopra cerca SOLO senza scalo — su una rotta che un diretto non ce
// l'ha proprio (es. Linate, niente long-haul) il messaggio sembrava un buco nei dati
// invece che "questa rotta ha sempre almeno uno scalo".
export function BookingAction({
  deepLink,
  airlineName,
  route,
  departDate,
  returnDate,
  numberOfChanges,
  label = "Vai alla prenotazione →",
  style,
  disabled,
}) {
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
  const dates = [departDate, returnDate].filter(Boolean).join(" → ");
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
      ✈️ Nessun link diretto{airlineName ? ` per ${airlineName}` : ""}
      {!airlineName && numberOfChanges > 0
        ? ` (rotta con almeno ${numberOfChanges === 1 ? "1 scalo" : `${numberOfChanges} scali`})`
        : ""}
      {" "}— prenota da qui in autonomia sul sito della compagnia
      {airlineName ? ", con la data e l'orario mostrati sopra." : route || dates ? (
        <>
          {" "}per <strong>{route}</strong>
          {dates ? `, ${dates}` : ""}.
        </>
      ) : (
        "."
      )}
    </div>
  );
}
