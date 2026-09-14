// Edge Function: "scalo libero" — usata quando flexDeparture e/o flexArrival sono attive.
// Logica (come da spec):
//   1) origine → ovunque (1 chiamata)
//   2) per i 3 candidati più economici: candidato → zona di destino (altre chiamate)
//   3) se nessuno dà risparmio significativo vs il diretto, allarga a 3-5 candidati extra
// Risultati restituiti separatamente ("Percorsi creativi"), mai mescolati con i diretti.
//
// NOTE: prima implementazione funzionale — da affinare con dati reali una volta attivo il
// token Travelpayouts. TODO: gestire meglio il caso destinazione "Ovunque" combinata con
// scalo libero (oggi il secondo leg usa la destinazione se fissa, altrimenti salta il narrowing).
import {
  TRAVELPAYOUTS_TOKEN,
  fetchLatestPrices,
  filterByNights,
} from "../_shared/travelpayouts.ts";

const INITIAL_CANDIDATES = 3;
const EXPANDED_CANDIDATES = 5;
const SIGNIFICANT_SAVING_RATIO = 0.85; // stopover deve costare <85% del diretto per valere la pena

async function findCandidates(origins: string[], count: number) {
  const perOrigin = await Promise.all(origins.map((origin) => fetchLatestPrices({ origin })));
  return perOrigin
    .flat()
    .sort((a, b) => a.price - b.price)
    .slice(0, count);
}

Deno.serve(async (req) => {
  if (!TRAVELPAYOUTS_TOKEN) {
    return new Response(
      JSON.stringify({ error: "TRAVELPAYOUTS_TOKEN non configurato (supabase secrets set)." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const filters = await req.json();
    const origins: string[] = filters.origins ?? [];
    const destination: string | null = filters.destination ?? null;

    // Prezzo diretto di riferimento per valutare se lo scalo conviene davvero
    const directResults = await Promise.all(
      origins.map((origin) => fetchLatestPrices({ origin, destination }))
    );
    const cheapestDirect = directResults.flat().sort((a, b) => a.price - b.price)[0];
    const directPrice = cheapestDirect?.price ?? Infinity;

    let candidates = await findCandidates(origins, INITIAL_CANDIDATES);
    let creativeResults = await buildCreativeResults(candidates, destination, directPrice);

    if (creativeResults.length === 0) {
      // Nessun risparmio significativo: allarga ad altri candidati
      const moreCandidates = await findCandidates(origins, INITIAL_CANDIDATES + EXPANDED_CANDIDATES);
      candidates = moreCandidates.slice(INITIAL_CANDIDATES);
      creativeResults = await buildCreativeResults(candidates, destination, directPrice);
    }

    const filtered = filterByNights(creativeResults, filters.nightsMin, filters.nightsMax);

    return new Response(JSON.stringify({ results: filtered.sort((a, b) => a.price - b.price) }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

async function buildCreativeResults(candidates: any[], destination: string | null, directPrice: number) {
  if (!destination) {
    // Destinazione "Ovunque" + scalo libero: i candidati stessi sono già proposte valide,
    // marcati come percorso creativo se sotto soglia di risparmio rispetto al minimo diretto.
    return candidates.filter((c) => c.price < directPrice * SIGNIFICANT_SAVING_RATIO);
  }

  const secondLegs = await Promise.all(
    candidates.map((c) => fetchLatestPrices({ origin: c.destination, destination }))
  );

  const combined = candidates.flatMap((c, i) => {
    const legs = secondLegs[i] ?? [];
    const cheapestLeg = legs.sort((a: any, b: any) => a.price - b.price)[0];
    if (!cheapestLeg) return [];
    const totalPrice = c.price + cheapestLeg.price;
    if (totalPrice >= directPrice * SIGNIFICANT_SAVING_RATIO) return [];
    return [
      {
        ...cheapestLeg,
        id: `stopover-${c.destination}-${cheapestLeg.id}`,
        price: totalPrice,
        viaHub: c.destination,
      },
    ];
  });

  return combined;
}
