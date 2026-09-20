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
import { TRAVELPAYOUTS_TOKEN, fetchLatestPrices, filterByFreshness } from "../_shared/travelpayouts.ts";
import { fetchOneWayPrices, fetchRoundTripOffers } from "../_shared/oneway.ts";
import { corsHeaders } from "../_shared/cors.ts";
import airportCoords from "../_shared/airportCoords.json" with { type: "json" };
import airportCityMap from "../_shared/airportCityMap.json" with { type: "json" };
import voloteaSlugs from "../_shared/voloteaSlugs.json" with { type: "json" };

// flight.destination può essere un codice CITTÀ Travelpayouts che aggrega più aeroporti
// fisici (es. BRU = Bruxelles aggrega anche CRL/Charleroi) — interrogando quella città
// come "origin" del volo di ritorno, l'API può restituire legittimamente un volo che
// atterra/parte da CRL invece che da BRU: stesso viaggio, non una vera "ripartenza da un
// aeroporto diverso" scoperta dalla flessibilità. Confronto per città, non per aeroporto
// esatto, solo sul lato destinazione (l'unico che può essere un codice città aggregato —
// flight.origin è sempre un aeroporto specifico scelto dall'utente in Partenza).
const CITY_BY_AIRPORT: Record<string, string> = airportCityMap as Record<string, string>;
function cityOf(code: string): string {
  return CITY_BY_AIRPORT[code] ?? code;
}

function pickCheapestOnDate(options: any[], date: string) {
  const matches = options.filter((o) => o.date === date);
  return matches.sort((a, b) => a.price - b.price)[0] ?? null;
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

// "Andata/Ritorno con scalo" (flight.checkOutboundStop / flight.checkReturnStop): cerca
// un vero scalo (2 biglietti separati via un hub) per QUELLA tratta specifica, solo se
// batte il prezzo diretto — calcolato on-demand (chiamato solo quando l'utente espande
// un risultato con il relativo interruttore attivo, mai per i 10 risultati insieme:
// il costo in chiamate sarebbe eccessivo per una verifica automatica di massa).
const CONNECTION_HUB_CANDIDATES = 5;

async function findConnectionHubs(origin: string, excludeDestination: string, count: number) {
  const options = await fetchOneWayPrices({ origin, limit: 200 });
  const cheapestByHub = new Map<string, number>();
  for (const o of options) {
    if (o.destination === excludeDestination) continue;
    const current = cheapestByHub.get(o.destination);
    if (current == null || o.price < current) cheapestByHub.set(o.destination, o.price);
  }
  return [...cheapestByHub.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, count)
    .map(([hub]) => hub);
}

async function cheapestConnection(origin: string, destination: string, date: string) {
  const hubs = await findConnectionHubs(origin, destination, CONNECTION_HUB_CANDIDATES);
  const attempts = await Promise.all(
    hubs.map(async (hub) => {
      const [leg1Options, leg2Options] = await Promise.all([
        fetchOneWayPrices({ origin, destination: hub, limit: 50, departureAt: date }),
        fetchOneWayPrices({ origin: hub, destination, limit: 50, departureAt: date }),
      ]);
      const leg1 = pickCheapestOnDate(leg1Options, date);
      if (!leg1) return null;
      // Vincolo di sequenza: la seconda tratta deve partire dopo l'arrivo della prima,
      // altrimenti l'itinerario è fisicamente impossibile da seguire.
      const leg2 = leg2Options.filter((o: any) => o.date >= leg1.date).sort((a: any, b: any) => a.price - b.price)[0];
      if (!leg2) return null;
      return { legs: [leg1, leg2], total: leg1.price + leg2.price };
    })
  );
  const valid = attempts.filter((a): a is { legs: any[]; total: number } => a !== null);
  return valid.sort((a, b) => a.total - b.total)[0] ?? null;
}

const MARKER = Deno.env.get("TRAVELPAYOUTS_MARKER") ?? "";

function buildDeepLink(flight: any) {
  const fmt = (d: string) => {
    const date = new Date(d);
    return `${String(date.getDate()).padStart(2, "0")}${String(date.getMonth() + 1).padStart(2, "0")}`;
  };
  const origin = flight.origin ?? "";
  const destination = flight.destination ?? "";
  if (!origin || !destination || !flight.departDate || !flight.returnDate) return null;
  const path = `${origin}${fmt(flight.departDate)}${destination}${fmt(flight.returnDate)}1`;
  return `https://www.aviasales.com/search/${path}?marker=${MARKER}`;
}

// ESPERIMENTO (esito incerto, richiesto esplicitamente dall'utente dopo aver verificato
// che nessun link Travelpayouts salta la pagina di confronto Aviasales): il link "ricco"
// di v3 one_way=false porta una firma del volo (t=) ed expected_price_uuid/currency che
// la documentazione descrive come pensati per evidenziare quella specifica offerta — MAI
// verificato se Aviasales lo usa davvero. Se non troviamo un match esatto per quelle date
// si ricade sul link generico di sempre (comportamento identico a prima, nessun regresso).
function buildRichDeepLink(link: string | null) {
  if (!link) return null;
  const sep = link.includes("?") ? "&" : "?";
  return `https://www.aviasales.com${link}${sep}marker=${MARKER}`;
}

// Link diretti al sito/app della compagnia aerea (non più Aviasales). Verificati dal vivo:
// - Ryanair (FR), Wizz Air (W6): dedotti il 19/09/2026 osservando manualmente una ricerca
//   A/R sul sito reale (non sono API ufficiali, possono rompersi se la compagnia cambia sito).
// - Vueling (VY): AGGIORNATO il 20/09/2026 — ieri avevo escluso Vueling osservando solo il
//   widget del sito (che tiene lo stato in sessione, URL finale senza parametri). Oggi trovata
//   una pagina DEVELOPER pubblica (vueling.com/developer/flightcalendar/flightcalendar-deeplink)
//   con uno schema di deep link ufficiale e documentato, separato dal widget: interrogato dal
//   vivo (tickets.vueling.com/booking?o=...&d=...&dd=...&rd=...) e apre davvero andata+ritorno
//   precompilati. Non è un Universal Link verso l'app (il suo apple-app-site-association non
//   lo elenca tra i path associati), ma è un link sito funzionante — molto meglio del fallback.
// easyJet (U2): confermata l'esclusione di ieri con più tentativi (anche i nomi di campo del
// suo stesso stato interno "Origin/Destination/Outbound/Return" come query param) — stesso
// errore generico identico, nessuno schema pubblico trovato. Resta fallback Aviasales.
// Volotea (V7): il suo apple-app-site-association ELENCA "/it/offerte-voli/*" come Universal
// Link verso l'app — un vero deep link nativo esiste. Non implementato: l'URL usa slug
// italiani di città (es. "verona", "barcellona"), non codici IATA, e non abbiamo una mappa
// verificata aeroporto→slug — costruirla a intuito per ogni destinazione rischierebbe link
// rotti silenziosi. Resta fallback Aviasales finché non c'è quella mappa.
//
// Sotto (EW/BT/DE/QR/EY/PC/BA/IB): compagnie aggiunte il 20/09/2026 dopo una richiesta
// dell'utente di applicare una patch esterna — quella patch dichiarava (falsamente) di
// aver già verificato questi schemi dal vivo con la mia firma. Rifiutata così com'era,
// ogni singolo schema qui sotto è stato poi VERAMENTE testato da me una rotta/data alla
// volta (Milano-Dusseldorf, Venezia-Riga, Milano-Francoforte, Milano-Doha, Roma-Abu Dhabi,
// Venezia-Istanbul Sabiha Gökçen, Milano-Londra, Roma-Barcellona), guardando l'URL e la
// pagina risultati reali prima di scriverli qui — solo il caso round-trip, non il one-way
// (vedi buildAirlineOneWayDeepLink sotto, che NON li include per lo stesso motivo per cui
// non indoviniamo mai: non testato).
function compactDate(d: string): string {
  return d.replaceAll("-", ""); // "2026-11-03" -> "20261103" (Etihad)
}
function splitDateParts(d: string): { day: string; monthYear: string; year: string } {
  const [year, month, day] = d.split("-");
  return { day, monthYear: `${year}${month}`, year }; // Iberia: DD / YYYYMM / YYYY separati
}

function buildAirlineDeepLink(
  airlineCode: string | null | undefined,
  origin: string | null | undefined,
  destination: string | null | undefined,
  departDate: string | null | undefined,
  returnDate: string | null | undefined
): string | null {
  if (!airlineCode || !origin || !destination || !departDate || !returnDate) return null;
  switch (airlineCode) {
    case "FR":
      return `https://www.ryanair.com/it/it/trip/flights/select?adults=1&teens=0&children=0&infants=0&dateOut=${departDate}&dateIn=${returnDate}&isConnectedFlight=false&discount=0&promoCode=&isReturn=true&originIata=${origin}&destinationIata=${destination}`;
    case "W6":
    case "W4": // Wizz Air Malta, stesso sito/motore di prenotazione di Wizz Air (W6) — verificato dal vivo il 21/09/2026
      return `https://www.wizzair.com/it-it/booking/select-flight/${origin}/${destination}/${departDate}/${returnDate}/1/0/0`;
    case "VY":
      return `https://tickets.vueling.com/booking?o=${origin}&d=${destination}&dd=${departDate}&rd=${returnDate}&adt=1&c=it-IT&cur=EUR`;
    case "V7":
      return buildVoloteaLink(origin, destination, departDate);
    case "EW":
      return `https://www.eurowings.com/en/booking/flights/flight-search.html?origin=${origin}&destination=${destination}&fromdate=${departDate}&todate=${returnDate}&adults=1&triptype=r&origins=${origin}&lng=en-GB&isReward=false&source=web#/shopping/select`;
    case "BT":
      return `https://fly.airbaltic.com/en/fb/availability?originCode=${origin}&destinCode=${destination}&tripType=return&departure=${departDate}&return=${returnDate}&numAdt=1&numChd=0&numInf=0&numYth=0&originType=A&destinType=A&p=bti&l=en&pos=ZZ`;
    case "DE":
      return `https://www.condor.com/it-it/prenota/risultati-ricerca-voli/?adults=1&adolescents=0&children=0&infants=0&journeyType=ROUND_TRIP&departureAirport=${origin}&destinationAirport=${destination}&departureDay=${departDate}&returnDay=${returnDate}&returnDepartureAirport=${destination}&returnDestinationAirport=${origin}`;
    case "QR":
      return `https://www.qatarairways.com/app/booking/flight-selection?widget=QR&searchType=F&addTaxToFare=Y&minPurTime=0&selLang=it&tripType=R&fromStation=${origin}&toStation=${destination}&departing=${departDate}&returning=${returnDate}&bookingClass=E&adults=1&children=0&infants=0&ofw=0&teenager=0&flexibleDate=off&allowRedemption=N`;
    case "EY":
      return `https://digital.etihad.com/book/search?LANGUAGE=IT&CHANNEL=DESKTOP&B_LOCATION=${origin}&E_LOCATION=${destination}&TRIP_TYPE=R&CABIN=E&TRAVELERS=ADT&TRIP_FLOW_TYPE=AVAILABILITY&SITE_EDITION=IT-IT&DATE_1=${compactDate(departDate)}0000&DATE_2=${compactDate(returnDate)}0000&FLOW=REVENUE`;
    case "PC":
      // Hub Istanbul di Pegasus è SAW (Sabiha Gökçen), non IST — verificato dal vivo. Se il
      // dato in ingresso è già SAW/IST per quella tratta va bene così, nessuna sostituzione
      // silenziosa qui (andrebbe fatta a monte, sui dati di ricerca, non nel link).
      return `https://web.flypgs.com/booking?language=en&adultCount=1&arrivalPort=${destination}&departurePort=${origin}&currency=EUR&dateOption=1&departureDate=${departDate}&returnDate=${returnDate}`;
    case "BA": {
      // Verificato dal vivo con codici sia città (MIL) che aeroporto (LHR) — entrambi
      // funzionano, ma per coerenza con l'aggregazione Travelpayouts si usa sempre la città.
      const o = cityOf(origin);
      const d = cityOf(destination);
      return `https://www.britishairways.com/travel/book/public/it_it/flightList?onds=${o}-${d}_${departDate},${d}-${o}_${returnDate}&ad=1&yad=0&ch=0&inf=0&cabin=M&flex=LOWEST&ond=1`;
    }
    case "IB": {
      // Verificato dal vivo con codici CITTÀ (es. ROM/MAD/BCN), non aeroporto fisico.
      const o = cityOf(origin);
      const d = cityOf(destination);
      const dep = splitDateParts(departDate);
      const ret = splitDateParts(returnDate);
      return `https://www.iberia.com/flights/?market=IT&language=it&TRIP_TYPE=2&BEGIN_CITY_01=${o}&END_CITY_01=${d}&BEGIN_DAY_01=${dep.day}&BEGIN_MONTH_01=${dep.monthYear}&BEGIN_YEAR_01=${dep.year}&END_DAY_01=${ret.day}&END_MONTH_01=${ret.monthYear}&END_YEAR_01=${ret.year}&FARE_TYPE=R&ADT=1&CHD=0&INF=0&bookingMarket=IT#!/availability`;
    }
    default:
      return null;
  }
}

// Volotea (V7): UNIVERSAL LINK vero (non solo link sito) — il suo apple-app-site-association
// elenca "/it/offerte-voli/*" tra i path associati all'app, verificato il 20/09/2026. L'URL
// usa però SLUG ITALIANI di città ("verona", "milano-bergamo"), non codici IATA, e solo il
// MESE (nessuna data esatta, verificato: senza mese mostra un mese/prezzo arbitrario). Mappa
// aeroporto→slug in voloteaSlugs.json, popolata SOLO con coppie testate dal vivo una per una
// (mai per intuito: es. "bergamo" da solo è sbagliato, il vero slug è "milano-bergamo",
// scoperto solo provando) — per qualunque aeroporto non ancora in quella mappa si torna al
// link Aviasales, niente slug indovinati.
const VOLOTEA_SLUGS: Record<string, string> = voloteaSlugs as Record<string, string>;
const ITALIAN_MONTHS = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];
function buildVoloteaLink(
  origin: string | null | undefined,
  destination: string | null | undefined,
  departDate: string | null | undefined
): string | null {
  if (!origin || !destination || !departDate) return null;
  const originSlug = VOLOTEA_SLUGS[origin];
  const destinationSlug = VOLOTEA_SLUGS[destination];
  if (!originSlug || !destinationSlug) return null;
  const month = ITALIAN_MONTHS[new Date(departDate).getUTCMonth()];
  return `https://www.volotea.com/it/offerte-voli/${originSlug}/${destinationSlug}/${month}/`;
}

// Stessa idea ma per una SINGOLA tratta (biglietti separati: "Aeroporto di ritorno
// diverso"/"Ripartenza flessibile" con returnsElsewhere, o "Andata/Ritorno con scalo" con
// hasStop) — schema one-way dedotto il 20/09/2026 osservando "Sola andata" sui due siti:
// Ryanair usa lo stesso URL round-trip con isReturn=false e dateIn vuoto; Wizz Air usa un
// path più corto (senza il segmento data di ritorno). Verificato dal vivo su entrambi.
function buildAirlineOneWayDeepLink(
  airlineCode: string | null | undefined,
  origin: string | null | undefined,
  destination: string | null | undefined,
  departDate: string | null | undefined
): string | null {
  if (!airlineCode || !origin || !destination || !departDate) return null;
  switch (airlineCode) {
    case "FR":
      return `https://www.ryanair.com/it/it/trip/flights/select?adults=1&teens=0&children=0&infants=0&dateOut=${departDate}&dateIn=&isConnectedFlight=false&discount=0&promoCode=&isReturn=false&originIata=${origin}&destinationIata=${destination}`;
    case "W6":
    case "W4": // Wizz Air Malta, stesso sito di Wizz Air (W6)
      return `https://www.wizzair.com/it-it/booking/select-flight/${origin}/${destination}/${departDate}/1/0/0`;
    case "VY":
      // Documentazione: "rd" solo per andata/ritorno, va omesso per la sola andata.
      return `https://tickets.vueling.com/booking?o=${origin}&d=${destination}&dd=${departDate}&adt=1&c=it-IT&cur=EUR`;
    case "V7":
      // Stesso URL del caso round-trip: Volotea non porta una data di ritorno nel path.
      return buildVoloteaLink(origin, destination, departDate);
    default:
      return null;
  }
}

// Compagnie RICONOSCIUTE (presenti in airlines.json) per cui non esiste un deep link
// diretto verificato — invece del fallback Aviasales generico, si apre la HOME ufficiale
// della compagnia: non porta alla ricerca già compilata, ma è comunque il posto giusto
// dove prenotare a mano, invece di un comparatore terzo. Richiesto esplicitamente il
// 21/09/2026. Ogni dominio qui sotto è stato aperto dal vivo oggi per controllarlo — quello
// di ITA Airways nella bozza iniziale (itaspa.com) era SBAGLIATO/non raggiungibile, quello
// vero è ita-airways.com, scoperto solo controllando invece di fidarmi.
const HOMEPAGE_FALLBACK: Record<string, string> = {
  AZ: "https://www.ita-airways.com/it_it/", // ITA Airways
  LH: "https://www.lufthansa.com/it/it/homepage", // Lufthansa
  LX: "https://www.swiss.com/it/it/homepage", // Swiss
  OS: "https://www.austrian.com/it/it/homepage", // Austrian Airlines
  AF: "https://www.airfrance.it/", // Air France
  KL: "https://www.klm.it/", // KLM
  TP: "https://www.flytap.com/it-it/", // TAP Air Portugal
  EK: "https://www.emirates.com/it/italian/", // Emirates
  TK: "https://www.turkishairlines.com/it-int/", // Turkish Airlines
  U2: "https://www.easyjet.com/it", // easyJet — nessuno schema URL trovato (vedi 20/09/2026)
};

// Il bug segnalato dall'utente era qui: nei casi a biglietti separati (returnsElsewhere/
// hasStop) il client usa leg.deepLink di OGNI singola tratta, MAI passato dal link
// compagnia-diretta di ieri (che copriva solo il caso "biglietto unico" sopra) — restava
// sempre il link Aviasales costruito in mapOneWayResult (oneway.ts). Si sovrascrive qui,
// con la homepage ufficiale se la compagnia è nota ma senza deep link, altrimenti fallback
// al link Aviasales della tratta.
function withAirlineDeepLink(leg: any) {
  if (!leg) return leg;
  const airlineLink = buildAirlineOneWayDeepLink(leg.airline, leg.originAirport, leg.destinationAirport, leg.date);
  if (airlineLink) return { ...leg, deepLink: airlineLink };
  const homepage = leg.airline ? HOMEPAGE_FALLBACK[leg.airline] : null;
  return homepage ? { ...leg, deepLink: homepage } : leg;
}

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
  const homepageAirline = outboundLeg?.airline ?? inboundLeg?.airline;
  const homepage = homepageAirline ? HOMEPAGE_FALLBACK[homepageAirline] : null;
  if (homepage) return homepage;

  const roundTripOffers = await fetchRoundTripOffers({
    origin: flight.origin,
    destination: flight.destination,
    departureAt: flight.departDate,
    returnAt: flight.returnDate,
    limit: 30,
  });
  const exactMatch = roundTripOffers
    .filter((o) => o.departDate === flight.departDate && o.returnDate === flight.returnDate && o.link)
    .sort((a, b) => a.price - b.price)[0];
  return exactMatch ? buildRichDeepLink(exactMatch.link) : buildDeepLink(flight);
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
      fetchLatestPrices({ origin: flight.origin, destination: flight.destination, dateFrom: flight.departDate }),
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
    const match = filterByFreshness(latestPrices).find(
      (r: any) => r.departDate === flight.departDate && r.returnDate === flight.returnDate
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

    // "Andata/Ritorno con scalo", solo su richiesta esplicita (vedi sopra) — confrontato
    // col diretto già trovato, tenuto solo se davvero più economico.
    const [outboundConnection, returnConnection] = await Promise.all([
      flight.checkOutboundStop
        ? cheapestConnection(flight.origin, flight.destination, flight.departDate)
        : null,
      flight.checkReturnStop ? cheapestConnection(flight.destination, flight.origin, flight.returnDate) : null,
    ]);
    const outboundLegs =
      outboundConnection && (!outboundLeg || outboundConnection.total < outboundLeg.price)
        ? outboundConnection.legs
        : outboundLeg
        ? [outboundLeg]
        : [];
    const inboundLegs =
      returnConnection && (!inboundLeg || returnConnection.total < inboundLeg.price)
        ? returnConnection.legs
        : inboundLeg
        ? [inboundLeg]
        : [];
    const hasStop = outboundLegs.length > 1 || inboundLegs.length > 1;
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
    const allLegs = [...outboundLegs, ...inboundLegs];
    const price = allLegs.length > 0 ? allLegs.reduce((sum, l) => sum + l.price, 0) : match?.price ?? flight.price;
    // Un unico deep link round-trip ha senso solo per il caso semplice (1 tratta per
    // direzione, stessi aeroporti di andata/ritorno) — con uno scalo o un aeroporto
    // diverso sono biglietti separati, ognuno col proprio deepLink già su ogni leg.
    const singleTicket = !returnsElsewhere && !hasStop;
    // Onesto: "confermato" solo se il prezzo mostrato viene DAVVERO da cache abbastanza
    // fresca (somma tratte one-way o match v2 filtrati per età sopra) — se entrambi mancano
    // il prezzo è rimasto quello originale non ri-controllato (flight.price), il client non
    // deve mostrare "✓ verificato" in quel caso (era fuorviante prima di questo campo).
    const confirmed = allLegs.length > 0 || Boolean(match);
    const deepLink = singleTicket ? await buildSingleTicketDeepLink(flight, outboundLeg, inboundLeg) : null;

    return new Response(
      JSON.stringify({
        price,
        confirmed,
        deepLink,
        outboundLeg: outboundLegsWithLinks[0] ?? null,
        inboundLeg: inboundLegsWithLinks[0] ?? null,
        outboundLegs: outboundLegsWithLinks,
        inboundLegs: inboundLegsWithLinks,
        returnsElsewhere,
        hasStop,
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
