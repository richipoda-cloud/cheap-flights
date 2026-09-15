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
import { TRAVELPAYOUTS_TOKEN, fetchLatestPrices } from "../_shared/travelpayouts.ts";
import { fetchOneWayPrices } from "../_shared/oneway.ts";
import { corsHeaders } from "../_shared/cors.ts";

function pickCheapestOnDate(options: any[], date: string) {
  const matches = options.filter((o) => o.date === date);
  return matches.sort((a, b) => a.price - b.price)[0] ?? null;
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

    const [fresh, outboundOptions, inboundOptions] = await Promise.all([
      fetchLatestPrices({ origin: flight.origin, destination: flight.destination, dateFrom: flight.departDate }),
      fetchOneWayPrices({ origin: flight.origin, destination: flight.destination, limit: 100 }),
      fetchOneWayPrices({ origin: flight.destination, destination: flight.origin, limit: 100 }),
    ]);

    const match = fresh.find(
      (r: any) => r.departDate === flight.departDate && r.returnDate === flight.returnDate
    );
    const outboundLeg = pickCheapestOnDate(outboundOptions, flight.departDate);
    const inboundLeg = pickCheapestOnDate(inboundOptions, flight.returnDate);

    return new Response(
      JSON.stringify({
        price: match?.price ?? flight.price,
        deepLink: buildDeepLink(flight),
        outboundLeg,
        inboundLeg,
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
