// Nome aeroporto/città da codice. Prima (bug segnalato: "Milano" mostrava un solo
// aeroporto generico, Malpensa e Linate non si distinguevano) si usava solo cities.json
// (dataset a livello di CITTÀ AGGREGATA, es. "MIL" per tutta Milano) più una manciata di
// override manuali (solo Bergamo). Ora si usa airports.json — dataset ufficiale
// Travelpayouts a livello di SINGOLO AEROPORTO (9269 scali, stessa fonte di cities.json/
// airlines.json) — quindi ogni aeroporto ha il proprio nome reale (es. MXP -> "Milano
// Malpensa Airport", LIN -> "Milano Linate Airport"), non più il nome della città che lo
// aggrega. cities.json resta come fallback per i codici CITTÀ (es. "MIL", "ROM") che
// compaiono come destinazione nell'aggregato v2/prices/latest.
import cities from "../data/cities.json";
import airports from "../data/airports.json";
import airportCityMap from "../data/airportCityMap.json";

const CITY_BY_CODE = Object.fromEntries(cities.map((c) => [c.code, c.name]));
const AIRPORT_BY_CODE = Object.fromEntries(airports.map((a) => [a.code, a.name]));

// Preferenza sul nome colloquiale invece di quello ufficiale dell'aeroporto, solo dove
// esplicitamente richiesto (Bergamo è l'origine di default del progetto) — per tutti gli
// altri aeroporti il dataset è ormai autoritativo, non serve più indovinare caso per caso.
const DISPLAY_NAME_OVERRIDES = {
  BGY: "Bergamo",
};

export function cityName(code) {
  if (!code) return code;
  const upper = code.toUpperCase();
  if (DISPLAY_NAME_OVERRIDES[upper]) return DISPLAY_NAME_OVERRIDES[upper];
  if (AIRPORT_BY_CODE[upper]) return AIRPORT_BY_CODE[upper];
  if (CITY_BY_CODE[upper]) return CITY_BY_CODE[upper];
  const cityCode = airportCityMap[upper];
  return (cityCode && CITY_BY_CODE[cityCode]) ?? code;
}

// Direzione inversa: l'utente scrive un NOME in un campo che poi va all'API come codice —
// senza questa risoluzione, un nome scritto invece di un codice dà silenziosamente zero
// risultati. Costruita sui nomi ufficiali di TUTTI i 9269 aeroporti (non solo una manciata
// curata): scrivendo il nome esatto suggerito dall'autocomplete ("Milano Malpensa
// Airport") si risolve sempre al codice giusto, per qualunque aeroporto del dataset.
const CODE_BY_AIRPORT_NAME = Object.fromEntries(airports.map((a) => [a.name.toLowerCase(), a.code]));
const CODE_BY_CITY_NAME = Object.fromEntries(cities.map((c) => [c.name.toLowerCase(), c.code]));

// Alias informali per chi digita un nome corto invece del nome ufficiale completo
// dell'aeroporto (es. "Malpensa" invece di "Milano Malpensa Airport") o un nome comune
// che il dataset non usa affatto (es. "Bergamo" per l'aeroporto ufficialmente chiamato
// "Orio al Serio International Airport") — lista curata dei casi più cercati, il dataset
// sopra copre già la stragrande maggioranza per nome ufficiale esatto.
const AIRPORT_NICKNAMES = {
  bergamo: "BGY",
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
  canova: "TSF",
  "el prat": "BCN",
  "josep tarradellas": "BCN",
  orly: "ORY",
  "charles de gaulle": "CDG",
  heathrow: "LHR",
  gatwick: "LGW",
  stansted: "STN",
  luton: "LTN",
  schiphol: "AMS",
};

export function resolveCityCode(input) {
  if (!input) return null;
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  if (AIRPORT_NICKNAMES[lower]) return AIRPORT_NICKNAMES[lower];
  if (CODE_BY_AIRPORT_NAME[lower]) return CODE_BY_AIRPORT_NAME[lower];
  if (CODE_BY_CITY_NAME[lower]) return CODE_BY_CITY_NAME[lower];
  // Già un codice valido (3 lettere, es. un aeroporto minore non coperto dal nome)
  if (/^[a-zA-Z]{3}$/.test(trimmed)) return trimmed.toUpperCase();
  return null;
}
