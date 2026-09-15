// Nome città completo da codice IATA (per l'origine, che l'API non nomina mai per esteso
// come fa invece per la destinazione). Stesso dataset Travelpayouts già usato lato server.
import cities from "../data/cities.json";

const CITY_BY_CODE = Object.fromEntries(cities.map((c) => [c.code, c.name]));

export function cityName(code) {
  if (!code) return code;
  return CITY_BY_CODE[code.toUpperCase()] ?? code;
}
