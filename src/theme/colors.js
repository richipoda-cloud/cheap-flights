// Palette riusata 1:1 dal progetto Guardaroba (design_system_reference.md).
export const COLORS = {
  bg: "#DBE4CC", // sfondo pagina (verde salvia chiaro)
  surface: "#FFFFFF", // sfondo card/superfici
  hairline: "#DAD6CC", // bordi sottili, divisori
  ink: "#211E2B", // testo principale
  inkSoft: "#6B6875", // testo secondario/muto
  accent: "#6E7F5C", // verde accento primario (bottoni, pillole attive)
  accentSoft: "#DCE3D3", // verde accento tenue
  plum: "#8B5D73", // secondario prugna
  plumSoft: "#EEE1E6", // prugna tenue
  warn: "#A65A4A", // avviso/errore, mai rosso puro
  cream: "#F3EEE1", // crema, superfici alternative
};

// Regola forte ereditata: mai bottoni neri, mai rosso puro per avvisi.
export const RADIUS = {
  pill: 20,
  button: 12,
  card: 14,
};

export const SHADOW = {
  pillOnPhoto: "0 1px 4px rgba(33,30,43,0.18)",
  ctaButton: "0 4px 16px rgba(33,30,43,0.22)",
  selectedCard: (color = COLORS.accent) => `0 0 0 2px ${color}`,
};
