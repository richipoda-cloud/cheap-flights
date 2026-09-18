// Edge Function: "verifica" prezzo nel dettaglio volo.
//
// LIMITE IMPORTANTE (onesto): la Data API di Travelpayouts (gratuita, scelta di progetto)
// NON offre un vero check realtime per singolo volo — quello sarebbe la Real-Time Search
// API, scartata per requisiti commerciali incompatibili. Qui si ri-interroga v2/prices/latest
// ristretto esattamente a origine/destinazione/date per prendere il dato di cache più fresco
// disponibile (prezzo, comportamento invariato), e si costruisce il deep link round-trip
// aggregato per la prenotazione (un volo diretto A/R è un biglietto unico, non due separati
// come nei Percorsi creativi — qui il deep link resta quello classico origin+date+dest+date).
//
// In più (stesso refactor one-way già fatto per i Percorsi creativi): 2 chiamate extra a
// aviasales/v3/prices_for_dates (andata + ritorno) SOLO per arricchire i box Andata/Ritorno
// con orario/compagnia/durata reali quando disponibili in cache per quella data esatta —
// se non c'è un match, resta il placeholder onesto invece di dato mancante o inventato.
//
// "Aeroporto di ritorno diverso dalla partenza" (flight.homeAirports, distinto dai
// Percorsi creativi/scalo): stessa destinazione, ma il RITORNO viene cercato su tutti gli
// aeroporti di partenza dell'utente (non solo quello usato all'andata) — se conviene
// atterrare su uno diverso, quello si mostra. Round-trip combinato non ha più senso se i
// due aeroporti differiscono: in quel caso niente deepLink unico, il client prenota i due
// biglietti separati con i deep link già presenti su outboundLeg/inboundLeg.
import { TRAVELPAYOUTS_TOKEN, fetchLatestPrices, filterByFreshness } from "../_shared/travelpayouts.ts";
import { fetchOneWayPrices } from "../_shared/oneway.ts";
import { corsHeaders } from "../_shared/cors.ts";
import airportCoords from "../_shared/airportCoords.json" with { type: "json" };

function pickCheapestOnDate(options: any[], date: string) {
  const matches = options.filter((o) => o.date === date);
  return matches.sort((a, b) => a.price - b.price)[0] ?? null;
}

// "Aeroporto di ritorno diverso dalla partenza" deve restare un'alternativa comoda, non
// un altro viaggio: 150km ≈ max 2 ore di auto/treno (Bergamo-Malpensa 77km entra,
// Milano/Bergamo-Bologna 180-240km resta fuori, coerente con l'esempio esplicito
// dell'utente). Un aeroporto senza coordinate note viene escluso per prudenza.
const MAX_RETURN_DISTANCE_KM = 150;
const COORDS: Record<string, [number, number]> = airportCoords as Record<string, [number, number]>;

function distanceKm(a: string, b: string): number | null {
  const c1 = COORDS[a];
  const c2 = COORDS[b];
  if (!c1 || !c2) return null;
  const R = 6371;
  const [lat1, lon1] = c1;
  const [lat2, lon2] = c2;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// "Ripartenza flessibile": nessuna lista fornita dall'utente per gli aeroporti vicino
// alla DESTINAZIONE (a differenza di Partenza, che l'utente cura a mano) — li si scopre
// scandendo tutte le coordinate note ed entro MAX_RETURN_DISTANCE_KM da `code`.
function nearbyAirports(code: string, maxKm: number): string[] {
  const origin = COORDS[code];
  if (!origin) return [code];
  const [lat1, lon1] = origin;
  const result = [code];
  for (const [airport, [lat2, lon2]] of Object.entries(COORDS)) {
    if (airport === code) continue;
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    if (2 * R * Math.asin(Math.sqrt(x)) <= maxKm) result.push(airport);
  }
  return result;
}

// "Andata/Ritorno con scalo" (flight.checkOutboundStop / flight.checkReturnStop): cerca
// un vero scalo (2 biglietti separati via un hub) per QUELLA tratta specifica, solo se
// batte il prezzo diretto — calcolato on-demand (chiamato solo quando l'utente espande
// un risultato con il relativo interruttore attivo, mai per i 10 risultati insieme:
// il costo in chiamate sarebbe eccessivo per una verifica automatica di massa).
const CONNECTION_HUB_CANDIDATES = 5;

async function findConnectionHubs(origin: string, excludeDestination: string, count: number) {
  const options = await fetchOneWayPrices({ origin, limit: 200 });
  const cheapestByHub = new Map<string, number>();
  for (const o of options) {
    if (o.destination === excludeDestination) continue;
    const current = cheapestByHub.get(o.destination);
    if (current == null || o.price < current) cheapestByHub.set(o.destination, o.price);
  }
  return [...cheapestByHub.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, count)
    .map(([hub]) => hub);
}

async function cheapestConnection(origin: string, destination: string, date: string) {
  const hubs = await findConnectionHubs(origin, destination, CONNECTION_HUB_CANDIDATES);
  const attempts = await Promise.all(
    hubs.map(async (hub) => {
      const [leg1Options, leg2Options] = await Promise.all([
        fetchOneWayPrices({ origin, destination: hub, limit: 50, departureAt: date }),
        fetchOneWayPrices({ origin: hub, destination, limit: 50, departureAt: date }),
      ]);
      const leg1 = pickCheapestOnDate(filterByFreshness(leg1Options), date);
      if (!leg1) return null;
      // Vincolo di sequenza: la seconda tratta deve partire dopo l'arrivo della prima,
      // altrimenti l'itinerario è fisicamente impossibile da seguire.
      const leg2 = filterByFreshness(leg2Options)
        .filter((o: any) => o.date >= leg1.date)
        .sort((a: any, b: any) => a.price - b.price)[0];
      if (!leg2) return null;
      return { legs: [leg1, leg2], total: leg1.price + leg2.price };
    })
  );
  const valid = attempts.filter((a): a is { legs: any[]; total: number } => a !== null);
  return valid.sort((a, b) => a.total - b.total)[0] ?? null;
}

const MARKER = Deno.env.get("TRAVELPAYOUTS_MARKER") ?? "";

function buildDeepLink(flight: any) {
  const fmt = (d: string) => {
    const date = new Date(d);
    return `${String(date.getDate()).padStart(2, "0")}${String(date.getMonth() + 1).padStart(2, "0")}`;
  };
  const origin = flight.origin ?? "";
  const destination = flight.destination ?? "";
  if (!origin || !destination || !flight.departDate || !flight.returnDate) return null;
  const path = `${origin}${fmt(flight.departDate)}${destination}${fmt(flight.returnDate)}1`;
  return `https://www.aviasales.com/search/${path}?marker=${MARKER}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!TRAVELPAYOUTS_TOKEN) {
    return new Response(
      JSON.stringify({ error: "TRAVELPAYOUTS_TOKEN non configurato (supabase secrets set)." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const flight = await req.json();
    // Aeroporti di partenza dell'utente per il ritorno flessibile — se assente/vuoto il
    // comportamento resta identico a prima (ritorno forzato sullo stesso flight.origin).
    // Filtrati per distanza da flight.origin: anche se l'utente ha messo in Partenza
    // aeroporti lontani tra loro per altri motivi, qui contano solo quelli comodi da
    // raggiungere al ritorno (max ~2 ore), altrimenti non è più "lo stesso viaggio".
    const candidateAirports: string[] = Array.isArray(flight.homeAirports) && flight.homeAirports.length > 0
      ? [...new Set(flight.homeAirports)]
      : [flight.origin];
    const homeAirports = candidateAirports.filter((airport) => {
      if (airport === flight.origin) return true;
      const km = distanceKm(flight.origin, airport);
      return km != null && km <= MAX_RETURN_DISTANCE_KM;
    });
    // "Ripartenza flessibile" (flight.flexReturnOrigin): il ritorno può PARTIRE da un
    // aeroporto vicino alla destinazione invece che da quello usato all'andata — distinta
    // da "Aeroporto di ritorno diverso dalla partenza" (che varia l'arrivo lato casa),
    // le due si possono anche combinare (incrocio di entrambi i lati).
    const returnOrigins = flight.flexReturnOrigin
      ? nearbyAirports(flight.destination, MAX_RETURN_DISTANCE_KM)
      : [flight.destination];

    const [latestPrices, outboundOptions, inboundOptionsPerPair] = await Promise.all([
      fetchLatestPrices({ origin: flight.origin, destination: flight.destination, dateFrom: flight.departDate }),
      fetchOneWayPrices({
        origin: flight.origin,
        destination: flight.destination,
        limit: 100,
        departureAt: flight.departDate,
      }),
      Promise.all(
        returnOrigins.flatMap((returnOrigin) =>
          homeAirports.map((airport) =>
            fetchOneWayPrices({
              origin: returnOrigin,
              destination: airport,
              limit: 100,
              departureAt: flight.returnDate,
            })
          )
        )
      ),
    ]);

    // Solo cache abbastanza recente conta come "conferma" del prezzo — una vecchia è
    // il probabile colpevole di prezzi visti in lista molto più bassi del reale.
    const match = filterByFreshness(latestPrices).find(
      (r: any) => r.departDate === flight.departDate && r.returnDate === flight.returnDate
    );
    const outboundLeg = pickCheapestOnDate(filterByFreshness(outboundOptions), flight.departDate);
    const inboundLeg = pickCheapestOnDate(filterByFreshness(inboundOptionsPerPair.flat()), flight.returnDate);
    // true solo se la flessibilità ha davvero trovato conveniente un aeroporto diverso
    // (partenza del ritorno vicino alla destinazione, o arrivo vicino a casa) — round-trip
    // combinato non ha più senso in quel caso.
    const returnsElsewhere = Boolean(
      inboundLeg &&
        (inboundLeg.originAirport !== flight.destination || inboundLeg.destinationAirport !== flight.origin)
    );

    // "Andata/Ritorno con scalo", solo su richiesta esplicita (vedi sopra) — confrontato
    // col diretto già trovato, tenuto solo se davvero più economico.
    const [outboundConnection, returnConnection] = await Promise.all([
      flight.checkOutboundStop
        ? cheapestConnection(flight.origin, flight.destination, flight.departDate)
        : null,
      flight.checkReturnStop ? cheapestConnection(flight.destination, flight.origin, flight.returnDate) : null,
    ]);
    const outboundLegs =
      outboundConnection && (!outboundLeg || outboundConnection.total < outboundLeg.price)
        ? outboundConnection.legs
        : outboundLeg
        ? [outboundLeg]
        : [];
    const inboundLegs =
      returnConnection && (!inboundLeg || returnConnection.total < inboundLeg.price)
        ? returnConnection.legs
        : inboundLeg
        ? [inboundLeg]
        : [];
    const hasStop = outboundLegs.length > 1 || inboundLegs.length > 1;

    // Se abbiamo tutte le tratte one-way (quelle di cui mostriamo orario/compagnia nei box
    // Andata/Ritorno), il prezzo deve essere la LORO somma — non l'aggregato v2, che può
    // riferirsi a una combinazione voli diversa da quella effettivamente mostrata in pagina
    // (fonti scorrelate: prima si vedevano orari di un volo e il prezzo di un altro). Il v2
    // aggregato resta solo un fallback quando mancano entrambe le tratte one-way.
    const allLegs = [...outboundLegs, ...inboundLegs];
    const price = allLegs.length > 0 ? allLegs.reduce((sum, l) => sum + l.price, 0) : match?.price ?? flight.price;
    // Un unico deep link round-trip ha senso solo per il caso semplice (1 tratta per
    // direzione, stessi aeroporti di andata/ritorno) — con uno scalo o un aeroporto
    // diverso sono biglietti separati, ognuno col proprio deepLink già su ogni leg.
    const singleTicket = !returnsElsewhere && !hasStop;
    // Onesto: "confermato" solo se il prezzo mostrato viene DAVVERO da cache abbastanza
    // fresca (somma tratte one-way o match v2 filtrati per età sopra) — se entrambi mancano
    // il prezzo è rimasto quello originale non ri-controllato (flight.price), il client non
    // deve mostrare "✓ verificato" in quel caso (era fuorviante prima di questo campo).
    const confirmed = allLegs.length > 0 || Boolean(match);

    return new Response(
      JSON.stringify({
        price,
        confirmed,
        deepLink: singleTicket ? buildDeepLink(flight) : null,
        outboundLeg: outboundLegs[0] ?? null,
        inboundLeg: inboundLegs[0] ?? null,
        outboundLegs,
        inboundLegs,
        returnsElsewhere,
        hasStop,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
