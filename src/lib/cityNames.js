// Nome città completo da codice — per la destinazione l'API dà già il codice città
// aggregato (es. MIL per Milano), ma per l'ORIGINE l'utente inserisce sempre un codice
// aeroporto specifico (es. BGY), che Travelpayouts aggrega sotto la città metropolitana
// (BGY -> city_code MIL -> "Milan"), non il nome comune dell'aeroporto (Bergamo).
// Override manuale solo per i casi dove differiscono in modo netto e noto (Bergamo è
// l'origine di default del progetto) — non generalizzabile a tutti i 10k aeroporti.
import cities from "../data/cities.json";
import airportCityMap from "../data/airportCityMap.json";

const CITY_BY_CODE = Object.fromEntries(cities.map((c) => [c.code, c.name]));

const ORIGIN_NAME_OVERRIDES = {
  BGY: "Bergamo",
};

export function cityName(code) {
  if (!code) return code;
  const upper = code.toUpperCase();
  if (ORIGIN_NAME_OVERRIDES[upper]) return ORIGIN_NAME_OVERRIDES[upper];
  if (CITY_BY_CODE[upper]) return CITY_BY_CODE[upper];
  const cityCode = airportCityMap[upper];
  return (cityCode && CITY_BY_CODE[cityCode]) ?? code;
}

// Direzione inversa: l'utente scrive un NOME ("Bologna", "Bergamo") in un campo che poi
// va all'API come codice — senza questa risoluzione, un nome scritto invece di un codice
// dà silenziosamente zero risultati (l'API non riconosce "BOLOGNA" come codice valido).
const CODE_BY_NAME = Object.fromEntries(cities.map((c) => [c.name.toLowerCase(), c.code]));
const CODE_BY_OVERRIDE_NAME = Object.fromEntries(
  Object.entries(ORIGIN_NAME_OVERRIDES).map(([code, name]) => [name.toLowerCase(), code])
);

export function resolveCityCode(input) {
  if (!input) return null;
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  // Override espliciti prima (Bergamo -> BGY, non l'aggregato città MIL)
  if (CODE_BY_OVERRIDE_NAME[lower]) return CODE_BY_OVERRIDE_NAME[lower];
  if (CODE_BY_NAME[lower]) return CODE_BY_NAME[lower];
  // Già un codice valido (3 lettere, es. un aeroporto minore non coperto dal nome)
  if (/^[a-zA-Z]{3}$/.test(trimmed)) return trimmed.toUpperCase();
  return null;
}
