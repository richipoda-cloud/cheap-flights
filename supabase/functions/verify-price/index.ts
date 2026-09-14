// Edge Function: "verifica" prezzo nel dettaglio volo.
//
// LIMITE IMPORTANTE (onesto): la Data API di Travelpayouts (gratuita, scelta di progetto)
// NON offre un vero check realtime per singolo volo — quello sarebbe la Real-Time Search
// API, scartata per requisiti commerciali incompatibili. Qui si ri-interroga v2/prices/latest
// ristretto esattamente a origine/destinazione/date per prendere il dato di cache più fresco
// disponibile, e si costruisce il deep link alla ricerca reale su Aviasales (partner
// Travelpayouts) dove il prezzo vero e finale si vede al passo di prenotazione.
// La UI tratta comunque questo come "confermato" per semplicità (richiesta di prodotto).
import { TRAVELPAYOUTS_TOKEN, fetchLatestPrices } from "../_shared/travelpayouts.ts";

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
  if (!TRAVELPAYOUTS_TOKEN) {
    return new Response(
      JSON.stringify({ error: "TRAVELPAYOUTS_TOKEN non configurato (supabase secrets set)." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const flight = await req.json();
    const fresh = await fetchLatestPrices({
      origin: flight.origin,
      destination: flight.destination,
      dateFrom: flight.departDate,
    });

    const match = fresh.find(
      (r: any) => r.departDate === flight.departDate && r.returnDate === flight.returnDate
    );

    return new Response(
      JSON.stringify({
        price: match?.price ?? flight.price,
        deepLink: buildDeepLink(flight),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
