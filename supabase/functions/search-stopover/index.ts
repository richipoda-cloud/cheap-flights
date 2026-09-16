// Edge Function: "scalo libero" — usata quando flexDeparture e/o flexArrival sono attive.
//
// Modello a 4 tratte ONE-WAY indipendenti (non più 2 round-trip nidificati):
//   1) origine → hub        2) hub → destinazione
//   3) destinazione → hub   4) hub → origine
// Ogni tratta è un biglietto separato con orario/compagnia reali e deep link diretto
// (aviasales/v3/prices_for_dates, one_way=true — stessa Data API gratuita, non Real-Time).
// Vincolo di sequenza obbligatorio: ogni tratta deve avere data >= alla precedente
// (+ eventuale soggiorno minimo richiesto), altrimenti l'itinerario è impossibile.
//
// Chiamate: 1 (candidati hub, origine→ovunque) + 3 per hub candidato (hub→dest,
// dest→hub, hub→origine) = 1+3N. Vedi README per il confronto col modello precedente.
import { fetchLatestPrices, filterByNights, filterByExcludedCountries } from "../_shared/travelpayouts.ts";
import { TRAVELPAYOUTS_TOKEN, fetchOneWayPrices } from "../_shared/oneway.ts";
import { corsHeaders } from "../_shared/cors.ts";

// Ampliato da 5+10: con piu' partenze combinate e/o parecchi paesi esclusi attivi, il
// pool di hub candidati (ranking globale per prezzo minimo su TUTTE le origini insieme)
// veniva dominato da poche rotte, e la manciata che restava finiva spesso in un paese
// escluso — zero risultati anche quando ne esistevano di validi più giù in classifica.
const INITIAL_CANDIDATES = 10;
const EXPANDED_CANDIDATES = 20;
// Soglia di risparmio minimo per mostrare un percorso creativo (era 0.85 = -15%): troppo
// severa da sola scartava quasi tutte le combinazioni trovate, indipendentemente dal
// numero di hub candidati provati — abbassata a -8% su richiesta esplicita per vedere
// più percorsi anche con risparmio più modesto.
const SIGNIFICANT_SAVING_RATIO = 0.92;
const TOP_K_FIRST_LEG = 8; // ventaglio di partenze provate per la prima tratta, gratis (solo CPU)

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// maxGapDays opzionale: senza limite superiore, la tratta "più economica compatibile"
// poteva cadere mesi dopo se quella era la più economica in assoluto — la catena veniva
// costruita ignorando del tutto il limite MASSIMO di notti richiesto (solo il minimo era
// rispettato qui), e finiva scartata alla fine da filterByNights. Risultato: con una
// durata soggiorno con un tetto massimo (es. "10-15 notti"), Percorsi creativi restava
// quasi sempre vuoto anche quando esisteva una combinazione valida nella finestra giusta.
function cheapestAfter(options: any[], afterDate: string, minGapDays: number, maxGapDays = Infinity) {
  const minDate = addDays(afterDate, minGapDays);
  const maxDate = Number.isFinite(maxGapDays) ? addDays(afterDate, maxGapDays) : null;
  return options
    .filter((o) => o.date >= minDate && (!maxDate || o.date <= maxDate))
    .sort((a, b) => a.price - b.price)[0] ?? null;
}

// Prova le TOP_K partenze più economiche per la prima tratta, poi incastra a cascata
// (greedy: tratta più economica compatibile) le successive — esplorare tutte le
// combinazioni esploderebbe, questo ventaglio è un compromesso a costo zero di API.
// gapConstraints[i] = { min, max } giorni di distacco richiesti per la tratta rest[i].
function pickCheapestChain(legOptionsList: any[][], gapConstraints: { min: number; max?: number }[]) {
  const [first, ...rest] = legOptionsList;
  if (!first?.length) return null;

  let best: { legs: any[]; total: number } | null = null;
  const candidates = [...first].sort((a, b) => a.price - b.price).slice(0, TOP_K_FIRST_LEG);

  for (const start of candidates) {
    const legs = [start];
    let ok = true;
    for (let i = 0; i < rest.length; i++) {
      const constraint = gapConstraints[i] ?? { min: 0 };
      const next = cheapestAfter(rest[i], legs[legs.length - 1].date, constraint.min, constraint.max ?? Infinity);
      if (!next) {
        ok = false;
        break;
      }
      legs.push(next);
    }
    if (!ok) continue;
    const total = legs.reduce((sum, l) => sum + l.price, 0);
    if (!best || total < best.total) best = { legs, total };
  }
  return best;
}

function groupByDestination(options: any[]) {
  const groups = new Map<string, any[]>();
  for (const o of options) {
    if (!groups.has(o.destination)) groups.set(o.destination, []);
    groups.get(o.destination)!.push(o);
  }
  return groups;
}

// Un hub è solo il punto di transito tra due biglietti one-way separati, non la meta del
// viaggio (come lo scalo di un volo commerciale normale, mai soggetto a "escludi paesi").
// Filtrarlo per paese escluso qui svuotava i Percorsi creativi: con parecchie esclusioni
// attive, gli hub economici vicini finivano quasi tutti in un paese escluso e sparivano —
// il filtro va applicato solo alla destinazione FINALE, non ai candidati hub intermedi.
async function findHubCandidates(origins: string[], count: number) {
  const perOrigin = await Promise.all(origins.map((origin) => fetchOneWayPrices({ origin, limit: 200 })));
  const groups = groupByDestination(perOrigin.flat());
  const ranked = [...groups.entries()]
    .map(([hub, options]) => ({ hub, options, minPrice: Math.min(...options.map((o) => o.price)) }))
    .sort((a, b) => a.minPrice - b.minPrice)
    .slice(0, count);
  return ranked;
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
    const filters = await req.json();
    const origins: string[] = filters.origins ?? [];
    const destination: string | null = filters.destination ?? null;
    const minNightsAtDest = filters.nightsMin ?? 0;
    const maxNightsAtDest = filters.nightsMax ?? Infinity;

    // Prezzo diretto di riferimento (round-trip aggregato v2, coerente con search-direct)
    const directResults = await Promise.all(origins.map((o) => fetchLatestPrices({ origin: o, destination })));
    const directPrice = directResults.flat().sort((a, b) => a.price - b.price)[0]?.price ?? Infinity;

    let hubCandidates = await findHubCandidates(origins, INITIAL_CANDIDATES);
    let results = await buildResults(hubCandidates, origins, destination, minNightsAtDest, maxNightsAtDest, directPrice);

    if (results.length === 0) {
      const more = await findHubCandidates(origins, INITIAL_CANDIDATES + EXPANDED_CANDIDATES);
      hubCandidates = more.slice(INITIAL_CANDIDATES);
      results = await buildResults(hubCandidates, origins, destination, minNightsAtDest, maxNightsAtDest, directPrice);
    }

    const withoutExcluded = filterByExcludedCountries(results, filters.excludedCountries);
    const filtered = filterByNights(withoutExcluded, filters.nightsMin, filters.nightsMax);

    return new Response(JSON.stringify({ results: filtered.sort((a, b) => a.price - b.price) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function buildResults(
  hubCandidates: { hub: string; options: any[] }[],
  origins: string[],
  destination: string | null,
  minNightsAtDest: number,
  maxNightsAtDest: number,
  directPrice: number
) {
  const results = await Promise.all(
    hubCandidates.map(async ({ hub, options: leg1Options }) => {
      if (!destination) {
        // "Ovunque": 2 tratte one-way, hub è anche la destinazione finale.
        const leg4Options = (
          await Promise.all(origins.map((o) => fetchOneWayPrices({ origin: hub, destination: o, limit: 100 })))
        ).flat();
        const chain = pickCheapestChain(
          [leg1Options, leg4Options],
          [{ min: minNightsAtDest, max: maxNightsAtDest }]
        );
        if (!chain || chain.total >= directPrice * SIGNIFICANT_SAVING_RATIO) return null;
        return buildResultFromChain(chain, hub, chain.legs[0].destination);
      }

      // Destinazione fissa: 4 tratte — origine→hub, hub→dest, dest→hub, hub→origine
      const [leg2Options, leg3Options, leg4Options] = await Promise.all([
        fetchOneWayPrices({ origin: hub, destination, limit: 100 }),
        fetchOneWayPrices({ origin: destination, destination: hub, limit: 100 }),
        (async () =>
          (
            await Promise.all(origins.map((o) => fetchOneWayPrices({ origin: hub, destination: o, limit: 100 })))
          ).flat())(),
      ]);
      const chain = pickCheapestChain(
        [leg1Options, leg2Options, leg3Options, leg4Options],
        [{ min: 0 }, { min: minNightsAtDest, max: maxNightsAtDest }, { min: 0 }]
      );
      if (!chain || chain.total >= directPrice * SIGNIFICANT_SAVING_RATIO) return null;
      return buildResultFromChain(chain, hub, destination);
    })
  );
  return results.filter(Boolean);
}

function buildResultFromChain(chain: { legs: any[]; total: number }, hub: string, finalDestination: string) {
  const legs = chain.legs;
  const last = legs[legs.length - 1];
  const arrivalLeg = legs.length === 4 ? legs[1] : legs[0]; // tratta che arriva alla destinazione finale
  const departureLeg = legs.length === 4 ? legs[2] : last; // tratta che riparte dalla destinazione finale
  // Nel caso "Ovunque" (2 tratte) l'hub È la destinazione finale — non c'è nessuno scalo
  // reale, è solo un normale andata/ritorno comprato come due biglietti one-way separati
  // invece del round-trip aggregato (a volte più economico). Etichettarlo "via {hub}"
  // in quel caso è fuorviante (sembra un vero scalo intermedio, non lo è): viaHub resta
  // valorizzato solo per le 4 tratte con hub genuinamente diverso dalla destinazione.
  const genuineHub = hub !== finalDestination ? hub : null;
  return {
    id: `multileg-${legs.map((l) => l.id).join("-")}`,
    isStopover: true,
    viaHub: genuineHub,
    origin: legs[0].originAirport,
    destination: finalDestination,
    destinationName: arrivalLeg.destinationName,
    countryCode: arrivalLeg.countryCode,
    departDate: legs[0].date,
    returnDate: last.date,
    nights: Math.round(
      (new Date(departureLeg.date).getTime() - new Date(arrivalLeg.date).getTime()) / 86400000
    ),
    price: chain.total,
    currency: "EUR",
    legs,
  };
}
