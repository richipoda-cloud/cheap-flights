// Helper per il modello "4 tratte one-way" dei Percorsi creativi — v3/prices_for_dates,
// stessa Data API gratuita già in uso (non la Real-Time Search API), ma one_way=true
// dà orario esatto, compagnia, durata e deep link diretto per singola tratta.
import citiesData from "./cities.json" with { type: "json" };

export const TRAVELPAYOUTS_TOKEN = Deno.env.get("TRAVELPAYOUTS_TOKEN");
const MARKER = Deno.env.get("TRAVELPAYOUTS_MARKER") ?? "";
const BASE_URL = "https://api.travelpayouts.com/aviasales/v3/prices_for_dates";

const CITY_BY_CODE: Record<string, { name: string; country_code: string }> = Object.fromEntries(
  (citiesData as Array<{ code: string; name: string; country_code: string }>).map((c) => [c.code, c])
);

export function mapOneWayResult(r: any) {
  const city = CITY_BY_CODE[r.destination];
  const sep = r.link?.includes("?") ? "&" : "?";
  return {
    id: `${r.origin_airport}-${r.destination_airport}-${r.departure_at}-${r.flight_number}`,
    originAirport: r.origin_airport,
    destinationAirport: r.destination_airport,
    destination: r.destination,
    destinationName: city?.name ?? r.destination,
    countryCode: city?.country_code ?? null,
    departureAt: r.departure_at, // ISO con ora esatta
    date: r.departure_at?.slice(0, 10),
    airline: r.airline,
    flightNumber: r.flight_number,
    duration: r.duration,
    price: r.price,
    currency: "EUR",
    deepLink: r.link ? `https://www.aviasales.com${r.link}${sep}marker=${MARKER}` : null,
  };
}

// origin/destination accettano anche codice paese; destination omesso = "ovunque".
export async function fetchOneWayPrices({
  origin,
  destination,
  limit = 30,
}: {
  origin: string;
  destination?: string | null;
  limit?: number;
}) {
  if (!TRAVELPAYOUTS_TOKEN) throw new Error("TRAVELPAYOUTS_TOKEN non configurato");

  const params = new URLSearchParams({
    origin,
    currency: "eur",
    token: TRAVELPAYOUTS_TOKEN,
    limit: String(limit),
    sorting: "price",
    one_way: "true",
    ...(destination ? { destination } : {}),
  });

  const res = await fetch(`${BASE_URL}?${params.toString()}`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data ?? []).map(mapOneWayResult);
}
