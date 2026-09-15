import { COLORS } from "../theme/colors";

// Usato in Preferiti: prezzo cache Travelpayouts non è mai "confermato" finché non
// riverificato (nel dettaglio volo, o qui via riverifica manuale). Se dopo la
// riverifica il prezzo differisce da quello salvato in origine, mostra la variazione
// esplicita invece del generico ✓/⟳.
export function FreshnessBadge({ isFresh, savedAt, price, originalPrice }) {
  const date = savedAt ? new Date(savedAt).toLocaleDateString("it-IT") : null;
  const delta = originalPrice != null && price != null ? price - originalPrice : 0;

  if (delta !== 0) {
    const rose = delta > 0;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.inkSoft }}>
        <span style={{ fontWeight: 600, color: rose ? COLORS.warn : COLORS.accent }}>
          {rose ? "🔺" : "🔻"} {rose ? "+" : ""}
          {delta}€ dal salvataggio
        </span>
        {date && <span>· salvato il {date}</span>}
      </div>
    );
  }

  const label = isFresh ? "✓ aggiornato" : "⟳ da verificare";
  const color = isFresh ? COLORS.accent : COLORS.warn;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.inkSoft }}>
      <span style={{ fontWeight: 600, color }}>{label}</span>
      {date && <span>· salvato il {date}</span>}
    </div>
  );
}
