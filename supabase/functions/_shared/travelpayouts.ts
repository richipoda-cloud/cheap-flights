// Helper condiviso tra le Edge Function per chiamare Travelpayouts v2/prices/latest.
import citiesData from "./cities.json" with { type: "json" };

export const TRAVELPAYOUTS_TOKEN = Deno.env.get("TRAVELPAYOUTS_TOKEN");
const BASE_URL = "https://api.travelpayouts.com/v2/prices/latest";

// v2/prices/latest restituisce solo il codice IATA città/aeroporto, non nome esteso né
// paese. Dataset statico Travelpayouts (data/en/cities.json), trimmed a code/name/country_code,
// per bandiera + nome destinazione senza chiamata extra a runtime.
const CITY_BY_CODE: Record<string, { name: string; country_code: string }> = Object.fromEntries(
  (citiesData as Array<{ code: string; name: string; country_code: string }>).map((c) => [c.code, c])
);

export function nightsBetween(departDate: string | null, returnDate: string | null) {
  if (!departDate || !returnDate) return null;
  return Math.round((new Date(returnDate).getTime() - new Date(departDate).getTime()) / 86400000);
}

export function mapRawResult(r: any, origin: string) {
  // v2/prices/latest usa "value" per il prezzo (non "price").
  const city = CITY_BY_CODE[r.destination];
  return {
    id: `${origin}-${r.destination}-${r.depart_date}-${r.return_date}`,
    origin,
    destination: r.destination,
    destinationName: city?.name ?? r.destination,
    countryCode: city?.country_code ?? null,
    departDate: r.depart_date,
    returnDate: r.return_date,
    price: r.value,
    currency: "EUR",
    nights: nightsBetween(r.depart_date, r.return_date),
    foundAt: r.found_at ?? null,
  };
}

// L'API gratuita restituisce prezzi in CACHE (visti da altri utenti), non prezzi live —
// oltre una certa età sono spesso sballati (segnalato dall'utente: risultati fino a 3x il
// prezzo reale). Niente di meglio disponibile senza un accordo commerciale (Real-Time
// Search API richiede 50k utenti attivi/mese, vedi supporto Travelpayouts), quindi si
// scartano le cache troppo vecchie invece di mostrarle come affidabili.
export const MAX_PRICE_AGE_DAYS = 14;

export function isFresh(foundAt: string | null | undefined, maxDays: number = MAX_PRICE_AGE_DAYS): boolean {
  if (!foundAt) return false;
  const ageMs = Date.now() - new Date(foundAt).getTime();
  return ageMs <= maxDays * 86400000;
}

export function filterByFreshness<T extends { foundAt?: string | null }>(
  results: T[],
  maxDays: number = MAX_PRICE_AGE_DAYS
): T[] {
  return results.filter((r) => isFresh(r.foundAt, maxDays));
}

// origin/destination accettano sia codice città che codice paese (v2) — questo è ciò
// che rende possibile lo "scalo libero": si passa un paese invece di un singolo aeroporto.
export async function fetchLatestPrices({
  origin,
  destination,
  dateFrom,
  limit = 30,
}: {
  origin: string;
  destination?: string | null;
  dateFrom?: string | null;
  limit?: number;
}) {
  if (!TRAVELPAYOUTS_TOKEN) throw new Error("TRAVELPAYOUTS_TOKEN non configurato");

  const params = new URLSearchParams({
    origin,
    currency: "EUR",
    token: TRAVELPAYOUTS_TOKEN,
    limit: String(limit),
    sorting: "price",
    one_way: "false",
    period_type: "month",
    ...(destination ? { destination } : {}),
    ...(dateFrom ? { beginning_of_period: dateFrom } : {}),
  });

  const res = await fetch(`${BASE_URL}?${params.toString()}`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data ?? []).map((r: any) => mapRawResult(r, origin));
}

export function filterByExcludedCountries(results: any[], excludedCountries?: string[] | null) {
  if (!excludedCountries || excludedCountries.length === 0) return results;
  const excluded = new Set(excludedCountries.map((c) => c.toUpperCase()));
  return results.filter((r) => !r.countryCode || !excluded.has(r.countryCode.toUpperCase()));
}

export function filterByNights(results: any[], nightsMin?: number | null, nightsMax?: number | null) {
  if (nightsMin == null && nightsMax == null) return results;
  return results.filter((r) => {
    if (r.nights == null) return true;
    if (nightsMin != null && r.nights < nightsMin) return false;
    if (nightsMax != null && r.nights > nightsMax) return false;
    return true;
  });
}
