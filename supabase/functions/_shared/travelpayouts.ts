// Helper condiviso tra le Edge Function per chiamare Travelpayouts v2/prices/latest.
export const TRAVELPAYOUTS_TOKEN = Deno.env.get("TRAVELPAYOUTS_TOKEN");
const BASE_URL = "https://api.travelpayouts.com/v2/prices/latest";

export function nightsBetween(departDate: string | null, returnDate: string | null) {
  if (!departDate || !returnDate) return null;
  return Math.round((new Date(returnDate).getTime() - new Date(departDate).getTime()) / 86400000);
}

export function mapRawResult(r: any, origin: string) {
  // v2/prices/latest usa "value" per il prezzo (non "price") e non restituisce nome
  // esteso/paese della destinazione — solo codice IATA. Bandiera/nome pieno: TODO,
  // servirebbe incrociare con un dataset statico IATA->paese o l'endpoint /data/{locale}/cities.json.
  return {
    id: `${origin}-${r.destination}-${r.depart_date}-${r.return_date}`,
    origin,
    destination: r.destination,
    destinationName: r.destination_name ?? r.destination,
    countryCode: r.destination_country_code ?? null,
    departDate: r.depart_date,
    returnDate: r.return_date,
    price: r.value,
    currency: "EUR",
    nights: nightsBetween(r.depart_date, r.return_date),
  };
}

// origin/destination accettano sia codice città che codice paese (v2) — questo è ciò
// che rende possibile lo "scalo libero": si passa un paese invece di un singolo aeroporto.
export async function fetchLatestPrices({
  origin,
  destination,
  dateFrom,
}: {
  origin: string;
  destination?: string | null;
  dateFrom?: string | null;
}) {
  if (!TRAVELPAYOUTS_TOKEN) throw new Error("TRAVELPAYOUTS_TOKEN non configurato");

  const params = new URLSearchParams({
    origin,
    currency: "EUR",
    token: TRAVELPAYOUTS_TOKEN,
    limit: "30",
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

export function filterByNights(results: any[], nightsMin?: number | null, nightsMax?: number | null) {
  if (nightsMin == null && nightsMax == null) return results;
  return results.filter((r) => {
    if (r.nights == null) return true;
    if (nightsMin != null && r.nights < nightsMin) return false;
    if (nightsMax != null && r.nights > nightsMax) return false;
    return true;
  });
}
