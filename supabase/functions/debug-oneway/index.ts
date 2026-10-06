// DIAGNOSTICA TEMPORANEA (06/10/2026) — da rimuovere. Conta le tratte one-way dirette per mese.
import { fetchOneWayPrices, drainApiFetchErrors } from "../_shared/oneway.ts";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { origin, destination, months } = await req.json();
    const out: any[] = [];
    for (const m of months as string[]) {
      const go = await fetchOneWayPrices({ origin, destination, limit: 100, departureAt: m });
      const back = await fetchOneWayPrices({ origin: destination, destination: origin, limit: 100, departureAt: m });
      out.push({
        month: m,
        go: go.length,
        goSample: go.slice(0, 3).map((x: any) => [x.date, x.price]),
        back: back.length,
        backSample: back.slice(0, 3).map((x: any) => [x.date, x.price]),
      });
    }
    return new Response(JSON.stringify({ out, apiErrors: drainApiFetchErrors() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
