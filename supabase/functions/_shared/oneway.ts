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

export function mapOneWayResult(r: any, unverified = false) {
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
    transfers: r.transfers ?? 0,
    price: r.price,
    currency: "EUR",
    // Mai più Aviasales (era `https://www.aviasales.com${r.link}...`) — placeholder,
    // ogni chiamante (verify-price, search-stopover) sovrascrive con withAirlineDeepLink
    // (_shared/airlineLinks.ts): schema diretto della compagnia, poi homepage, altrimenti
    // resta null e il client mostra "prenota da solo" invece di un link a un sito terzo.
    deepLink: null,
    foundAt: r.found_at ?? null,
    // true solo per i voli con scalo inclusi con allowConnections (vedi sopra) — l'API
    // non garantisce che sia una connessione vera nello stesso hub e non un self-transfer
    // rischioso tra aeroporti diversi (scoperto dal vivo, vedi commento su
    // allowConnections): il client deve mostrarlo come "non confermato", mai come
    // "✓ verificato" alla pari di un volo diretto o con scalo reale.
    unverified,
  };
}

// DIAGNOSTICA ERRORI API (03/10/2026, dopo aver notato dal vivo che la ricerca con scalo
// per Thailandia aveva pool=0 su TUTTI gli 8 hub curati, su TUTTE le finestre di data
// provate — implausibile sia davvero "zero cache" su rotte europee trafficate come
// Milano/Bergamo->Istanbul/Francoforte/Amsterdam ecc.). `if (!res.ok) return []` sotto
// trattava QUALSIASI errore HTTP (incluso un 429 di rate-limit) esattamente come "nessuna
// tratta in cache" — indistinguibile nel debug mostrato in pagina. cheapestConnection in
// verify-price/index.ts lancia fino a ~40 richieste in parallelo per una singola ricerca
// con scalo (10 hub x 2 mesi x 2 direzioni + la ricerca diretta) — un burst del genere
// contro un'API gratuita è un candidato molto più plausibile di "zero dati reali".
// Questo array (letto e svuotato da verify-price a fine richiesta, vedi drainApiFetchErrors)
// rende visibile lo status HTTP vero in scaloDebug, senza bisogno di aprire i log Supabase
// (che l'utente ha scelto di non controllare — "non ho voglia").
const apiFetchErrors: Array<{ status: number; origin: string; destination?: string | null; departureAt?: string | null }> = [];

export function drainApiFetchErrors() {
  const copy = [...apiFetchErrors];
  apiFetchErrors.length = 0;
  return copy;
}

// origin/destination accettano anche codice paese; destination omesso = "ovunque".
export async function fetchOneWayPrices({
  origin,
  destination,
  limit = 30,
  departureAt,
  allowConnections = false,
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
  // Deciso esplicitamente dall'utente il 27/09/2026 dopo due tentativi scartati (Wizz Air
  // fantasma su v1/prices/cheap, easyJet self-transfer CDG/ORY su v3 con scalo): l'API non
  // ha un campo per distinguere una connessione vera nello stesso hub da un self-transfer
  // rischioso — invece di escluderle sempre (nessun dettaglio su molte intercontinentali),
  // l'utente ha scelto di mostrarle comunque MA etichettate chiaramente come non
  // confermate (vedi `unverified` in mapOneWayResult e il fallback in verify-price/
  // index.ts) invece di "✓ verificato". Di default resta false ovunque già in uso
  // (nessun cambio per i voli diretti normali, sempre affidabili).
  allowConnections?: boolean;
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
  if (!res.ok) {
    // Vedi nota "DIAGNOSTICA ERRORI API" sopra: prima qui si perdeva lo status (429, 500...)
    // e il chiamante vedeva solo un pool vuoto, indistinguibile da "nessun dato in cache".
    console.error(`[oneway] fetch fallita status=${res.status} origin=${origin} destination=${destination ?? "-"} departureAt=${departureAt ?? "-"}`);
    apiFetchErrors.push({ status: res.status, origin, destination, departureAt });
    return [];
  }
  const json = await res.json();
  // v3/prices_for_dates può restituire anche voli con scalo (campo "transfers") — mostrarli
  // come "Diretto" con l'orario di arrivo finale dava durate assurde e un prezzo che poi in
  // fase di prenotazione risultava per un volo diverso da quello indicato. Esclusi di
  // default (allowConnections=false, comportamento invariato per tutti i chiamanti
  // esistenti); inclusi SOLO quando richiesto esplicitamente (vedi sopra), sempre marcati
  // `unverified: true` da mapOneWayResult.
  const raw = json.data ?? [];
  const filtered = allowConnections ? raw : raw.filter((r: any) => (r.transfers ?? 0) === 0);
  return filtered.map((r: any) => mapOneWayResult(r, (r.transfers ?? 0) > 0));
}

// TENTATIVO SCARTATO (non un semplice "esito incerto" come sotto): v1/prices/cheap come
// ultimo fallback per compagnia/orario quando v3 non ha nulla. Codice scritto, deployato
// e testato dal vivo il 27/09/2026 sul caso segnalato (MXP->NYC): l'endpoint ha
// restituito "Wizz Air Malta" (W4) come compagnia — verificato sul sito reale Wizz Air
// con lo stesso URL costruito automaticamente: "Nessun volo in questa data" su ENTRAMBE
// le direzioni, rotta che Wizz Air (corto/medio raggio) non serve proprio. Dato di questa
// cache inaffidabile al punto di inventare compagnie su rotte mai volate — mostrarlo
// sarebbe stato peggio del placeholder onesto "disponibili al passo di prenotazione" che
// c'era prima. Rimosso subito, nessun fallback aggiuntivo oltre fetchBroaderOneWayLeg.

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
