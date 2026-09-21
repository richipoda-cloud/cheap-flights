// Nome paese localizzato senza dataset esterno: Intl.DisplayNames è nativo del browser
// (supporto ampio). countryCodes.json elenca solo i ~237 codici ISO2 con voli reali
// (derivati da Travelpayouts cities.json), per popolare l'autocomplete.
import countryCodes from "../data/countryCodes.json";
import { cityName } from "./cityNames";

const DESTINATION_CODE_SET = new Set(countryCodes.map((c) => c.toLowerCase()));

let displayNames = null;
try {
  displayNames = new Intl.DisplayNames(["it"], { type: "region" });
} catch {
  displayNames = null;
}

export function countryName(code) {
  if (!code) return code;
  try {
    return displayNames?.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

// Un campo "destinazione" può contenere sia un codice città/aeroporto che un codice
// paese (dopo il supporto a "Destinazione fissa" con paese, 21/09/2026) — senza questo
// controllo, mostrare un codice paese con cityName lo lascia grezzo ("FR" invece di
// "Francia") perché non è nell'anagrafica città/aeroporti. Stessa distinzione già usata
// in Search.jsx, centralizzata qui per riusarla in Home/Storico.
export function destinationName(code) {
  if (!code) return code;
  return DESTINATION_CODE_SET.has(code.toLowerCase()) ? countryName(code) : cityName(code);
}

export function searchCountries(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return countryCodes
    .map((code) => ({ code, name: countryName(code) }))
    .filter(({ code, name }) => code.toLowerCase().includes(q) || name.toLowerCase().includes(q))
    .slice(0, 8);
}
