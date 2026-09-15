// Nome paese localizzato senza dataset esterno: Intl.DisplayNames è nativo del browser
// (supporto ampio). countryCodes.json elenca solo i ~237 codici ISO2 con voli reali
// (derivati da Travelpayouts cities.json), per popolare l'autocomplete.
import countryCodes from "../data/countryCodes.json";

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

export function searchCountries(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return countryCodes
    .map((code) => ({ code, name: countryName(code) }))
    .filter(({ code, name }) => code.toLowerCase().includes(q) || name.toLowerCase().includes(q))
    .slice(0, 8);
}
