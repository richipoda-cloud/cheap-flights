import { COLORS, RADIUS } from "../theme/colors";

// Pillola colorata piena per lo stato di freschezza prezzo — usata in Preferiti insieme
// al tempo relativo ("Salvato X fa"), reso separatamente dal chiamante (righe ai due
// estremi, come nel mockup). Se il prezzo differisce da quello salvato in origine dopo
// una riverifica, mostra la variazione esplicita invece del generico ✓/⟳.
export function FreshnessBadge({ isFresh, price, originalPrice }) {
  const delta = originalPrice != null && price != null ? price - originalPrice : 0;

  const pillStyle = (bg, color) => ({
    fontSize: 11,
    fontWeight: 600,
    color,
    background: bg,
    borderRadius: RADIUS.pill,
    padding: "3px 10px",
    whiteSpace: "nowrap",
  });

  if (delta !== 0) {
    const rose = delta > 0;
    return (
      <span style={pillStyle(rose ? "#F3E3DE" : COLORS.accentSoft, rose ? COLORS.warn : COLORS.accent)}>
        {rose ? "🔺" : "🔻"} {rose ? "+" : ""}
        {delta}€
      </span>
    );
  }
  if (isFresh) {
    return <span style={pillStyle(COLORS.accentSoft, COLORS.accent)}>✓ Prezzo aggiornato</span>;
  }
  return <span style={pillStyle("#F3E3DE", COLORS.warn)}>↻ Da verificare</span>;
}
