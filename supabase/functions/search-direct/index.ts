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
    const merged = perOrigin.flat();
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
    const deduped = [...bestByDeparture.values()].sort((a, b) => a.price - b.price);
    // Segnalato dall'utente ("come mai per USA trova solo New York?"): col dedup sopra
    // ogni data è un volo reale diverso, ma una destinazione con tante date economiche
    // (New York, 18) può comunque occupare TUTTI i 10 posti finali solo perché in media
    // costa meno di un'altra destinazione valida (Miami, 3 date) — la seconda spariva
    // anche se genuina. Primo giro: max MAX_PER_DESTINATION per città, per garantire
    // varietà; secondo giro: riempie gli slot avanzati (se non bastano destinazioni
    // diverse) con le prossime più economiche, quindi non si perde mai un posto libero.
    const MAX_PER_DESTINATION = 3;
    const perDestinationCount = new Map<string, number>();
    const diverse: typeof deduped = [];
    const leftover: typeof deduped = [];
    for (const r of deduped) {
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
