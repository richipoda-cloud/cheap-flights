// Edge Function: "verifica" prezzo nel dettaglio volo.
//
// LIMITE IMPORTANTE (onesto): la Data API di Travelpayouts (gratuita, scelta di progetto)
// NON offre un vero check realtime per singolo volo — quello sarebbe la Real-Time Search
// API, scartata per requisiti commerciali incompatibili. Qui si ri-interroga v2/prices/latest
// ristretto esattamente a origine/destinazione/date per prendere il dato di cache più fresco
// disponibile (prezzo, comportamento invariato), e si costruisce il deep link round-trip
// aggregato per la prenotazione (un volo diretto A/R è un biglietto unico, non due separati
// come nei Percorsi creativi — qui il deep link resta quello classico origin+date+dest+date).
//
// In più (stesso refactor one-way già fatto per i Percorsi creativi): 2 chiamate extra a
// aviasales/v3/prices_for_dates (andata + ritorno) SOLO per arricchire i box Andata/Ritorno
// con orario/compagnia/durata reali quando disponibili in cache per quella data esatta —
// se non c'è un match, resta il placeholder onesto invece di dato mancante o inventato.
//
// "Aeroporto di ritorno diverso dalla partenza" (flight.homeAirports, distinto dai
// Percorsi creativi/scalo): stessa destinazione, ma il RITORNO viene cercato su tutti gli
// aeroporti di partenza dell'utente (non solo quello usato all'andata) — se conviene
// atterrare su uno diverso, quello si mostra. Round-trip combinato non ha più senso se i
// due aeroporti differiscono: in quel caso niente deepLink unico, il client prenota i due
// biglietti separati con i deep link già presenti su outboundLeg/inboundLeg.
//
// ESPERIMENTO ROUND-TRIP (02/10/2026, CHIUSO — richiesto dall'utente, "lavoriamo su come
// sfruttare Aviasales che già va"): provato v3/prices_for_dates con one_way=false per le
// rotte USA/Giappone/ecc. prive di match esatto, nella speranza di dati più ricchi. Testato
// dal vivo (MXP-MIA 17-25/11/2026): risposta `{"data": []}`, vuota — stesso buco di cache
// della modalità one-way, nessun vantaggio. Rimosso il campo di debug e la chiamata grezza
// che lo popolava; non riprovare senza una nuova idea concreta sul perché dovrebbe funzionare.
//
// DECISIONE FINALE (02/10/2026, richiesta esplicita dell'utente dopo aver visto dal vivo
// l'esperimento sopra — "non mi interessa trovare un prezzo per un volo che non posso
// sapere... io devo trovare un volo vero"): esposto qui `flightConfirmed` (= bothDirectionsMatched
// sotto) perché il client (Results.jsx) possa nascondere del tutto un risultato quando NON
// conosciamo il volo reale (compagnia/orario su ENTRAMBE le tratte) — un prezzo confermato
// da solo (v2 aggregato, `confirmed`) non basta più a tenerlo in lista: l'utente vuole solo
// voli che può davvero prenotare sapendo cosa sta comprando, mai un prezzo abbinato a un
// volo indovinato. Capovolge la regola del 27/09/2026 ("meglio un nome di compagnia
// indovinato che niente"): quella restava valida nel box di dettaglio quando il risultato
// era comunque mostrato, ma ora quei risultati non arrivano proprio in lista, quindi il
// fallback "non confermato" sotto resta solo per i Preferiti già salvati (FlightDetail.jsx),
// non per i Risultati di una nuova ricerca.
//
// TOLLERANZA DI DATA SOLO PER LO SCALO (02/10/2026, richiesta esplicita dell'utente dopo
// aver visto che Thailandia e Stati Uniti trovavano zero proposte con scalo pur dopo aver
// escluso il rate limit come causa — vedi CONNECTION_DATE_TOLERANCE_DAYS sotto): la regola
// "data esatta o niente" sopra resta intatta per i voli DIRETTI (flightConfirmed normale).
// Per il solo scalo, cercare la tratta via hub esattamente nello stesso giorno già raro del
// diretto è quasi sempre impossibile su rotte intercontinentali (cache one-way sparsa per
// data esatta, stesso problema noto di fetchBroaderOneWayLeg) — l'utente ha scelto
// esplicitamente una tolleranza di qualche giorno, ma SEGNALATA onestamente (leg.approxDate,
// stesso trattamento già usato per i diretti senza match esatto), non un ritorno silenzioso
// alla vecchia politica "va bene indovinare" del 27/09/2026.
//
// HUB CURATI PER LO SCALO (02/10/2026, dopo che la tolleranza di data sopra NON ha risolto
// il "zero risultati" su Thailandia/USA): findConnectionHubs sceglieva come candidati SOLO
// le destinazioni dirette più economiche dall'origine — su aeroporti low-cost, quasi sempre
// destinazioni europee economiche senza nessuna coincidenza reale verso rotte intercontinentali.
// Vedi CURATED_LONG_HAUL_HUBS sotto: stessa idea già usata in search-direct/index.ts
// (COUNTRY_MAJOR_CITIES, hub verificati dal vivo il 27/09/2026) riapplicata qui per gli scali.
//
// BUG TROVATO IL 03/10/2026 (il fix "hub curati" sopra non bastava, letto il codice invece
// di ipotizzare ancora): CONNECTION_HUB_CANDIDATES era rimasto a 4, ma CURATED_LONG_HAUL_HUBS
// sotto ne ha 8 — `combined.slice(0, 4)` tagliava via metà della lista curata (AMS, CDG,
// LHR, HEL) e TUTTO il fallback "più economici da origine", a prescindere dal loro contenuto.
// Portato a 10 (tutti gli 8 curati + un minimo di backfill) — vedi CONNECTION_HUB_CANDIDATES.
//
// DIAGNOSTICA VISIBILE IN APP (03/10/2026, invece dei log di Supabase che l'utente ha
// esplicitamente preferito non controllare — "non ho voglia"): cheapestConnection e
// findConnectionHubs sotto restano strumentati con console.log (visibili solo da Supabase,
// tenuti per chi in futuro avrà accesso ai log), ma ORA il risultato della verifica scalo
// porta con sé anche un campo `scaloDebug` nella risposta JSON stessa — Results.jsx lo
// mostra direttamente in pagina quando la ricerca con scalo finisce vuota, cosi
// un semplice screenshot basta a far vedere cosa ha davvero trovato l'API, senza dashboard.
//
// RICERCA DIRETTA CON SCALO (03/10/2026, idea dell'utente dopo aver visto dal vivo i dati
// diagnostici sopra): il ritorno USA->hub non ha quasi mai dati in cache qualunque hub si
// provi (pool quasi sempre 0, su 3 ricerche reali testate) — limite della cache one-way
// asimmetrica di Travelpayouts (molte più ricerche reali "Italia->estero" che il contrario),
// non un bug risolvibile con più tentativi di hub. fetchDirectConnectionOption sotto prova
// anche una strada diversa: chiedere DIRETTAMENTE a Travelpayouts un itinerario con scalo
// già pronto sulla rotta intera (v3/prices_for_dates con allowConnections=true, ma con la
// stessa tolleranza di data del resto dello scalo, non illimitata) — una ricerca realistica
// che le persone fanno davvero, quindi più probabile avere dati. cheapestConnection tiene
// il più economico tra questa e la strada "via hub" di prima.
//
// RATE LIMIT SCAMBIATO PER "ZERO CACHE" (04/10/2026, testato dal vivo aprendo il sito con
// il browser invece di aspettare uno screenshot): su Thailandia, TUTTI gli 8 hub curati
// risultavano pool=0 sull'ANDATA, su TUTTE le finestre di data provate — implausibile sia
// davvero zero cache su rotte europee trafficate (Milano->Istanbul/Francoforte/Amsterdam
// ecc.). _shared/oneway.ts trattava QUALSIASI errore HTTP (incluso un 429) come pool vuoto,
// indistinguibile nel debug. Il motivo del burst: findConnectionHubs (10 hub) x 2 mesi x 2
// direzioni (andata/ritorno in Promise.all) + fetchDirectConnectionOption = fino a ~40
// richieste simultanee alla stessa API gratuita per UNA ricerca con scalo. Due fix: (1)
// oneway.ts ora registra lo status HTTP reale (drainApiFetchErrors, mostrato qui sotto in
// scaloDebug.apiErrors); (2) il loop sugli hub qui sotto non è più un Promise.all su tutti
// e 10 insieme, ma mapWithConcurrency con al massimo 3 richieste in volo — stesso principio
// già usato in Results.jsx per il fallback automatico (sequenziale, non tutto insieme).
//
// STESSO RISCHIO SUI DIRETTI (04/10/2026, domanda esplicita dell'utente "sui diretti
// invece nessuna novità?" — ha fatto notare che il fix sopra riguardava solo lo scalo):
// la verifica diretta normale (flight.checkOutboundStop/checkReturnStop entrambi assenti)
// NON passa da cheapestConnection, quindi non aveva lo stesso burst di 40 richieste — ma
// Results.jsx lancia comunque fino a 10 verifyPrice IN PARALLELO (uno per risultato),
// ognuna con 1-2+ chiamate oneway.ts qui sotto (outboundOptions + inboundOptionsPerPair),
// quindi un burst comparabile (~20-30 richieste insieme) era comunque possibile dal lato
// client. apiErrors (sotto) ora arriva SEMPRE nella risposta, non solo dentro scaloDebug,
// cosi un 429 sui diretti diventa visibile anche senza aver richiesto lo scalo — il fix di
// concorrenza lato client è in Results.jsx (mapWithConcurrency li', stesso principio).
import {
  TRAVELPAYOUTS_TOKEN,
  fetchLatestPrices,
  filterByFreshness,
  CHARTER_TRUSTED_CITIES,
} from "../_shared/travelpayouts.ts";
import { fetchOneWayPrices, drainApiFetchErrors } from "../_shared/oneway.ts";
import {
  cityOf,
  buildAirlineDeepLink,
  HOMEPAGE_FALLBACK,
  withAirlineDeepLink,
} from "../_shared/airlineLinks.ts";
import { corsHeaders } from "../_shared/cors.ts";
import airportCoords from "../_shared/airportCoords.json" with { type: "json" };

// Vedi nota "RATE LIMIT SCAMBIATO PER ZERO CACHE" in cima al file: esegue `fn` su tutti gli
// `items`, ma al massimo `limit` chiamate in volo contemporaneamente invece di un
// Promise.all su tutti insieme — riduce il burst di richieste verso Travelpayouts senza
// tornare a un loop puramente sequenziale (che sarebbe troppo lento con 10 hub).
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

function pickCheapestOnDate(options: any[], date: string) {
  const matches = options.filter((o) => o.date === date);
  return matches.sort((a, b) => a.price - b.price)[0] ?? null;
}

// Segnalato dall'utente: quando non c'è un match ESATTO per la data richiesta, il box
// Andata/Ritorno mostrava solo "Orari e compagnia disponibili al passo di prenotazione" —
// niente, anche se la stessa v3/prices_for_dates aveva risultati per un giorno vicino sulla
// stessa rotta. Qui si sceglie il più vicino (a parità di scarto, il più economico) SOLO per
// mostrarlo nel box informativo — mai per calcolare prezzo/conferma/link di prenotazione
// (quelli restano legati alla data esatta richiesta, altrimenti si prenoterebbe un giorno
// sbagliato senza saperlo). Il flag approxDate dice al client di segnalarlo onestamente.
function pickClosestDate(options: any[], date: string) {
  if (!options.length) return null;
  const target = new Date(date).getTime();
  const [best] = [...options].sort((a, b) => {
    const diffA = Math.abs(new Date(a.date).getTime() - target);
    const diffB = Math.abs(new Date(b.date).getTime() - target);
    return diffA - diffB || a.price - b.price;
  });
  return { ...best, approxDate: true };
}

// Variante di pickClosestDate usata SOLO da cheapestConnection sotto: qui la data È parte
// della decisione di prezzo/conferma (non solo del box informativo), quindi serve un limite
// esplicito a quanto ci si può allontanare dalla data richiesta (maxDiffDays) — altrimenti
// "il più vicino trovato" potrebbe benissimo essere un mese dopo, inaccettabile per uno
// scalo che l'utente si aspetta vicino alla data cercata. Tagga approxDate solo se la data
// trovata differisce davvero da quella richiesta (coerente con LegBox/LegRow).
function pickCheapestNearDate(options: any[], date: string, maxDiffDays: number) {
  const target = new Date(date).getTime();
  const DAY_MS = 86400000;
  const inRange = options.filter((o) => Math.abs(new Date(o.date).getTime() - target) <= maxDiffDays * DAY_MS);
  if (!inRange.length) return null;
  const [best] = inRange.sort((a, b) => {
    const diffA = Math.abs(new Date(a.date).getTime() - target);
    const diffB = Math.abs(new Date(b.date).getTime() - target);
    return a.price - b.price || diffA - diffB;
  });
  return { ...best, approxDate: best.date !== date };
}

function nextMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 1)); // m già 1-based = mese successivo
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Scoperto testando dal vivo (MXP->GOT settembre): certe rotte hanno cache one-way solo in
// UNA direzione/mese, non nell'altra — il fallback sul solo mese richiesto restava vuoto
// anche se la STESSA rotta aveva dati un mese dopo. Prova anche il mese successivo prima di
// arrendersi, sempre solo per il box informativo (vedi pickClosestDate).
//
// Usato ora SOLO quando questa chiamata arriva per un Preferito già salvato (FlightDetail.jsx)
// — per una ricerca nuova (Results.jsx) il risultato senza match esatto viene tolto dalla
// lista PRIMA di arrivare a mostrare questo fallback (vedi flightConfirmed sopra).
async function fetchBroaderOneWayLeg(
  origin: string,
  destination: string,
  date: string
): Promise<any | null> {
  const thisMonth = date.slice(0, 7);
  const options = await fetchOneWayPrices({ origin, destination, limit: 100, departureAt: thisMonth });
  if (options.length > 0) return pickClosestDate(options, date);

  const following = await fetchOneWayPrices({
    origin,
    destination,
    limit: 100,
    departureAt: nextMonth(thisMonth),
  });
  return pickClosestDate(following, date);
}

// RIPROVATO E TENUTO (27/09/2026), dopo due tentativi scartati (v1/prices/cheap con Wizz
// Air fantasma; voli con scalo v3 presentati come "✓ verificato", con easyJet/self-transfer
// CDG-ORY sbagliato): l'utente ha deciso esplicitamente di accettare il rischio pur di
// avere un nome di compagnia invece di niente, PURCHÉ sia chiaro che non è confermato.
// Ultimo fallback quando NEMMENO fetchBroaderOneWayLeg (diretti, 2 mesi) trova nulla:
// stessa v3/prices_for_dates ma con gli scali inclusi (allowConnections), marcati
// `unverified: true` da mapOneWayResult (il client — LegBox — li mostra con un avviso
// esplicito "non confermato", mai come un volo diretto o una connessione reale accertata.
// Mai un deepLink specifico per la rotta qui (withHomepageOnlyIfUnverified sotto): quello
// presume un'informazione che non abbiamo la certezza sia corretta.
//
// Stesso discorso di fetchBroaderOneWayLeg sopra: dal 02/10/2026 questo fallback non
// determina più se un risultato compare nei Risultati di una ricerca nuova.
async function fetchUnverifiedConnectingLeg(origin: string, destination: string, date: string): Promise<any | null> {
  const thisMonth = date.slice(0, 7);
  const [thisMonthOpts, nextMonthOpts] = await Promise.all([
    fetchOneWayPrices({ origin, destination, limit: 100, departureAt: thisMonth, allowConnections: true }),
    fetchOneWayPrices({ origin, destination, limit: 100, departureAt: nextMonth(thisMonth), allowConnections: true }),
  ]);
  const pool = [...thisMonthOpts, ...nextMonthOpts].filter((o: any) => (o.transfers ?? 0) > 0);
  if (!pool.length) return null;

  const target = new Date(date).getTime();
  const [best] = pool.sort((a: any, b: any) => {
    if (a.transfers !== b.transfers) return a.transfers - b.transfers;
    const diffA = Math.abs(new Date(a.date).getTime() - target);
    const diffB = Math.abs(new Date(b.date).getTime() - target);
    return diffA - diffB || a.price - b.price;
  });
  return { ...best, approxDate: true };
}

// Solo homepage generica, mai lo schema di prenotazione diretta per rotta (vedi commento
// su fetchUnverifiedConnectingLeg) — quello presume un volo diretto/confermato, qui non lo è.
function withHomepageOnlyIfUnverified<T extends { airline?: string | null; unverified?: boolean }>(leg: T): T & { deepLink: string | null } {
  if (!leg) return leg as T & { deepLink: string | null };
  if (!leg.unverified) return withAirlineDeepLink(leg as any) as T & { deepLink: string | null };
  const homepage = leg.airline ? HOMEPAGE_FALLBACK[leg.airline] : null;
  return { ...leg, deepLink: homepage ?? null };
}

// "Aeroporto di ritorno diverso dalla partenza" deve restare un'alternativa comoda, non
// un altro viaggio: 150km ≈ max 2 ore di auto/treno (Bergamo-Malpensa 77km entra,
// Milano/Bergamo-Bologna 180-240km resta fuori, coerente con l'esempio esplicito
// dell'utente). Un aeroporto senza coordinate note viene escluso per prudenza.
const MAX_RETURN_DISTANCE_KM = 150;
const COORDS: Record<string, [number, number]> = airportCoords as Record<string, [number, number]>;

function distanceKm(a: string, b: string): number | null {
  const c1 = COORDS[a];
  const c2 = COORDS[b];
  if (!c1 || !c2) return null;
  const R = 6371;
  const [lat1, lon1] = c1;
  const [lat2, lon2] = c2;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// "Ripartenza flessibile": nessuna lista fornita dall'utente per gli aeroporti vicino
// alla DESTINAZIONE (a differenza di Partenza, che l'utente cura a mano) — li si scopre
// scandendo tutte le coordinate note ed entro MAX_RETURN_DISTANCE_KM da `code`.
function nearbyAirports(code: string, maxKm: number): string[] {
  const origin = COORDS[code];
  if (!origin) return [code];
  const [lat1, lon1] = origin;
  const result = [code];
  for (const [airport, [lat2, lon2]] of Object.entries(COORDS)) {
    if (airport === code) continue;
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    if (2 * R * Math.asin(Math.sqrt(x)) <= maxKm) result.push(airport);
  }
  return result;
}

// "Con scalo" (flight.checkOutboundStop / flight.checkReturnStop): cerca un vero scalo
// (2 biglietti separati via un hub) per QUELLA tratta specifica, solo se batte il prezzo
// diretto — calcolato on-demand (chiamato dal client solo quando serve davvero, mai per
// tutti i risultati insieme: il costo in chiamate sarebbe eccessivo per una verifica
// automatica di massa — vedi il commento sul fallback automatico in Results.jsx, che
// proprio per questo si limita a poche proposte e le lancia in sequenza, non tutte insieme).
//
// Portato da 4 a 10 il 03/10/2026 (vedi nota "BUG TROVATO IL 03/10/2026" in cima al file):
// con 4 si tagliava via metà di CURATED_LONG_HAUL_HUBS (8 voci) e tutto il backfill.
const CONNECTION_HUB_CANDIDATES = 10;

// Quante richieste per gli hub in volo contemporaneamente (vedi nota "RATE LIMIT SCAMBIATO
// PER ZERO CACHE" in cima al file) — 3 invece di tutti e 10 insieme, per non sommarsi al
// resto del burst (ritorno in parallelo, ricerca diretta) e rischiare un 429 silenzioso.
const CONNECTION_HUB_CONCURRENCY = 3;

// Quanti giorni di distanza dalla data richiesta si accettano per la PRIMA tratta (hub di
// andata) — vedi nota "TOLLERANZA DI DATA SOLO PER LO SCALO" in cima al file. 3 giorni:
// abbastanza per intercettare la cache one-way sparsa delle rotte intercontinentali, senza
// scivolare su una data così lontana da non assomigliare più al viaggio richiesto.
const CONNECTION_DATE_TOLERANCE_DAYS = 3;
// Quanti giorni dopo l'arrivo della prima tratta si accetta la seconda (il volo verso la
// destinazione finale) — rappresenta la finestra di scalo realistica per un self-transfer
// (stesso giorno o il successivo è la norma, oltre i 2 giorni non è più "uno scalo" ma una
// sosta turistica non richiesta).
const CONNECTION_LAYOVER_MAX_DAYS = 2;

// Vedi nota "HUB CURATI PER LO SCALO" in cima al file: grandi hub con voli di linea reali
// verso praticamente ogni continente (Turkish/Emirates/Qatar sui rispettivi hub, principali
// scali europei con network intercontinentale) — provati PRIMA delle destinazioni "più
// economiche da casa" di findConnectionHubs, molto più probabili di avere davvero una
// coincidenza utilizzabile verso rotte lunghe. Se uno di questi non ha dati one-way in
// cache per l'origine specifica, il tentativo fallisce da sé (stesso comportamento di
// sempre) — nessun danno a tenerli comunque come primi candidati.
const CURATED_LONG_HAUL_HUBS = ["IST", "DXB", "DOH", "FRA", "AMS", "CDG", "LHR", "HEL"];

async function findConnectionHubs(origin: string, excludeDestination: string, count: number) {
  const options = await fetchOneWayPrices({ origin, limit: 200 });
  const cheapestByHub = new Map<string, number>();
  for (const o of options) {
    if (o.destination === excludeDestination) continue;
    const current = cheapestByHub.get(o.destination);
    if (current == null || o.price < current) cheapestByHub.set(o.destination, o.price);
  }
  const cheapFromOrigin = [...cheapestByHub.entries()].sort((a, b) => a[1] - b[1]).map(([hub]) => hub);
  const curated = CURATED_LONG_HAUL_HUBS.filter((h) => h !== excludeDestination);
  // Hub curati prima (più probabili di avere una vera coincidenza intercontinentale),
  // poi le destinazioni più economiche dall'origine non già incluse — utili quando l'utente
  // parte da un aeroporto vicino a un grande scalo europeo diverso da quelli curati, o per
  // scali intra-Europei dove "il più economico da casa" resta un'ipotesi ragionevole.
  const combined = [...curated, ...cheapFromOrigin.filter((h) => !curated.includes(h))];
  const picked = combined.slice(0, count);
  // LOG DIAGNOSTICO (anche in Supabase, vedi nota in cima al file).
  console.log(
    `[scalo] findConnectionHubs origin=${origin} escludi=${excludeDestination} totaleOpzioniOneWay=${options.length} candidatiScelti=${JSON.stringify(picked)} (curatiDisponibili=${JSON.stringify(curated)} economiciDaOrigine=${JSON.stringify(cheapFromOrigin.slice(0, 8))})`
  );
  return picked;
}

// Pool one-way su una rotta per un mese e il successivo (stesso pattern di
// fetchBroaderOneWayLeg) — serve qui per dare a pickCheapestNearDate margine entro cui
// scegliere, invece della sola (spesso vuota) data esatta richiesta.
async function fetchOneWayPool(origin: string, destination: string, monthAnchor: string) {
  const thisMonth = monthAnchor.slice(0, 7);
  const [thisMonthOpts, nextMonthOpts] = await Promise.all([
    fetchOneWayPrices({ origin, destination, limit: 50, departureAt: thisMonth }),
    fetchOneWayPrices({ origin, destination, limit: 50, departureAt: nextMonth(thisMonth) }),
  ]);
  return [...thisMonthOpts, ...nextMonthOpts];
}

// IDEA DELL'UTENTE (03/10/2026, dopo aver visto dal vivo che il ritorno USA->hub non ha
// quasi mai dati in cache, qualunque hub si provi — vedi la nota "RICERCA DIRETTA CON
// SCALO" in cima al file): invece di assemblare NOI uno scalo con due biglietti separati
// via un hub scelto da noi (self-transfer, origine->hub e hub->destinazione come due
// ricerche one-way indipendenti), chiediamo DIRETTAMENTE a Travelpayouts un itinerario con
// scalo già pronto sulla rotta intera richiesta (v3/prices_for_dates con
// allowConnections=true, stessa chiamata di fetchUnverifiedConnectingLeg ma QUI con la
// stessa tolleranza di data del resto dello scalo — non "qualunque data pur di trovare
// qualcosa", quella resta un fallback separato e marcatamente non verificato). Molto più
// probabile avere dati in cache: questa è una ricerca realistica che le persone fanno
// davvero (es. "New York - Milano"), non una coppia origine-hub inventata da noi che magari
// nessuno ha mai cercato. Il risultato è UN SOLO biglietto/itinerario (non due tratte
// separate nostre), con compagnia/orario reali dalla stessa API delle altre tratte
// confermate — stesso livello di fiducia, non "da verificare al link" come invece resta
// fetchUnverifiedConnectingLeg (quella senza alcun limite di data).
async function fetchDirectConnectionOption(origin: string, destination: string, date: string) {
  const thisMonth = date.slice(0, 7);
  const [thisMonthOpts, nextMonthOpts] = await Promise.all([
    fetchOneWayPrices({ origin, destination, limit: 50, departureAt: thisMonth, allowConnections: true }),
    fetchOneWayPrices({ origin, destination, limit: 50, departureAt: nextMonth(thisMonth), allowConnections: true }),
  ]);
  // Solo itinerari CON scalo (transfers>0, altrimenti è un diretto già coperto altrove) ed
  // entro un numero di cambi ragionevole (oltre 2 non è più un'alternativa comoda).
  const pool = [...thisMonthOpts, ...nextMonthOpts].filter(
    (o: any) => (o.transfers ?? 0) > 0 && (o.transfers ?? 0) <= 2
  );
  const picked = pickCheapestNearDate(pool, date, CONNECTION_DATE_TOLERANCE_DAYS);
  console.log(
    `[scalo] fetchDirectConnectionOption ${origin}->${destination} data=${date}: pool=${pool.length} trovato=${picked ? `${picked.date}@${picked.price}eur transfers=${picked.transfers}${picked.approxDate ? " (approx)" : ""}` : "NESSUNO"}`
  );
  return { poolSize: pool.length, picked };
}

// Riporta, per ogni hub tentato, cosa ha trovato (o non trovato) — prima solo nei
// console.log (visibili solo da Supabase), ora anche restituito come `debug` così la
// risposta finale di Deno.serve può passarlo al client (vedi `scaloDebug` sotto e
// Results.jsx) senza che l'utente debba aprire una dashboard.
async function cheapestConnection(origin: string, destination: string, date: string) {
  const hubs = await findConnectionHubs(origin, destination, CONNECTION_HUB_CANDIDATES);
  // Vedi nota "RATE LIMIT SCAMBIATO PER ZERO CACHE" in cima al file: non più un Promise.all
  // su tutti i 10 hub insieme (20 richieste in un colpo solo), ma al massimo
  // CONNECTION_HUB_CONCURRENCY in volo — stesso risultato finale, meno rischio di 429.
  const attempts = await mapWithConcurrency(hubs, CONNECTION_HUB_CONCURRENCY, async (hub) => {
      // Prima tratta: tolleranza di qualche giorno sulla data richiesta (vedi
      // CONNECTION_DATE_TOLERANCE_DAYS) — su rotte intercontinentali la cache one-way è
      // troppo sparsa per pretendere l'esattezza che basta invece sulle rotte dirette.
      const leg1Pool = await fetchOneWayPool(origin, hub, date);
      const leg1 = pickCheapestNearDate(leg1Pool, date, CONNECTION_DATE_TOLERANCE_DAYS);
      console.log(
        `[scalo] leg1 ${origin}->${hub} data=${date}: pool=${leg1Pool.length} trovato=${leg1 ? `${leg1.date}@${leg1.price}eur${leg1.approxDate ? " (approx)" : ""}` : "NESSUNO"}`
      );
      if (!leg1) {
        return {
          hub,
          leg1PoolSize: leg1Pool.length,
          leg1: null,
          leg2PoolSize: 0,
          leg2CandidatesInWindow: 0,
          leg2: null,
          outcome: "leg1 non trovato (nessuna tratta in cache entro la tolleranza di data)",
          result: null as { legs: any[]; total: number } | null,
        };
      }
      // Seconda tratta: cercata attorno alla data EFFETTIVA della prima (non più quella
      // originale, che potrebbe già essere slittata) — e filtrata per partire dopo il suo
      // arrivo, entro una finestra di scalo realistica (CONNECTION_LAYOVER_MAX_DAYS),
      // altrimenti l'itinerario non rappresenterebbe più uno scalo dello stesso viaggio.
      const leg2Pool = await fetchOneWayPool(hub, destination, leg1.date);
      const leg2Candidates = leg2Pool.filter((o: any) => {
        const diffDays = (new Date(o.date).getTime() - new Date(leg1.date).getTime()) / 86400000;
        return diffDays >= 0 && diffDays <= CONNECTION_LAYOVER_MAX_DAYS;
      });
      const leg2 = leg2Candidates.sort(
        (a: any, b: any) => a.price - b.price || new Date(a.date).getTime() - new Date(b.date).getTime()
      )[0];
      console.log(
        `[scalo] leg2 ${hub}->${destination} dopo leg1=${leg1.date}: pool=${leg2Pool.length} candidatiEntroFinestra=${leg2Candidates.length} trovato=${leg2 ? `${leg2.date}@${leg2.price}eur` : "NESSUNO"}`
      );
      if (!leg2) {
        return {
          hub,
          leg1PoolSize: leg1Pool.length,
          leg1: `${leg1.date}@${leg1.price}`,
          leg2PoolSize: leg2Pool.length,
          leg2CandidatesInWindow: leg2Candidates.length,
          leg2: null,
          outcome: "leg2 non trovato entro la finestra di scalo",
          result: null as { legs: any[]; total: number } | null,
        };
      }
      // Stesso avviso onesto già usato per i diretti senza match esatto (LegBox) — qui
      // segnala che l'intero scalo è slittato di qualche giorno dalla data richiesta.
      const shifted = Boolean(leg1.approxDate);
      return {
        hub,
        leg1PoolSize: leg1Pool.length,
        leg1: `${leg1.date}@${leg1.price}`,
        leg2PoolSize: leg2Pool.length,
        leg2CandidatesInWindow: leg2Candidates.length,
        leg2: `${leg2.date}@${leg2.price}`,
        outcome: "ok",
        result: { legs: [leg1, { ...leg2, approxDate: shifted }], total: leg1.price + leg2.price },
      };
  });
  const valid = attempts.filter((a) => a.result !== null);
  const bestViaHub = valid.sort((a, b) => (a.result!.total - b.result!.total))[0] ?? null;
  console.log(
    `[scalo] cheapestConnection (via hub) ${origin}->${destination} (${date}): tentativiValidi=${valid.length}/${hubs.length} risultato=${bestViaHub ? `${bestViaHub.result!.total}eur via ${bestViaHub.hub}` : "NESSUNO"}`
  );

  // Seconda strategia (vedi nota sopra fetchDirectConnectionOption): un itinerario con
  // scalo già pronto, trovato direttamente da Travelpayouts sulla rotta intera, invece che
  // assemblato da noi via un hub scelto a mano. Tenuto il più economico tra le due.
  const direct = await fetchDirectConnectionOption(origin, destination, date);
  const directResult = direct.picked ? { legs: [direct.picked], total: direct.picked.price } : null;

  const best =
    bestViaHub?.result && directResult
      ? bestViaHub.result.total <= directResult.total
        ? bestViaHub.result
        : directResult
      : bestViaHub?.result ?? directResult ?? null;
  console.log(
    `[scalo] cheapestConnection TOTALE ${origin}->${destination} (${date}): viaHub=${bestViaHub?.result ? `${bestViaHub.result.total}eur` : "NESSUNO"} ricercaDiretta=${directResult ? `${directResult.total}eur` : "NESSUNO"} scelto=${best ? `${best.total}eur` : "NESSUNO"}`
  );

  // debug: un riepilogo per ogni hub tentato, senza i campi `result` interni (ridondanti
  // con leg1/leg2 già testuali) — pensato per essere leggibile su schermo, non solo in log.
  // In coda, anche il tentativo di ricerca diretta (non è un hub, ma stesso formato per
  // restare leggibile nello stesso elenco in Results.jsx).
  const debug = [
    ...attempts.map(({ hub, leg1PoolSize, leg1, leg2PoolSize, leg2CandidatesInWindow, leg2, outcome }) => ({
      hub,
      leg1PoolSize,
      leg1,
      leg2PoolSize,
      leg2CandidatesInWindow,
      leg2,
      outcome,
    })),
    {
      hub: "ricerca diretta con scalo (Aviasales)",
      leg1PoolSize: direct.poolSize,
      leg1: direct.picked ? `${direct.picked.date}@${direct.picked.price} (${direct.picked.transfers} cambi)` : null,
      leg2PoolSize: 0,
      leg2CandidatesInWindow: 0,
      leg2: null,
      outcome: direct.picked ? "ok" : "nessun itinerario con scalo in cache entro la tolleranza di data",
    },
  ];
  return {
    legs: best?.legs ?? [],
    total: best?.total ?? null,
    debug,
  };
}

// Schemi diretti compagnia, homepage e withAirlineDeepLink ora in _shared/airlineLinks.ts
// (condivisi con search-stopover, che aveva lo stesso identico bisogno per i "percorsi
// creativi" ed era rimasto scoperto — vedi lì per i dettagli di ogni verifica dal vivo).
async function buildSingleTicketDeepLink(flight: any, outboundLeg: any, inboundLeg: any) {
  // Aeroporti FISICI reali (es. CRL, non il codice città BRU) e compagnia dal volo one-way
  // già trovato sopra — è esattamente il dato che serve al link diretto della compagnia,
  // niente chiamata aggiuntiva.
  const airlineLink = buildAirlineDeepLink(
    outboundLeg?.airline,
    outboundLeg?.originAirport ?? flight.origin,
    outboundLeg?.destinationAirport ?? flight.destination,
    flight.departDate,
    flight.returnDate
  );
  if (airlineLink) return airlineLink;

  // La homepage serve solo a indicare "prenota qui", non un link di ricerca — va bene
  // anche se conosciamo la compagnia solo dal ritorno (es. andata senza match in cache ma
  // ritorno trovato): segnalato dall'utente proprio su un caso così (Milano-Salonicco,
  // andata non confermata, ritorno easyJet).
  //
  // Bug trovato leggendo il codice (non serve verifica dal vivo, è solo logica JS): usare
  // "??" tra i due codici compagnia sbaglia quando l'andata HA un codice ma è una
  // compagnia sconosciuta (es. "EC") — "??" scatta solo su null/undefined, quindi con un
  // codice valorizzato ma ignoto restava per sempre "EC" e non si provava mai il ritorno,
  // anche se quello era una compagnia nota con homepage (es. easyJet). Va cercata la
  // homepage per ENTRAMBI i codici, non scelto un codice solo e poi cercata la sua homepage.
  const homepage = HOMEPAGE_FALLBACK[outboundLeg?.airline] ?? HOMEPAGE_FALLBACK[inboundLeg?.airline] ?? null;
  if (homepage) return homepage;

  // Niente più fallback finale (né Aviasales né Google Flights, rifiutato esplicitamente
  // dall'utente — "mi da lo stesso nervoso"): deepLink resta null, il client mostra
  // compagnia/data/orario (già noti dai box Andata/Ritorno) e rimanda l'utente a
  // prenotare da sé sul sito della compagnia invece di un link verso un comparatore terzo.
  return null;
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
    const flight = await req.json();
    // Aeroporti di partenza dell'utente per il ritorno flessibile — se assente/vuoto il
    // comportamento resta identico a prima (ritorno forzato sullo stesso flight.origin).
    // Filtrati per distanza da flight.origin: anche se l'utente ha messo in Partenza
    // aeroporti lontani tra loro per altri motivi, qui contano solo quelli comodi da
    // raggiungere al ritorno (max ~2 ore), altrimenti non è più "lo stesso viaggio".
    const candidateAirports: string[] = Array.isArray(flight.homeAirports) && flight.homeAirports.length > 0
      ? [...new Set(flight.homeAirports)]
      : [flight.origin];
    const homeAirports = candidateAirports.filter((airport) => {
      if (airport === flight.origin) return true;
      const km = distanceKm(flight.origin, airport);
      return km != null && km <= MAX_RETURN_DISTANCE_KM;
    });
    // "Ripartenza flessibile" (flight.flexReturnOrigin): il ritorno può PARTIRE da un
    // aeroporto vicino alla destinazione invece che da quello usato all'andata — distinta
    // da "Aeroporto di ritorno diverso dalla partenza" (che varia l'arrivo lato casa),
    // le due si possono anche combinare (incrocio di entrambi i lati).
    const returnOrigins = flight.flexReturnOrigin
      ? nearbyAirports(flight.destination, MAX_RETURN_DISTANCE_KM)
      : [flight.destination];

    const [latestPrices, outboundOptions, inboundOptionsPerPair] = await Promise.all([
      // Segnalato dall'utente ("solo due voli del cazzo... senza dettagli"): senza limit
      // esplicito qui restava il default (30) di fetchLatestPrices — v2/prices/latest ha
      // MOLTE varianti di sola data di ritorno per la stessa andata (vedi dedup in
      // search-direct), quindi i 30 più economici in assoluto per la rotta spesso NON
      // includevano la combinazione esatta (andata+ritorno) appena mostrata in lista,
      // pur essendo un risultato reale e recente — "confermato" falliva anche su risultati
      // corretti. Stesso limite ampio già usato in search-direct.
      fetchLatestPrices({ origin: flight.origin, destination: flight.destination, dateFrom: flight.departDate, limit: 1000 }),
      fetchOneWayPrices({
        origin: flight.origin,
        destination: flight.destination,
        limit: 100,
        departureAt: flight.departDate,
      }),
      Promise.all(
        returnOrigins.flatMap((returnOrigin) =>
          homeAirports.map((airport) =>
            fetchOneWayPrices({
              origin: returnOrigin,
              destination: airport,
              limit: 100,
              departureAt: flight.returnDate,
            })
          )
        )
      ),
    ]);

    // Filtro di freschezza (found_at) solo sul v2 aggregato: è l'unico dei due che può
    // restare in cache per giorni/settimane (v2/prices/latest). v3/prices_for_dates (le
    // tratte one-way qui sotto) non espone found_at nella risposta perché per definizione
    // Travelpayouts lo popola solo con prezzi trovati nelle ultime 48 ore — filtrarlo per
    // freschezza con un campo che non esiste azzerava SEMPRE i risultati (bug scoperto
    // durante l'esperimento round-trip: 0 match su 6 rotte reali testate dal vivo).
    // Stesso filtro di search-direct (segnalato dall'utente: "non ho attivato il bottone
    // con scalo, perché propone rotte con scalo?") — senza flight.allowStops (passato dal
    // client solo se il toggle "Con scalo" è attivo) non va confermato un prezzo che in
    // realtà è per un itinerario con scalo (number_of_changes>0).
    const match = filterByFreshness(latestPrices).find(
      (r: any) =>
        r.departDate === flight.departDate &&
        r.returnDate === flight.returnDate &&
        (flight.allowStops || r.numberOfChanges === 0 || CHARTER_TRUSTED_CITIES.has(r.destination))
    );
    const outboundLeg = pickCheapestOnDate(outboundOptions, flight.departDate);
    const inboundLeg = pickCheapestOnDate(inboundOptionsPerPair.flat(), flight.returnDate);
    // true solo se la flessibilità ha davvero trovato conveniente un aeroporto diverso
    // (partenza del ritorno vicino alla destinazione, o arrivo vicino a casa) — round-trip
    // combinato non ha più senso in quel caso.
    const returnsElsewhere = Boolean(
      inboundLeg &&
        (cityOf(inboundLeg.originAirport) !== cityOf(flight.destination) ||
          inboundLeg.destinationAirport !== flight.origin)
    );

    console.log(
      `[scalo] flight ${flight.origin}->${flight.destination} (${flight.departDate}/${flight.returnDate}) checkOutboundStop=${Boolean(flight.checkOutboundStop)} checkReturnStop=${Boolean(flight.checkReturnStop)} outboundLegDiretto=${outboundLeg ? "trovato" : "NESSUNO"} inboundLegDiretto=${inboundLeg ? "trovato" : "NESSUNO"}`
    );

    // "Con scalo", solo su richiesta esplicita (vedi sopra) — confrontato col diretto già
    // trovato, tenuto solo se davvero più economico.
    const [outboundConnection, returnConnection] = await Promise.all([
      flight.checkOutboundStop
        ? cheapestConnection(flight.origin, flight.destination, flight.departDate)
        : null,
      flight.checkReturnStop ? cheapestConnection(flight.destination, flight.origin, flight.returnDate) : null,
    ]);
    // Bug corretto il 03/10/2026: cheapestConnection ora restituisce SEMPRE un oggetto
    // (mai più null), con total=null e legs=[] quando nessun hub ha prodotto un itinerario
    // valido — serve controllare legs.length, non più solo la presenza dell'oggetto
    // (altrimenti "total: null < prezzo diretto" sarebbe stato true per coercizione a 0).
    const outboundLegs =
      outboundConnection && outboundConnection.legs.length > 0 && (!outboundLeg || outboundConnection.total! < outboundLeg.price)
        ? outboundConnection.legs
        : outboundLeg
        ? [outboundLeg]
        : [];
    const inboundLegs =
      returnConnection && returnConnection.legs.length > 0 && (!inboundLeg || returnConnection.total! < inboundLeg.price)
        ? returnConnection.legs
        : inboundLeg
        ? [inboundLeg]
        : [];
    // Oltre al caso "due biglietti separati" (più tratte), ora uno scalo può arrivare anche
    // come UNA sola tratta con un cambio incluso (vedi fetchDirectConnectionOption: un
    // itinerario con scalo trovato già pronto da Travelpayouts, un solo biglietto) — va
    // comunque segnalato come "con scalo", non mostrato come se fosse un volo diretto.
    const hasStop =
      outboundLegs.length > 1 ||
      inboundLegs.length > 1 ||
      outboundLegs.some((l: any) => (l?.transfers ?? 0) > 0) ||
      inboundLegs.some((l: any) => (l?.transfers ?? 0) > 0);
    // Biglietti separati (returnsElsewhere/hasStop): ogni tratta ha il proprio bottone
    // "Prenota andata/ritorno" legato al SUO leg.deepLink — va sostituito qui, non solo nel
    // link "biglietto unico" sopra, altrimenti resta sempre quello Aviasales per questi casi.
    const outboundLegsWithLinks = outboundLegs.map(withAirlineDeepLink);
    const inboundLegsWithLinks = inboundLegs.map(withAirlineDeepLink);

    // Se abbiamo tutte le tratte one-way (quelle di cui mostriamo orario/compagnia nei box
    // Andata/Ritorno), il prezzo deve essere la LORO somma — non l'aggregato v2, che può
    // riferirsi a una combinazione voli diversa da quella effettivamente mostrata in pagina
    // (fonti scorrelate: prima si vedevano orari di un volo e il prezzo di un altro). Il v2
    // aggregato resta solo un fallback quando mancano entrambe le tratte one-way.
    //
    // Bug trovato dall'utente (Milano-Amburgo, 17€ "✓ verificato" ma in realtà cifra
    // dell'andata da sola): se l'andata aveva un match esatto ma il RITORNO no,
    // allLegs.length>0 restava vero (bastava una tratta sola) e il prezzo sommava/mostrava
    // solo quella metà — spacciata per prezzo A/R confermato. Serve un match esatto su
    // ENTRAMBE le direzioni prima di fidarsi della somma; altrimenti si ricade sull'aggregato
    // v2 (o sul prezzo originale non confermato), mai su un totale parziale.
    //
    // bothDirectionsMatched è anche il segnale di "volo reale conosciuto" esposto come
    // flightConfirmed sotto (vedi commento in cima al file, decisione 02/10/2026) — un
    // match v2 (match?.price, solo prezzo) NON basta più a considerare il volo "noto".
    const bothDirectionsMatched = outboundLegs.length > 0 && inboundLegs.length > 0;
    const allLegs = [...outboundLegs, ...inboundLegs];
    const price = bothDirectionsMatched ? allLegs.reduce((sum, l) => sum + l.price, 0) : match?.price ?? flight.price;
    // Un unico deep link round-trip ha senso solo per il caso semplice (1 tratta per
    // direzione, stessi aeroporti di andata/ritorno) — con uno scalo o un aeroporto
    // diverso sono biglietti separati, ognuno col proprio deepLink già su ogni leg.
    const singleTicket = !returnsElsewhere && !hasStop;
    // Onesto: "confermato" solo se il prezzo mostrato viene DAVVERO da cache abbastanza
    // fresca (somma tratte one-way o match v2 filtrati per età sopra) — se entrambi mancano
    // il prezzo è rimasto quello originale non ri-controllato (flight.price), il client non
    // deve mostrare "✓ verificato" in quel caso (era fuorviante prima di questo campo).
    const confirmed = bothDirectionsMatched || Boolean(match);
    const deepLink = singleTicket ? await buildSingleTicketDeepLink(flight, outboundLeg, inboundLeg) : null;

    // Solo per il box informativo (mai per prezzo/conferma/link, calcolati sopra e già
    // finiti): se manca un match esatto, si mostra il volo reale più vicino trovato in cache
    // invece del placeholder "disponibile al passo di prenotazione". outboundOptions/
    // inboundOptionsPerPair sopra sono già filtrati dalla API sulla data ESATTA — se quel
    // giorno preciso non ha nulla in cache l'array arriva vuoto, senza alternative "vicine"
    // tra cui scegliere. fetchBroaderOneWayLeg riprova sul mese e, se ancora vuoto, sul mese
    // successivo (scoperto dal vivo: alcune rotte hanno cache solo in una direzione/mese) —
    // SOLO come fallback quando serve davvero, mai sui risultati che hanno già un match.
    // withAirlineDeepLink applicato anche qui (non solo alle tratte con match esatto sopra):
    // senza, una tratta mostrata solo per approssimazione (approxDate) restava con il
    // deepLink Aviasales originale di oneway.ts anche per compagnie che sappiamo gestire
    // direttamente — segnalato dall'utente, incoerente col resto.
    //
    // Questo fallback resta per i Preferiti già salvati (FlightDetail.jsx) — per i
    // Risultati di una nuova ricerca, da 02/10/2026 non decide più se il risultato compare
    // (vedi flightConfirmed/bothDirectionsMatched sopra): Results.jsx nasconde il risultato
    // a prescindere da cosa arriva qui, quando bothDirectionsMatched è false.
    const outboundLegsForDisplay =
      outboundLegsWithLinks.length > 0
        ? outboundLegsWithLinks
        : await (async () => {
            const p = await fetchBroaderOneWayLeg(flight.origin, flight.destination, flight.departDate);
            if (p) return [withAirlineDeepLink(p)];
            const u = await fetchUnverifiedConnectingLeg(flight.origin, flight.destination, flight.departDate);
            return u ? [withHomepageOnlyIfUnverified(u)] : [];
          })();
    const inboundLegsForDisplay =
      inboundLegsWithLinks.length > 0
        ? inboundLegsWithLinks
        : await (async () => {
            const broaderPerPair = await Promise.all(
              returnOrigins.flatMap((returnOrigin) =>
                homeAirports.map((airport) => fetchBroaderOneWayLeg(returnOrigin, airport, flight.returnDate))
              )
            );
            const candidates = broaderPerPair.filter((p): p is any => p !== null);
            const p = pickClosestDate(candidates, flight.returnDate);
            if (p) return [withAirlineDeepLink(p)];
            const unverifiedPerPair = await Promise.all(
              returnOrigins.flatMap((returnOrigin) =>
                homeAirports.map((airport) => fetchUnverifiedConnectingLeg(returnOrigin, airport, flight.returnDate))
              )
            );
            const unverifiedCandidates = unverifiedPerPair.filter((p): p is any => p !== null);
            const u = unverifiedCandidates.sort((a, b) => a.transfers - b.transfers || a.price - b.price)[0] ?? null;
            return u ? [withHomepageOnlyIfUnverified(u)] : [];
          })();

    // Bug notato dall'utente ("ogni volta che clicco non succede niente"): quando manca
    // un match ESATTO sulla data (approxDate), buildSingleTicketDeepLink sopra non trova
    // né andata né ritorno con cui costruire il link combinato e resta null — anche se le
    // tratte MOSTRATE in pagina (outboundLegsForDisplay/inboundLegsForDisplay, con
    // withAirlineDeepLink già applicato) hanno benissimo il loro deepLink diretto/homepage.
    // Meglio riusare quello (anche se copre solo una tratta) che lasciare il bottone senza
    // niente quando qualcosa di cliccabile esiste già in pagina.
    const finalDeepLink = singleTicket
      ? deepLink ?? outboundLegsForDisplay[0]?.deepLink ?? inboundLegsForDisplay[0]?.deepLink ?? null
      : null;

    // Vedi nota "RATE LIMIT SCAMBIATO PER ZERO CACHE" in cima al file: drenato qui, a fine
    // richiesta, cosi raccoglie TUTTI gli errori HTTP accumulati durante questa singola
    // chiamata (ricerca diretta + entrambe le direzioni dello scalo), senza bisogno dei log
    // Supabase — se scaloDebug arriva vuoto ma apiErrors ha voci con status 429, è la prova
    // che il problema è il rate limit del burst, non la cache.
    const apiErrors = drainApiFetchErrors();

    return new Response(
      JSON.stringify({
        price,
        confirmed,
        // Volo reale conosciuto (compagnia/orario su ENTRAMBE le tratte) — vedi commento in
        // cima al file (decisione 02/10/2026, con la tolleranza di data dello scalo). Results.jsx
        // usa questo, non `confirmed`, per decidere se mostrare il risultato in lista.
        flightConfirmed: bothDirectionsMatched,
        deepLink: finalDeepLink,
        outboundLeg: outboundLegsForDisplay[0] ?? null,
        inboundLeg: inboundLegsForDisplay[0] ?? null,
        outboundLegs: outboundLegsForDisplay,
        inboundLegs: inboundLegsForDisplay,
        returnsElsewhere,
        hasStop,
        // Dalla cache v2 (match), se c'è — vedi commento su numberOfChanges in
        // _shared/travelpayouts.ts. Serve al client per non far sembrare un buco nei
        // dati quando in realtà quella rotta un volo diretto non lo ha proprio.
        numberOfChanges: match?.numberOfChanges ?? null,
        // apiErrors ora SEMPRE in cima alla risposta (04/10/2026, non solo dentro
        // scaloDebug) — lo stesso rischio di burst esiste anche sulla verifica DIRETTA
        // (Results.jsx lancia più verifyPrice in parallelo, ognuna con 1-2+ chiamate
        // oneway.ts): senza questo campo qui fuori, un eventuale 429 sui diretti restava
        // invisibile perché scaloDebug è null quando lo scalo non è stato richiesto.
        apiErrors: apiErrors.length > 0 ? apiErrors : null,
        // Diagnostica visibile in pagina (03/10/2026, vedi nota in cima al file) — presente
        // solo quando è stata davvero richiesta una verifica con scalo, null altrimenti.
        // Results.jsx la mostra solo quando il fallback con scalo finisce senza nessun
        // risultato confermato, per capire cosa ha trovato l'API senza Supabase.
        // apiErrors (04/10/2026): status HTTP veri delle chiamate fallite durante questa
        // richiesta (es. 429 rate-limit) — distingue "errore di rete" da "zero cache".
        scaloDebug:
          flight.checkOutboundStop || flight.checkReturnStop
            ? {
                outbound: outboundConnection?.debug ?? null,
                return: returnConnection?.debug ?? null,
                apiErrors: apiErrors.length > 0 ? apiErrors : null,
              }
            : null,
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
