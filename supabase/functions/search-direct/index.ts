// Edge Function: ricerca diretta (senza scalo forzato) su Travelpayouts v2/prices/latest.
// Token letto SOLO da secret server-side — mai esposto al client.
// Impostare con: supabase secrets set TRAVELPAYOUTS_TOKEN=xxx
import {
  TRAVELPAYOUTS_TOKEN,
  fetchLatestPrices,
  filterByNights,
  filterByExcludedCountries,
  filterByFreshness,
  CHARTER_TRUSTED_CITIES,
} from "../_shared/travelpayouts.ts";
import { fetchOneWayPrices } from "../_shared/oneway.ts";
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

// Segnalato dall'utente ("0 risultati per USA impossibile, esistono voli diretti da
// Milano"): v2/prices/latest interrogato con destination=CODICE PAESE (es. "US") ha una
// cache MOLTO più povera di quando si passa una città/aeroporto specifico — verificato
// dal vivo il 27/09/2026: MXP->US (paese) dava 20 risultati totali, ZERO senza scalo;
// MXP->NYC (città) ne dava 182, di cui 83 senza scalo. Iterare su TUTTE le città di un
// paese non è fattibile (gli USA da soli ne hanno ~2000 in cities.json): lista curata
// delle sole città verificate con voli nonstop reali in cache da MXP, aggiunta IN PIÙ
// alla query per paese (mai al posto di) — non esaustiva, da ampliare se segnalato per
// altri paesi (vedi TODO.md). Le altre città USA testate (LAX/CHI/ATL/BOS/SFO/LAS/WAS)
// davano zero nonstop, coerente con la vera rete Malpensa-USA (pochi widebody).
// Ampliato il 27/09/2026 ("verifica anche altre destinazioni con lo stesso problema"):
// stesso identico test (destination=PAESE vs una a una le sue città più plausibili,
// contando number_of_changes:0) ripetuto su ~25 paesi. Aggiunte solo le città con un
// numero di voli nonstop reali chiaramente significativo (soglia pratica ~15+, non un
// singolo risultato isolato che potrebbe anche essere rumore) — es. IST 231, BKK 190,
// CAI 325, DXB 60. Paesi testati ma SENZA aggiunta perché zero nonstop anche a livello
// di città (coerente con la vera rete, non un buco nei dati da correggere qui): QA (Doha),
// MX, AR, AU, ZA, DO, CU, LK, ID, SG, KE, TZ, VN (HAN solo 2, MLE 1: troppo marginali).
const COUNTRY_MAJOR_CITIES: Record<string, string[]> = {
  US: ["NYC", "MIA"],
  JP: ["TYO"],
  AE: ["DXB"], // Dubai, 60 nonstop
  EG: ["CAI"], // Il Cairo, 325 nonstop
  MA: ["CMN", "RAK"], // Casablanca 16, Marrakech 26
  IL: ["TLV"], // Tel Aviv, 27
  TR: ["IST"], // Istanbul, 231
  IN: ["DEL"], // Delhi, 27
  CN: ["PEK", "PVG"], // Pechino 25, Shanghai 85
  KR: ["SEL"], // Seoul, 17
  TH: ["BKK"], // Bangkok, 190
  CA: ["YTO"], // Toronto, 24
  BR: ["SAO"], // San Paolo, 19
  // Destinazioni charter (segnalato dall'utente, a ragione: voli diretti charter veri
  // esistono — Neos e simili — anche se Travelpayouts non li marca MAI number_of_changes:0,
  // vedi CHARTER_TRUSTED_CITIES sotto). Prezzo reale in cache confermato dal vivo (7-45
  // risultati a seconda della città), solo l'etichetta "scali" della API è inaffidabile.
  TZ: ["ZNZ"], // Zanzibar, 23 prezzi in cache
  KE: ["MBA"], // Mombasa (non Nairobi: i charter volano lì), 7
  DO: ["PUJ"], // Punta Cana, 12
  MV: ["MLE"], // Maldive, 41
  LK: ["CMB"], // Colombo, 38
  ID: ["DPS"], // Bali, 45
  MX: ["CUN"], // Cancun, 4 (poco ma reale, meglio di zero)
};

// Segnalato dall'utente ("trovi i diretti e me li riporti CON i dettagli", dopo troppi
// giri intorno al problema "prezzo confermato ma compagnia/orario a volte mancanti"):
// finora "Risultati" nasceva SEMPRE da v2/prices/latest (solo prezzo, mai compagnia/
// orario), poi verify-price provava a cercare orario/compagnia separatamente su v3 per
// la STESSA data — spesso senza successo, perché v2 e v3 sono due cache scorrelate.
// Qui invece si costruisce il risultato DIRETTAMENTE dalle tratte one-way vere di v3
// (andata + ritorno, entrambe senza scalo, esistenti per davvero) — la data scelta è
// SEMPRE una data che ha un volo one-way reale su entrambe le tratte, quindi il
// dettaglio dopo (verify-price) lo ritrova sempre, per costruzione. Solo per città
// "normali" (compagnie di linea) — le destinazioni charter (CHARTER_TRUSTED_CITIES)
// restano sul percorso v2 già esistente, perché v3 non ha proprio dati nonstop per loro.
//
// Scoperto dal vivo (MXP-NYC): il ritorno nonstop NYC->MXP ha ZERO dati in v3 pur avendo
// l'andata 83 — ma NYC->BGY o IST->BGY (aeroporto diverso, stesso viaggio) spesso SÌ
// (53 per IST->BGY). Per questo il ritorno si cerca verso QUALUNQUE aeroporto di partenza
// dell'utente, non solo quello usato all'andata — stesso principio già usato altrove
// nell'app (aeroporto di ritorno diverso dalla partenza).
//
// `fromV3: true` aggiunto (02/10/2026, bug segnalato dall'utente: "Destinazione fissa
// Stati Uniti" non trovava NEMMENO UN risultato confermato, nonostante NYC/MIA abbiano
// dati v3 reali): questi risultati sono costruiti da voli one-way VERI, quindi garantiti
// riconfermabili da verify-price (stessa esatta data, per costruzione) — a differenza dei
// risultati da v2/prices/latest (destination="US", paese), che tornano prezzi per
// QUALUNQUE città americana (non solo NYC/MIA) su una data scelta quasi a caso dalla
// cache, spesso NON riconfermabile. Prima i due tipi venivano ordinati insieme per solo
// prezzo: se v2 restituiva prezzi (magari non più validi) per altre città USA più
// economici di NYC/MIA, occupavano tutti i 10 posti finali e i risultati DAVVERO
// confermabili (NYC/MIA) restavano fuori dalla lista — da qui "nemmeno uno" confermato,
// pur esistendo dati reali sottostanti. Vedi priorità in fondo al file.
//
// CORREZIONE (06/10/2026, "ancora niente con Stati Uniti"): nonostante quanto sopra, per
// NYC/MIA questa funzione restituiva comunque ZERO risultati (nessun fromV3 in lista). Causa
// trovata: la richiesta one-way senza `departure_at` prende le `limit` tratte più economiche
// IN ASSOLUTO sull'intera rotta, in gran parte CON scalo — il filtro "solo diretti" di
// fetchOneWayPrices le scarta tutte e non resta nulla (mentre verify-price, che interroga
// mese per mese, i voli diretti li trova eccome). Ora si interroga mese per mese anche qui
// (stessa strategia di verify-price), solo per i mesi rilevanti (date fisse se impostate,
// altrimenti i prossimi mesi), e l'abbinamento rispetta le notti scelte dall'utente.
const DIRECT_RT_DEFAULT_MONTHS = 6;
const DIRECT_RT_MAX_MONTHS = 12;
const DIRECT_RT_LIMIT = 100;
const DIRECT_RT_CONCURRENCY = 6;
const DIRECT_RT_DEFAULT_MAX_NIGHTS = 30;

// Elenco "YYYY-MM" da un mese all'altro compresi.
function monthRange(startYm: string, count: number): string[] {
  const out: string[] = [];
  let y = Number(startYm.slice(0, 4));
  let m = Number(startYm.slice(5, 7));
  for (let i = 0; i < count; i++) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

function monthsBetween(fromYm: string, toYm: string): number {
  return (Number(toYm.slice(0, 4)) - Number(fromYm.slice(0, 4))) * 12 + (Number(toYm.slice(5, 7)) - Number(fromYm.slice(5, 7))) + 1;
}

async function fetchDirectRoundTrips(
  origins: string[],
  destination: string,
  filters: any,
  dateFrom: string | null,
  dateTo: string | null
): Promise<any[]> {
  const nightsMin: number = filters.nightsMin ?? 1;
  const nightsMax: number =
    filters.nightsMax ?? (filters.nightsMin != null ? Number.POSITIVE_INFINITY : DIRECT_RT_DEFAULT_MAX_NIGHTS);

  // Mesi di partenza: l'intervallo "Date fisse" se c'è, altrimenti i prossimi mesi da oggi.
  const todayYm = new Date().toISOString().slice(0, 7);
  let outMonths: string[];
  if (dateFrom && dateTo) {
    const count = Math.min(Math.max(monthsBetween(dateFrom.slice(0, 7), dateTo.slice(0, 7)), 1), DIRECT_RT_MAX_MONTHS);
    outMonths = monthRange(dateFrom.slice(0, 7), count);
  } else {
    outMonths = monthRange(todayYm, DIRECT_RT_DEFAULT_MONTHS);
  }
  // Ritorno: gli stessi mesi + il successivo (il ritorno viene dopo la partenza).
  const inMonths = monthRange(outMonths[0], outMonths.length + 1);

  const outboundTasks = origins.flatMap((origin) => outMonths.map((month) => ({ origin, month })));
  const inboundTasks = origins.flatMap((origin) => inMonths.map((month) => ({ origin, month })));
  const [outboundLists, inboundLists] = await Promise.all([
    mapWithConcurrency(outboundTasks, DIRECT_RT_CONCURRENCY, ({ origin, month }) =>
      fetchOneWayPrices({ origin, destination, limit: DIRECT_RT_LIMIT, departureAt: month })
    ),
    mapWithConcurrency(inboundTasks, DIRECT_RT_CONCURRENCY, ({ origin, month }) =>
      fetchOneWayPrices({ origin: destination, destination: origin, limit: DIRECT_RT_LIMIT, departureAt: month })
    ),
  ]);
  let outboundOptions = outboundLists.flat();
  const inboundOptions = inboundLists.flat();
  if (dateFrom && dateTo) {
    outboundOptions = outboundOptions.filter((o: any) => o.date >= dateFrom && o.date <= dateTo);
  }
  if (!outboundOptions.length || !inboundOptions.length) return [];

  const DAY_MS = 86400000;
  const results: any[] = [];
  for (const out of outboundOptions) {
    const outTime = new Date(out.date).getTime();
    let best: any = null;
    let bestNights = 0;
    for (const back of inboundOptions) {
      const backTime = new Date(back.date).getTime();
      if (backTime <= outTime) continue;
      const nights = Math.round((backTime - outTime) / DAY_MS);
      // Rispetta le notti scelte: prima si prendeva il ritorno più economico a qualunque
      // distanza e poi il filtro notti lo scartava, buttando via anche l'andata.
      if (nights < nightsMin || nights > nightsMax) continue;
      if (!best || back.price < best.price || (back.price === best.price && nights < bestNights)) {
        best = back;
        bestNights = nights;
      }
    }
    if (!best) continue;
    results.push({
      id: `${out.originAirport}-${destination}-${out.date}-${best.date}`,
      origin: out.originAirport,
      destination,
      destinationName: out.destinationName,
      countryCode: out.countryCode,
      departDate: out.date,
      returnDate: best.date,
      price: out.price + best.price,
      currency: "EUR",
      nights: bestNights,
      // v3/prices_for_dates espone found_at solo per prezzi delle ultime 48 ore (Travelpayouts
      // lo popola solo così) — questi voli sono per definizione già "freschi", niente da
      // scartare col filtro di freschezza (pensato per v2, che può restare in cache settimane).
      foundAt: new Date().toISOString(),
      numberOfChanges: 0,
      fromV3: true,
    });
  }
  return results;
}

// UNIONE DELLE DUE RICERCHE PER "OVUNQUE" (06/10/2026, scelta esplicita dell'utente dopo il
// confronto con la funzione di prova search-direct-v2): costruire la lista da tratte one-way
// REALI (andata + ritorno, abbinate con ritorno dopo l'andata e notti nel range) dava il 100%
// di risultati confermati e col prezzo giusto, ma da sola meno varieta' di destinazioni e
// viaggi più lunghi (le coppie più economiche si concentrano in poche città). Qui si usa
// SOLO per le ricerche "Ovunque" (destinazione fissa invariata) e SOLO per riservare fino a
// ONEWAY_RESERVED_SLOTS posti, gli altri restano alla ricerca di sempre (v2). Se questa parte
// fallisce o non trova nulla, il comportamento è esattamente quello di prima.
//
// Passi: andata one-way dai tuoi aeroporti verso ovunque (le più economiche in assoluto);
// K destinazioni con l'andata più economica; ritorno one-way per ciascuna verso ogni
// aeroporto di partenza; abbinamento (ritorno dopo l'andata, stesse notti del filtro).
const ONEWAY_RESERVED_SLOTS = 5;
const ONEWAY_MAX_PER_DESTINATION = 2;
const ONEWAY_MIN_GAP_DAYS = 3;
const ONEWAY_DESTINATIONS_TO_CHECK = 20;
const ONEWAY_OUTBOUND_LIMIT = 300;
const ONEWAY_INBOUND_LIMIT = 100;
const ONEWAY_CONCURRENCY = 6;
// Senza nessun filtro sulle notti: niente viaggi di mesi. Con solo il minimo (es. "15 o più")
// nessun tetto, la scelta resta dell'utente.
const ONEWAY_DEFAULT_MAX_NIGHTS = 30;

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

async function buildOneWayRoundTripsAnywhere(
  origins: string[],
  filters: any,
  dateFrom: string | null,
  dateTo: string | null
): Promise<any[]> {
  if (origins.length === 0) return [];
  const nightsMin: number = filters.nightsMin ?? 1;
  const nightsMax: number =
    filters.nightsMax ?? (filters.nightsMin != null ? Number.POSITIVE_INFINITY : ONEWAY_DEFAULT_MAX_NIGHTS);

  const outboundPerOrigin = await mapWithConcurrency(origins, ONEWAY_CONCURRENCY, (origin) =>
    fetchOneWayPrices({ origin, limit: ONEWAY_OUTBOUND_LIMIT })
  );
  let outbound = outboundPerOrigin.flat();
  if (dateFrom && dateTo) outbound = outbound.filter((o: any) => o.date >= dateFrom && o.date <= dateTo);
  outbound = filterByExcludedCountries(outbound, filters.excludedCountries);

  const cheapestByDestination = new Map<string, number>();
  for (const o of outbound) {
    const cur = cheapestByDestination.get(o.destination);
    if (cur == null || o.price < cur) cheapestByDestination.set(o.destination, o.price);
  }
  const destinations = [...cheapestByDestination.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, ONEWAY_DESTINATIONS_TO_CHECK)
    .map(([code]) => code);

  const pairs = destinations.flatMap((dest) => origins.map((origin) => ({ dest, origin })));
  const inboundPerPair = await mapWithConcurrency(pairs, ONEWAY_CONCURRENCY, ({ dest, origin }) =>
    fetchOneWayPrices({ origin: dest, destination: origin, limit: ONEWAY_INBOUND_LIMIT })
  );
  const inboundByKey = new Map<string, any[]>();
  pairs.forEach(({ dest, origin }, i) => inboundByKey.set(`${dest}|${origin}`, inboundPerPair[i]));

  const DAY_MS = 86400000;
  const bestByDeparture = new Map<string, any>();
  for (const out of outbound) {
    if (!destinations.includes(out.destination)) continue;
    const backs =
      inboundByKey.get(`${out.destination}|${out.originAirport ?? ""}`) ??
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

  // Al massimo ONEWAY_MAX_PER_DESTINATION per destinazione, e solo viaggi davvero diversi
  // (andata a 3+ giorni di distanza, durata che differisce di 3+ notti).
  const sorted = [...bestByDeparture.values()].sort((a, b) => a.price - b.price);
  const acceptedByDestination = new Map<string, any[]>();
  const picked: any[] = [];
  for (const r of sorted) {
    if (picked.length >= ONEWAY_RESERVED_SLOTS) break;
    const accepted = acceptedByDestination.get(r.destination) ?? [];
    const distinct = accepted.every(
      (a) =>
        Math.abs(new Date(a.departDate).getTime() - new Date(r.departDate).getTime()) >=
          ONEWAY_MIN_GAP_DAYS * DAY_MS && Math.abs(a.nights - r.nights) >= 3
    );
    if (accepted.length < ONEWAY_MAX_PER_DESTINATION && distinct) {
      picked.push(r);
      acceptedByDestination.set(r.destination, [...accepted, r]);
    }
  }
  return picked;
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
    const destination: string | null = filters.destination ?? null; // null = "Ovunque"
    // "Date fisse" è un INTERVALLO di partenza (dateFrom..dateTo), non una singola data
    // esatta — bug segnalato dall'utente: con "Dal" 2 novembre "Al" 30 novembre restavano
    // zero risultati perché prima si controllava solo "Dal" (vedi dateFiltered sotto),
    // ignorando "Al" del tutto: bastava che il 2 novembre esatto non avesse nulla in
    // cache anche se il resto di novembre sì.
    const dateFrom = filters.dateMode === "fixed" ? filters.dateFrom : null;
    const dateTo = filters.dateMode === "fixed" ? filters.dateTo : null;

    // Parte "voli reali one-way" (solo Ovunque, vedi nota UNIONE DELLE DUE RICERCHE sopra):
    // avviata subito, in parallelo con la ricerca di sempre. Qualsiasi errore qui non deve mai
    // rompere la ricerca — si ricade su una lista vuota (comportamento di prima).
    const oneWayPromise: Promise<any[]> = destination
      ? Promise.resolve([])
      : buildOneWayRoundTripsAnywhere(origins, filters, dateFrom, dateTo).catch((e) => {
          console.error(`[search-direct] one-way anywhere fallita: ${e}`);
          return [];
        });

    // "Destinazione fissa" a un PAESE (2 lettere, es. "US") invece che a una città/
    // aeroporto (3 lettere, es. "NYC") — vedi COUNTRY_MAJOR_CITIES sopra.
    const extraCityDestinations =
      destination && destination.length === 2 ? COUNTRY_MAJOR_CITIES[destination] ?? [] : [];
    const perOrigin = await Promise.all(
      origins.flatMap((origin) => [
        fetchLatestPrices({ origin, destination, dateFrom, limit: FETCH_LIMIT }),
        ...extraCityDestinations.map((city) =>
          fetchLatestPrices({ origin, destination: city, dateFrom, limit: FETCH_LIMIT })
        ),
      ])
    );
    // Città "normali" (compagnie di linea, non charter) per cui vale la pena costruire
    // il risultato direttamente da v3 one-way (vedi fetchDirectRoundTrips sopra) — quando
    // destination è già una città/aeroporto (3 lettere) la si prova sempre, altrimenti solo
    // le città curate note per un paese (COUNTRY_MAJOR_CITIES), escluse quelle charter
    // (CHARTER_TRUSTED_CITIES: v3 non ha proprio dati nonstop per loro, provarci è inutile).
    const regularCityTargets = [
      ...(destination && destination.length === 3 && !CHARTER_TRUSTED_CITIES.has(destination)
        ? [destination]
        : []),
      ...extraCityDestinations.filter((c) => !CHARTER_TRUSTED_CITIES.has(c)),
    ];
    const directRoundTripsPerCity = await Promise.all(
      regularCityTargets.map((city) => fetchDirectRoundTrips(origins, city, filters, dateFrom, dateTo))
    );
    const merged = [...perOrigin.flat(), ...directRoundTripsPerCity.flat()];
    // Scarta prezzi in cache troppo vecchi PRIMA di scegliere i più economici: un prezzo
    // sballato (magari visto settimane fa) altrimenti vince facilmente il ranking per prezzo.
    const fresh = filterByFreshness(merged);
    // Segnalato dall'utente ("non ho attivato il bottone con scalo, perché propone rotte
    // con scalo?"): "Risultati" prendeva il prezzo più economico in cache per la rotta,
    // CON O SENZA scalo, a prescindere dal toggle "Andata/Ritorno con scalo" — quel
    // toggle serve solo per un secondo tentativo (assemblare un itinerario più economico
    // via hub, calcolato solo aprendo un risultato), non decide cosa entra in lista.
    // Di default si tengono ora solo i prezzi DAVVERO senza scalo (number_of_changes:0,
    // campo v2 mai letto finora) — con scalo solo se l'utente ha esplicitamente attivato
    // quel toggle prima di cercare.
    const allowStops = Boolean(filters.flexOutboundStop || filters.flexReturnStop);
    const nonstopOnly = allowStops
      ? fresh
      : fresh.filter((r) => r.numberOfChanges === 0 || CHARTER_TRUSTED_CITIES.has(r.destination));
    const withoutExcluded = filterByExcludedCountries(nonstopOnly, filters.excludedCountries);
    const filtered = filterByNights(withoutExcluded, filters.nightsMin, filters.nightsMax);
    // Con "Date fisse" attivo si tiene chi parte in QUALUNQUE giorno tra dateFrom e
    // dateTo inclusi (il ritorno resta filtrato dalla durata soggiorno, come sempre) —
    // non solo chi parte esattamente il primo giorno (vedi commento sopra).
    const dateFiltered =
      dateFrom && dateTo
        ? filtered.filter((r) => r.departDate >= dateFrom && r.departDate <= dateTo)
        : filtered;
    // Segnalato dall'utente ("solo due voli del cazzo" per gli USA): v2/prices/latest
    // mette in cache lo STESSO volo di andata abbinato a decine di date di ritorno
    // diverse (stesso departDate, returnDate/nights diversi) — senza dedup, i 10 slot
    // finali finivano quasi tutti occupati da varianti-ritorno della stessa manciata di
    // partenze più economiche, invece di mostrare la vera varietà di date disponibili
    // (18 partenze diverse trovate per MXP-NYC, non le 2 che sembravano in lista).
    // Tenuta solo la combinazione più economica per ogni (origine, destinazione, andata).
    const bestByDeparture = new Map<string, (typeof dateFiltered)[number]>();
    for (const r of dateFiltered) {
      const key = `${r.origin}-${r.destination}-${r.departDate}`;
      const existing = bestByDeparture.get(key);
      if (!existing || r.price < existing.price) bestByDeparture.set(key, r);
    }
    // PRIORITÀ (02/10/2026, bug "nemmeno un risultato confermato per Stati Uniti" —
    // vedi commento su fromV3 in fetchDirectRoundTrips sopra): prima tutti i risultati
    // costruiti da v3 (garantiti riconfermabili), ordinati per prezzo tra loro; SOLO DOPO
    // quelli dal solo aggregato v2 (mai garantiti), anche se questi ultimi avessero un
    // prezzo più basso. Prima era un unico sort per prezzo: un prezzo v2 economico ma non
    // riconfermabile per un'altra città USA poteva occupare il posto di un volo NYC/MIA
    // vero e verificabile, lasciando la lista finale senza un solo risultato confermabile
    // pur esistendoci dati reali sottostanti.
    const deduped = [...bestByDeparture.values()].sort((a, b) => {
      if (Boolean(a.fromV3) !== Boolean(b.fromV3)) return a.fromV3 ? -1 : 1;
      return a.price - b.price;
    });
    // Segnalato dall'utente ("come mai per USA trova solo New York?"): col dedup sopra
    // ogni data è un volo reale diverso, ma una destinazione con tante date economiche
    // (New York, 18) può comunque occupare TUTTI i 10 posti finali solo perché in media
    // costa meno di un'altra destinazione valida (Miami, 3 date) — la seconda spariva
    // anche se genuina. Primo giro: max MAX_PER_DESTINATION per città, per garantire
    // varietà; secondo giro: riempie gli slot avanzati (se non bastano destinazioni
    // diverse) con le prossime più economiche, quindi non si perde mai un posto libero.
    const MAX_PER_DESTINATION = 3;
    // Solo "Ovunque": i primi posti vanno ai voli costruiti da tratte one-way reali (vedi nota
    // UNIONE DELLE DUE RICERCHE sopra), contati nel limite per destinazione; il resto della
    // lista parte dalla ricerca di sempre, senza duplicare le stesse date di andata.
    const reserved = await oneWayPromise;
    const perDestinationCount = new Map<string, number>();
    const reservedKeys = new Set<string>();
    for (const r of reserved) {
      perDestinationCount.set(r.destination, (perDestinationCount.get(r.destination) ?? 0) + 1);
      reservedKeys.add(`${r.origin}-${r.destination}-${r.departDate}`);
    }
    const candidates = deduped.filter((r) => !reservedKeys.has(`${r.origin}-${r.destination}-${r.departDate}`));
    const diverse: typeof deduped = [...reserved];
    const leftover: typeof deduped = [];
    for (const r of candidates) {
      const count = perDestinationCount.get(r.destination) ?? 0;
      if (count < MAX_PER_DESTINATION && diverse.length < MAX_RESULTS) {
        diverse.push(r);
        perDestinationCount.set(r.destination, count + 1);
      } else {
        leftover.push(r);
      }
    }
    const results = [...diverse, ...leftover].slice(0, MAX_RESULTS).sort((a, b) => a.price - b.price);

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
