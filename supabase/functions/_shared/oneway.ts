// Helper per il modello "4 tratte one-way" dei Percorsi creativi — v3/prices_for_dates,
// stessa Data API gratuita già in uso (non la Real-Time Search API), ma one_way=true
// dà orario esatto, compagnia, durata e deep link diretto per singola tratta.
import citiesData from "./cities.json" with { type: "json" };
import airlinesData from "./airlines.json" with { type: "json" };

export const TRAVELPAYOUTS_TOKEN = Deno.env.get("TRAVELPAYOUTS_TOKEN");
const BASE_URL = "https://api.travelpayouts.com/aviasales/v3/prices_for_dates";

const CITY_BY_CODE: Record<string, { name: string; country_code: string }> = Object.fromEntries(
  (citiesData as Array<{ code: string; name: string; country_code: string }>).map((c) => [c.code, c])
);
const AIRLINE_NAME_BY_CODE: Record<string, string> = airlinesData as Record<string, string>;

export function mapOneWayResult(r: any) {
  const city = CITY_BY_CODE[r.destination];
  const arrivalAt =
    r.departure_at && r.duration != null
      ? new Date(new Date(r.departure_at).getTime() + r.duration * 60000).toISOString()
      : null;
  return {
    id: `${r.origin_airport}-${r.destination_airport}-${r.departure_at}-${r.flight_number}`,
    originAirport: r.origin_airport,
    destinationAirport: r.destination_airport,
    destination: r.destination,
    destinationName: city?.name ?? r.destination,
    countryCode: city?.country_code ?? null,
    departureAt: r.departure_at, // ISO con ora esatta
    arrivalAt,
    date: r.departure_at?.slice(0, 10),
    airline: r.airline,
    airlineName: AIRLINE_NAME_BY_CODE[r.airline] ?? r.airline,
    flightNumber: r.flight_number,
    duration: r.duration,
    price: r.price,
    currency: "EUR",
    // Mai più Aviasales (era `https://www.aviasales.com${r.link}...`) — placeholder,
    // ogni chiamante (verify-price, search-stopover) sovrascrive con withAirlineDeepLink
    // (_shared/airlineLinks.ts): schema diretto della compagnia, poi homepage, altrimenti
    // resta null e il client mostra "prenota da solo" invece di un link a un sito terzo.
    deepLink: null,
    foundAt: r.found_at ?? null,
  };
}

// origin/destination accettano anche codice paese; destination omesso = "ovunque".
export async function fetchOneWayPrices({
  origin,
  destination,
  limit = 30,
  departureAt,
}: {
  origin: string;
  destination?: string | null;
  limit?: number;
  // Data esatta (YYYY-MM-DD) di cui si vogliono orario/compagnia reali — es. verify-price,
  // che già sa quale volo mostrare. Senza questo si pescavano solo i `limit` più economici
  // IN ASSOLUTO su quella rotta (sorting=price), e se la data richiesta non era tra quelli
  // il match falliva e restava il placeholder "disponibili al passo di prenotazione" anche
  // per voli verificati e prenotabili. Passando la data all'API si cerca proprio quella.
  departureAt?: string | null;
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
    ...(departureAt ? { departure_at: departureAt } : {}),
  });

  const res = await fetch(`${BASE_URL}?${params.toString()}`);
  if (!res.ok) return [];
  const json = await res.json();
  // v3/prices_for_dates può restituire anche voli con scalo (campo "transfers") anche
  // filtrando per prezzo più basso — mostrarli come "Diretto" con l'orario di arrivo
  // finale dava durate assurde (es. 7h per una tratta di 1h) e un prezzo che poi in
  // fase di prenotazione risultava per un volo diverso da quello indicato.
  return (json.data ?? []).filter((r: any) => (r.transfers ?? 0) === 0).map(mapOneWayResult);
}

// ESPERIMENTO (esito incerto, da verificare dal vivo): stessa v3/prices_for_dates ma
// one_way=false — restituisce l'offerta round-trip completa con un "link" più ricco di
// quello one-way (contiene anche una firma del volo "t=" ed expected_price_uuid/currency,
// documentati da Travelpayouts come pensati per far evidenziare/preselezionare quella
// specifica offerta su Aviasales). NON documentato che salti la pagina di confronto —
// nella migliore ipotesi la offerta scelta arriva già evidenziata invece che generica.
export async function fetchRoundTripOffers({
  origin,
  destination,
  departureAt,
  returnAt,
  limit = 30,
}: {
  origin: string;
  destination: string;
  departureAt?: string | null;
  returnAt?: string | null;
  limit?: number;
}) {
  if (!TRAVELPAYOUTS_TOKEN) throw new Error("TRAVELPAYOUTS_TOKEN non configurato");

  const params = new URLSearchParams({
    origin,
    destination,
    currency: "eur",
    token: TRAVELPAYOUTS_TOKEN,
    limit: String(limit),
    sorting: "price",
    one_way: "false",
    ...(departureAt ? { departure_at: departureAt } : {}),
    ...(returnAt ? { return_at: returnAt } : {}),
  });

  const res = await fetch(`${BASE_URL}?${params.toString()}`);
  if (!res.ok) return [];
  const json = await res.json();
  return ((json.data ?? []) as any[]).map((r) => ({
    departDate: r.departure_at?.slice(0, 10) ?? null,
    returnDate: r.return_at?.slice(0, 10) ?? null,
    price: r.price,
    link: r.link ?? null,
    foundAt: r.found_at ?? null,
  }));
}
