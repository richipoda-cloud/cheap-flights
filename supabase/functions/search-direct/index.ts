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
    const results = filtered.sort((a, b) => a.price - b.price);

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
