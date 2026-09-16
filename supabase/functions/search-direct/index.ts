// Edge Function: ricerca diretta (senza scalo forzato) su Travelpayouts v2/prices/latest.
// Token letto SOLO da secret server-side — mai esposto al client.
// Impostare con: supabase secrets set TRAVELPAYOUTS_TOKEN=xxx
import {
  TRAVELPAYOUTS_TOKEN,
  fetchLatestPrices,
  filterByNights,
  filterByExcludedCountries,
} from "../_shared/travelpayouts.ts";
import { corsHeaders } from "../_shared/cors.ts";

// Restituire 30-50 risultati aveva senso solo se restavano tutti "indicativi" per
// sempre: nessuno li avrebbe verificati uno per uno. Tenendone pochi, il client può
// verificarli TUTTI dal vivo (somma delle tratte one-way, stessa logica del dettaglio
// volo) subito dopo il caricamento — prezzi reali invece di indicativi, senza esplodere
// le chiamate verso Travelpayouts.
const MAX_RESULTS = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!TRAVELPAYOUTS_TOKEN) {
    return new Response(
      JSON.stringify({ error: "TRAVELPAYOUTS_TOKEN non configurato (supabase secrets set)." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const filters = await req.json();
    const origins: string[] = filters.origins ?? [];
    const destination: string | null = filters.destination ?? null; // null = "Ovunque"
    // Finestra sempre allargata oltre la richiesta utente, per non perdere il vero minimo
    // (qui delegato alla cache Travelpayouts che copre già mesi futuri per "Sempre").
    const dateFrom = filters.dateMode === "fixed" ? filters.dateFrom : null;

    const perOrigin = await Promise.all(
      origins.map((origin) => fetchLatestPrices({ origin, destination, dateFrom }))
    );
    const merged = perOrigin.flat();
    const withoutExcluded = filterByExcludedCountries(merged, filters.excludedCountries);
    const filtered = filterByNights(withoutExcluded, filters.nightsMin, filters.nightsMax);
    const results = filtered.sort((a, b) => a.price - b.price).slice(0, MAX_RESULTS);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
