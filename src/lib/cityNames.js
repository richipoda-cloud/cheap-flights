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
