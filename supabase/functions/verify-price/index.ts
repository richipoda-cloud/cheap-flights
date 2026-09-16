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
import { TRAVELPAYOUTS_TOKEN, fetchLatestPrices } from "../_shared/travelpayouts.ts";
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

    const [fresh, outboundOptions, inboundOptionsPerAirport] = await Promise.all([
      fetchLatestPrices({ origin: flight.origin, destination: flight.destination, dateFrom: flight.departDate }),
      fetchOneWayPrices({
        origin: flight.origin,
        destination: flight.destination,
        limit: 100,
        departureAt: flight.departDate,
      }),
      Promise.all(
        homeAirports.map((airport) =>
          fetchOneWayPrices({
            origin: flight.destination,
            destination: airport,
            limit: 100,
            departureAt: flight.returnDate,
          })
        )
      ),
    ]);

    const match = fresh.find(
      (r: any) => r.departDate === flight.departDate && r.returnDate === flight.returnDate
    );
    const outboundLeg = pickCheapestOnDate(outboundOptions, flight.departDate);
    const inboundLeg = pickCheapestOnDate(inboundOptionsPerAirport.flat(), flight.returnDate);
    // true solo se il ritorno flessibile ha davvero trovato conveniente un aeroporto
    // diverso da quello di partenza — round-trip combinato non ha più senso in quel caso.
    const returnsElsewhere = Boolean(inboundLeg && inboundLeg.destinationAirport !== flight.origin);

    // Se abbiamo entrambe le tratte one-way (quelle di cui mostriamo orario/compagnia nei
    // box Andata/Ritorno), il prezzo deve essere la LORO somma — non l'aggregato v2, che
    // può riferirsi a una combinazione voli diversa da quella effettivamente mostrata in
    // pagina (fonti scorrelate: prima si vedevano orari di un volo e il prezzo di un altro).
    // Il v2 aggregato resta solo un fallback quando manca il match one-way esatto.
    const price = outboundLeg && inboundLeg ? outboundLeg.price + inboundLeg.price : match?.price ?? flight.price;

    return new Response(
      JSON.stringify({
        price,
        deepLink: returnsElsewhere ? null : buildDeepLink(flight),
        outboundLeg,
        inboundLeg,
        returnsElsewhere,
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
