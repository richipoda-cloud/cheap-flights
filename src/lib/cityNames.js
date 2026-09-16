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

// Nomi comuni/gergali di aeroporti che non coincidono col nome città (o col nome
// dell'unico aeroporto) usato da Travelpayouts — lista curata dei casi più cercati,
// non esaustiva su tutti i ~10k aeroporti del dataset (impossibile da mantenere).
const AIRPORT_NICKNAMES = {
  // Italia — scali secondari di città con più aeroporti, o nomi ufficiali molto diffusi
  "el prat": "BCN",
  "orio al serio": "BGY",
  "il caravaggio": "BGY",
  malpensa: "MXP",
  linate: "LIN",
  fiumicino: "FCO",
  "leonardo da vinci": "FCO",
  ciampino: "CIA",
  "marco polo": "VCE",
  tessera: "VCE",
  "guglielmo marconi": "BLQ",
  "amerigo vespucci": "FLR",
  peretola: "FLR",
  caselle: "TRN",
  "sandro pertini": "TRN",
  "falcone borsellino": "PMO",
  "punta raisi": "PMO",
  elmas: "CAG",
  capodichino: "NAP",
  treviso: "TSF",
  "canova": "TSF",
  orly: "ORY",
  "charles de gaulle": "CDG",
  heathrow: "LHR",
  gatwick: "LGW",
  stansted: "STN",
  luton: "LTN",
  schiphol: "AMS",
  "josep tarradellas": "BCN",
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
  if (AIRPORT_NICKNAMES[lower]) return AIRPORT_NICKNAMES[lower];
  if (CODE_BY_NAME[lower]) return CODE_BY_NAME[lower];
  // Già un codice valido (3 lettere, es. un aeroporto minore non coperto dal nome)
  if (/^[a-zA-Z]{3}$/.test(trimmed)) return trimmed.toUpperCase();
  return null;
}
