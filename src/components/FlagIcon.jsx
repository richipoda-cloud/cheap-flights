// Bandiera come emoji (nessuna foto/icona esterna, zero problemi di copyright).
// countryCode: ISO 3166-1 alpha-2 (es. "IT", "ES") — arriva dai dati Travelpayouts.
export function FlagIcon({ countryCode, size = 20 }) {
  if (!countryCode || countryCode.length !== 2) return null;
  const codePoints = [...countryCode.toUpperCase()].map((c) => 127397 + c.charCodeAt(0));
  const flag = String.fromCodePoint(...codePoints);
  return <span style={{ fontSize: size, lineHeight: 1 }}>{flag}</span>;
}
