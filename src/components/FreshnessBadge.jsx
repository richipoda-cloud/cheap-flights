import { COLORS } from "../theme/colors";

// Usato in Preferiti: prezzo cache Travelpayouts non è mai "confermato" finché non
// riverificato nel dettaglio volo (vedi lib/api.js verifyPrice).
export function FreshnessBadge({ isFresh, savedAt }) {
  const label = isFresh ? "✓ aggiornato" : "⟳ da verificare";
  const color = isFresh ? COLORS.accent : COLORS.warn;
  const date = savedAt ? new Date(savedAt).toLocaleDateString("it-IT") : null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.inkSoft }}>
      <span style={{ fontWeight: 600, color }}>{label}</span>
      {date && <span>· salvato il {date}</span>}
    </div>
  );
}
