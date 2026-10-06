// ESPERIMENTO (06/10/2026) — NON usata dall'app, esiste solo per confrontare con search-direct.
//
// Idea (lavoro "refactor one-way per i Diretti normali", voce di TODO.md): invece di partire
// da v2/prices/latest (prezzo aggregato, poi ricontrollato da verify-price, con risultati che
// possono sparire dopo la verifica), costruire la lista direttamente da tratte one-way reali
// di v3/prices_for_dates — stessa strada già usata da fetchDirectRoundTrips per NYC/MIA.
// Ogni risultato nasce da un volo vero di andata e da un volo vero di ritorno (stesse notti,
// ritorno sempre dopo l'andata), quindi per costruzione verify-price lo riconferma.
//
// Passi:
//  1. andata: one-way dai tuoi aeroporti verso "ovunque" (o la destinazione scelta), le più
//     economiche in assoluto su tutte le date;
//  2. si tengono le K destinazioni con l'andata più economica;
//  3. ritorno: per ciascuna, one-way destinazione -> aeroporto di partenza;
//  4. si abbinano andata e ritorno (ritorno dopo l'andata, notti nel range), la coppia più
//     economica per ogni data di andata; poi stessa selezione di search-direct (max 2 per
//     destinazione, 10 in totale).
// Risposta nello stesso formato di search-direct + `meta` con numeri e tempi per il confronto.
import { TRAVELPAYOUTS_TOKEN, filterByExcludedCountries } from "../_shared/travelpayouts.ts";
import { fetchOneWayPrices, drainApiFetchErrors } from "../_shared/oneway.ts";
import { corsHeaders } from "../_shared/cors.ts";

const MAX_RESULTS = 10;
// Dal confronto del 06/10/2026: con 3 per destinazione poche città occupavano la lista
// (Bilbao x3, Sofia x2...). Ora max 2 per destinazione, e le due devono essere davvero
// diverse (andata a 3+ giorni di distanza e durata che differisce di 3+ notti).
const MAX_PER_DESTINATION = 2;
const MIN_GAP_DAYS = 3;
// Quante destinazioni (le più economiche in andata) si controllano sul ritorno: ogni
// destinazione costa una richiesta per aeroporto di partenza. Da 12 a 20 per più varietà.
const DESTINATIONS_TO_CHECK = 20;
// Pool andata per aeroporto (più economiche in assoluto, qualunque data/destinazione).
const OUTBOUND_LIMIT = 300;
const INBOUND_LIMIT = 100;
// Richieste contemporanee verso Travelpayouts (stesso principio di verify-price).
const CONCURRENCY = 6;
// Se l'utente non ha messo un range di notti, niente viaggi di mesi.
const DEFAULT_MAX_NIGHTS = 30;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!TRAVELPAYOUTS_TOKEN) {
    return new Response(JSON.stringify({ error: "TRAVELPAYOUTS_TOKEN non configurato." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startedAt = Date.now();
  try {
    const filters = await req.json();
    const origins: string[] = filters.origins ?? [];
    const destination: string | null = filters.destination ?? null;
    const dateFrom = filters.dateMode === "fixed" ? filters.dateFrom : null;
    const dateTo = filters.dateMode === "fixed" ? filters.dateTo : null;
    const nightsMin: number = filters.nightsMin ?? 1;
    const nightsMax: number = filters.nightsMax ?? DEFAULT_MAX_NIGHTS;

    // 1. Andata: una richiesta per aeroporto di partenza.
    const outboundPerOrigin = await mapWithConcurrency(origins, CONCURRENCY, (origin) =>
      fetchOneWayPrices({ origin, destination, limit: OUTBOUND_LIMIT })
    );
    let outbound = outboundPerOrigin.flat();
    if (dateFrom && dateTo) outbound = outbound.filter((o: any) => o.date >= dateFrom && o.date <= dateTo);
    outbound = filterByExcludedCountries(outbound, filters.excludedCountries);

    // 2. Le K destinazioni con l'andata più economica.
    const cheapestByDestination = new Map<string, number>();
    for (const o of outbound) {
      const cur = cheapestByDestination.get(o.destination);
      if (cur == null || o.price < cur) cheapestByDestination.set(o.destination, o.price);
    }
    const destinations = [...cheapestByDestination.entries()]
      .sort((a, b) => a[1] - b[1])
      .slice(0, DESTINATIONS_TO_CHECK)
      .map(([code]) => code);

    // 3. Ritorno: destinazione -> ciascun aeroporto di partenza.
    const pairs = destinations.flatMap((dest) => origins.map((origin) => ({ dest, origin })));
    const inboundPerPair = await mapWithConcurrency(pairs, CONCURRENCY, ({ dest, origin }) =>
      fetchOneWayPrices({ origin: dest, destination: origin, limit: INBOUND_LIMIT })
    );
    const inboundByKey = new Map<string, any[]>();
    pairs.forEach(({ dest, origin }, i) => inboundByKey.set(`${dest}|${origin}`, inboundPerPair[i]));

    // 4. Abbinamento andata/ritorno: ritorno dopo l'andata, notti nel range, stesso
    // aeroporto di partenza all'andata e al ritorno (come search-direct di default).
    const DAY_MS = 86400000;
    const bestByDeparture = new Map<string, any>();
    for (const out of outbound) {
      if (!destinations.includes(out.destination)) continue;
      const backs = inboundByKey.get(`${out.destination}|${out.originAirport ?? ""}`) ??
        origins.flatMap((o) => inboundByKey.get(`${out.destination}|${o}`) ?? []);
      const outT = new Date(out.date).getTime();
      for (const back of backs) {
        const nights = Math.round((new Date(back.date).getTime() - outT) / DAY_MS);
        if (nights < nightsMin || nights > nightsMax) continue;
        const total = out.price + back.price;
        const originCode = origins.find((o) => o === out.originAirport) ?? out.originAirport;
        const key = `${originCode}-${out.destination}-${out.date}`;
        const existing = bestByDeparture.get(key);
        if (!existing || total < existing.price) {
          bestByDeparture.set(key, {
            id: `${originCode}-${out.destination}-${out.date}-${back.date}`,
            origin: originCode,
            destination: out.destination,
            destinationName: out.destinationName,
            countryCode: out.countryCode,
            departDate: out.date,
            returnDate: back.date,
            price: total,
            currency: "EUR",
            nights,
            foundAt: new Date().toISOString(),
            numberOfChanges: 0,
            fromV3: true,
          });
        }
      }
    }

    const sorted = [...bestByDeparture.values()].sort((a, b) => a.price - b.price);
    const acceptedByDestination = new Map<string, any[]>();
    const diverse: any[] = [];
    const leftover: any[] = [];
    for (const r of sorted) {
      const accepted = acceptedByDestination.get(r.destination) ?? [];
      // Una seconda voce della stessa destinazione solo se è un viaggio davvero diverso.
      const distinct = accepted.every(
        (a) =>
          Math.abs(new Date(a.departDate).getTime() - new Date(r.departDate).getTime()) >= MIN_GAP_DAYS * 86400000 &&
          Math.abs(a.nights - r.nights) >= 3
      );
      if (accepted.length < MAX_PER_DESTINATION && distinct && diverse.length < MAX_RESULTS) {
        diverse.push(r);
        acceptedByDestination.set(r.destination, [...accepted, r]);
      } else {
        leftover.push(r);
      }
    }
    const results = [...diverse, ...leftover].slice(0, MAX_RESULTS).sort((a, b) => a.price - b.price);

    const apiErrors = drainApiFetchErrors();
    return new Response(
      JSON.stringify({
        results,
        meta: {
          ms: Date.now() - startedAt,
          outboundCount: outbound.length,
          destinationsConsidered: destinations,
          inboundRequests: pairs.length,
          validPairsBeforeSelection: sorted.length,
          nightsRange: [nightsMin, nightsMax],
          apiErrors: apiErrors.length > 0 ? apiErrors : null,
        },
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
