// Edge Function: ricerca diretta (senza scalo forzato) su Travelpayouts v2/prices/latest.
// Token letto SOLO da secret server-side — mai esposto al client.
// Impostare con: supabase secrets set TRAVELPAYOUTS_TOKEN=xxx
import {
  TRAVELPAYOUTS_TOKEN,
  fetchLatestPrices,
  filterByNights,
  filterByExcludedCountries,
  filterByFreshness,
} from "../_shared/travelpayouts.ts";
import { corsHeaders } from "../_shared/cors.ts";

// Restituire 30-50 risultati aveva senso solo se restavano tutti "indicativi" per
// sempre: nessuno li avrebbe verificati uno per uno. Tenendone pochi, il client può
// verificarli TUTTI dal vivo (somma delle tratte one-way, stessa logica del dettaglio
// volo) subito dopo il caricamento — prezzi reali invece di indicativi, senza esplodere
// le chiamate verso Travelpayouts.
const MAX_RESULTS = 10;

// v2/prices/latest ordina per prezzo e il default (30) prendeva solo i 30 più economici
// IN ASSOLUTO, PRIMA di togliere i paesi esclusi — con parecchie esclusioni attive, i 30
// più economici potevano finire tutti in un paese escluso e sparire, lasciando zero
// risultati anche se esistevano destinazioni valide (solo un po' meno economiche) più giù
// nella lista. Pescando un pool ampio PRIMA del filtro, quelle destinazioni restano visibili.
const FETCH_LIMIT = 1000;

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
    // "Date fisse" è un INTERVALLO di partenza (dateFrom..dateTo), non una singola data
    // esatta — bug segnalato dall'utente: con "Dal" 2 novembre "Al" 30 novembre restavano
    // zero risultati perché prima si controllava solo "Dal" (vedi dateFiltered sotto),
    // ignorando "Al" del tutto: bastava che il 2 novembre esatto non avesse nulla in
    // cache anche se il resto di novembre sì.
    const dateFrom = filters.dateMode === "fixed" ? filters.dateFrom : null;
    const dateTo = filters.dateMode === "fixed" ? filters.dateTo : null;

    const perOrigin = await Promise.all(
      origins.map((origin) => fetchLatestPrices({ origin, destination, dateFrom, limit: FETCH_LIMIT }))
    );
    const merged = perOrigin.flat();
    // Scarta prezzi in cache troppo vecchi PRIMA di scegliere i più economici: un prezzo
    // sballato (magari visto settimane fa) altrimenti vince facilmente il ranking per prezzo.
    const fresh = filterByFreshness(merged);
    const withoutExcluded = filterByExcludedCountries(fresh, filters.excludedCountries);
    const filtered = filterByNights(withoutExcluded, filters.nightsMin, filters.nightsMax);
    // Con "Date fisse" attivo si tiene chi parte in QUALUNQUE giorno tra dateFrom e
    // dateTo inclusi (il ritorno resta filtrato dalla durata soggiorno, come sempre) —
    // non solo chi parte esattamente il primo giorno (vedi commento sopra).
    const dateFiltered =
      dateFrom && dateTo
        ? filtered.filter((r) => r.departDate >= dateFrom && r.departDate <= dateTo)
        : filtered;
    const results = dateFiltered.sort((a, b) => a.price - b.price).slice(0, MAX_RESULTS);

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
