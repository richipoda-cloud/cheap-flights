// Link diretti al sito/app della compagnia aerea, condivisi tra verify-price (voli
// diretti) e search-stopover (percorsi creativi) — prima vivevano solo in verify-price
// e le tratte one-way di search-stopover restavano col link Aviasales grezzo di
// oneway.ts, mai sostituito: segnalato dall'utente ("ogni volta mi apre google flights",
// e più a monte "non voglio più vedere aviasales") dopo aver notato che i percorsi a
// biglietti separati arrivavano ancora con link estranei.
//
// Google Flights (usato brevemente come ultima spiaggia il 21/09/2026) RIMOSSO del tutto
// su richiesta esplicita e furiosa dell'utente ("mi da lo stesso nervoso [di Aviasales]")
// — non era mai stato approvato, l'avevo scelto io per scalabilità. Ora l'ultima spiaggia
// è deepLink:null: il client mostra compagnia/data/orario (già noti dal box Andata/
// Ritorno) e un messaggio che rimanda l'utente a prenotare da sé sul sito della
// compagnia, invece di un bottone che porta a un comparatore terzo mai richiesto.
import airportCityMap from "./airportCityMap.json" with { type: "json" };
import voloteaSlugs from "./voloteaSlugs.json" with { type: "json" };

const CITY_BY_AIRPORT: Record<string, string> = airportCityMap as Record<string, string>;
export function cityOf(code: string): string {
  return CITY_BY_AIRPORT[code] ?? code;
}

function compactDate(d: string): string {
  return d.replaceAll("-", ""); // "2026-11-03" -> "20261103" (Etihad)
}
function splitDateParts(d: string): { day: string; monthYear: string; year: string } {
  const [year, month, day] = d.split("-");
  return { day, monthYear: `${year}${month}`, year }; // Iberia: DD / YYYYMM / YYYY separati
}
function dottedDate(d: string): string {
  const [year, month, day] = d.split("-");
  return `${day}.${month}.${year}`; // "2026-09-22" -> "22.09.2026" (TAP)
}
const MONTH_ABBR = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];
function monthAbbrAndDay(d: string): { month: string; day: string } {
  const [, month, day] = d.split("-");
  return { month: MONTH_ABBR[Number(month) - 1], day: String(Number(day)) }; // Air New Zealand
}
function formatSlashDate(d: string): string {
  const [year, month, day] = d.split("-");
  return `${day}/${month}/${year}`; // "2026-09-22" -> "22/09/2026" (Air Canada)
}

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

// Round-trip, biglietto unico — ogni schema verificato dal vivo una rotta/data alla
// volta (vedi git log per le date/rotte di verifica), mai indovinato.
export function buildAirlineDeepLink(
  airlineCode: string | null | undefined,
  origin: string | null | undefined,
  destination: string | null | undefined,
  departDate: string | null | undefined,
  returnDate: string | null | undefined
): string | null {
  if (!airlineCode || !origin || !destination || !departDate || !returnDate) return null;
  switch (airlineCode) {
    case "FR":
    case "MW": // Malta Air, marchio del gruppo Ryanair
      return `https://www.ryanair.com/it/it/trip/flights/select?adults=1&teens=0&children=0&infants=0&dateOut=${departDate}&dateIn=${returnDate}&isConnectedFlight=false&discount=0&promoCode=&isReturn=true&originIata=${origin}&destinationIata=${destination}`;
    case "W6":
    case "W4": // Wizz Air Malta, stesso sito/motore di Wizz Air (W6)
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
      // Hub Istanbul di Pegasus e' SAW (Sabiha Gokcen), non IST.
      return `https://web.flypgs.com/booking?language=en&adultCount=1&arrivalPort=${destination}&departurePort=${origin}&currency=EUR&dateOption=1&departureDate=${departDate}&returnDate=${returnDate}`;
    case "TP":
      // Verificato dal vivo il 22/09/2026 (MXP-LIS): URL con "deeplink" esplicito nel
      // path, date in formato DD.MM.YYYY. Trovato intercettando window.open dal bottone
      // "Cerca" del sito (il link non è visibile come href statico in pagina).
      return `https://booking.flytap.com/booking/flights/deeplink?market=IT&language=it&origin=${origin}&destination=${destination}&flexibleDates=false&flightType=return&adt=1&chd=0&inf=0&yth=0&depDate=${dottedDate(departDate)}&retDate=${dottedDate(returnDate)}`;
    case "UA":
      // Verificato dal vivo il 22/09/2026 (MXP-EWR): stesso principio, URL trovato
      // sulla barra indirizzi dopo submit del form (niente window.open qui).
      return `https://www.united.com/en/it/fsr/choose-flights?f=${origin}&t=${destination}&d=${departDate}&r=${returnDate}&sc=7,7&px=1&taxng=1&newHP=True&clm=7&st=bestmatches&tqp=R`;
    case "AC":
      // Verificato dal vivo il 22/09/2026 (MXP-YYZ): intercettato da window.open del
      // bottone "Ricerca".
      return `https://www.aircanada.com/booking/it/it/aco/search?org0=${origin}&dest0=${destination}&orgType0=A&destType0=A&org1=${destination}&dest1=${origin}&orgType1=A&destType1=A&departureDate0=${formatSlashDate(departDate)}&departureDate1=${formatSlashDate(returnDate)}&adt=1&yth=0&chd=0&inf=0&ins=0&marketCode=INT&tripType=RoundTrip&isFlexible=false`;
    case "CX":
      // Verificato dal vivo il 22/09/2026 (MXP-HKG): intercettato da window.open del
      // bottone "Cerca voli".
      return `https://book.cathaypacific.com/tsp/it_IT/flight-selection?ca=Y&o=${origin}&d=${destination}&a=1&ya=0&ch=0&i=0&ddb1=${departDate}&ddb2=${returnDate}&viewport=desktop`;
    case "NZ": {
      // Verificato dal vivo il 22/09/2026 (MXP-AKL): trovato nell'href statico del
      // bottone "Search" (non serve intercettare window.open). Formato data:
      // mese abbreviato maiuscolo + giorno senza zero iniziale, separati.
      const dep = monthAbbrAndDay(departDate);
      const ret = monthAbbrAndDay(returnDate);
      return `https://flightbookings.airnewzealand.eu/vbook/actions/ext-search?searchLegs%5B0%5D.originPoint=${origin}&searchLegs%5B0%5D.destinationPoint=${destination}&searchLegs%5B0%5D.tripStartMonth=${dep.month}&searchLegs%5B0%5D.tripStartDate=${dep.day}&searchLegs%5B1%5D.originPoint=${destination}&searchLegs%5B1%5D.destinationPoint=${origin}&searchLegs%5B1%5D.tripStartMonth=${ret.month}&searchLegs%5B1%5D.tripStartDate=${ret.day}&depart-from=${origin}&depart-to=${destination}&tripType=return&adults=1&children=0&infants=0&bookingClass=ECONOMY&promoCode=&searchType=flexible&doSearch=search`;
    }
    case "BA": {
      const o = cityOf(origin);
      const d = cityOf(destination);
      return `https://www.britishairways.com/travel/book/public/it_it/flightList?onds=${o}-${d}_${departDate},${d}-${o}_${returnDate}&ad=1&yad=0&ch=0&inf=0&cabin=M&flex=LOWEST&ond=1`;
    }
    case "IB": {
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

// Singola tratta one-way (biglietti separati) — solo le compagnie con schema one-way
// verificato dal vivo a parte (vedi git log); Iberia esclusa qui, "Sola andata" dà
// errore generico sul sito stesso, riprodotto due volte.
export function buildAirlineOneWayDeepLink(
  airlineCode: string | null | undefined,
  origin: string | null | undefined,
  destination: string | null | undefined,
  departDate: string | null | undefined
): string | null {
  if (!airlineCode || !origin || !destination || !departDate) return null;
  switch (airlineCode) {
    case "FR":
    case "MW":
      return `https://www.ryanair.com/it/it/trip/flights/select?adults=1&teens=0&children=0&infants=0&dateOut=${departDate}&dateIn=&isConnectedFlight=false&discount=0&promoCode=&isReturn=false&originIata=${origin}&destinationIata=${destination}`;
    case "W6":
    case "W4":
      return `https://www.wizzair.com/it-it/booking/select-flight/${origin}/${destination}/${departDate}/1/0/0`;
    case "VY":
      return `https://tickets.vueling.com/booking?o=${origin}&d=${destination}&dd=${departDate}&adt=1&c=it-IT&cur=EUR`;
    case "V7":
      return buildVoloteaLink(origin, destination, departDate);
    case "EW":
      return `https://www.eurowings.com/en/booking/flights/flight-search.html?origin=${origin}&destination=${destination}&fromdate=${departDate}&adults=1&triptype=oneway&origins=${origin}&lng=en-GB&isReward=false&source=web#/shopping/select`;
    case "BT":
      return `https://fly.airbaltic.com/en/fb/availability?originCode=${origin}&destinCode=${destination}&tripType=oneway&departure=${departDate}&numAdt=1&numChd=0&numInf=0&numYth=0&originType=A&destinType=A&p=bti&l=en&pos=ZZ`;
    case "DE":
      return `https://www.condor.com/it-it/prenota/risultati-ricerca-voli/?adults=1&adolescents=0&children=0&infants=0&journeyType=ONE_WAY&departureAirport=${origin}&destinationAirport=${destination}&departureDay=${departDate}`;
    case "QR":
      return `https://www.qatarairways.com/app/booking/flight-selection?widget=QR&searchType=F&addTaxToFare=Y&minPurTime=0&selLang=it&tripType=O&fromStation=${origin}&toStation=${destination}&departing=${departDate}&bookingClass=E&adults=1&children=0&infants=0&ofw=0&teenager=0&flexibleDate=off&allowRedemption=N`;
    case "EY":
      return `https://digital.etihad.com/book/search?LANGUAGE=IT&CHANNEL=DESKTOP&B_LOCATION=${origin}&E_LOCATION=${destination}&TRIP_TYPE=O&CABIN=E&TRAVELERS=ADT&TRIP_FLOW_TYPE=AVAILABILITY&SITE_EDITION=IT-IT&DATE_1=${compactDate(departDate)}0000&FLOW=REVENUE`;
    case "PC":
      return `https://web.flypgs.com/booking?language=en&adultCount=1&arrivalPort=${destination}&departurePort=${origin}&currency=EUR&dateOption=1&departureDate=${departDate}`;
    case "TP":
      // Verificato dal vivo il 22/09/2026 (MXP-LIS): stesso URL del round-trip con
      // flightType=oneway e niente retDate.
      return `https://booking.flytap.com/booking/flights/deeplink?market=IT&language=it&origin=${origin}&destination=${destination}&flexibleDates=false&flightType=oneway&adt=1&chd=0&inf=0&yth=0&depDate=${dottedDate(departDate)}`;
    case "UA":
      // Verificato dal vivo il 22/09/2026 (MXP-EWR): parametro tqp=O al posto di R,
      // niente "r" (data di ritorno).
      return `https://www.united.com/en/it/fsr/choose-flights?f=${origin}&t=${destination}&d=${departDate}&sc=7&px=1&taxng=1&newHP=True&clm=7&st=bestmatches&tqp=O`;
    case "AC":
      // Verificato dal vivo il 22/09/2026 (MXP-YYZ): un solo leg (org0/dest0), tripType=OneWay.
      return `https://www.aircanada.com/booking/it/it/aco/search?org0=${origin}&dest0=${destination}&orgType0=A&destType0=A&departureDate0=${formatSlashDate(departDate)}&adt=1&yth=0&chd=0&inf=0&ins=0&marketCode=INT&tripType=OneWay&isFlexible=false`;
    case "CX":
      // Verificato dal vivo il 22/09/2026 (MXP-HKG): niente ddb2 (data di ritorno) attiva
      // automaticamente la tariffa "solo andata".
      return `https://book.cathaypacific.com/tsp/it_IT/flight-selection?ca=Y&o=${origin}&d=${destination}&a=1&ya=0&ch=0&i=0&ddb1=${departDate}&viewport=desktop`;
    case "BA": {
      const o = cityOf(origin);
      const d = cityOf(destination);
      return `https://www.britishairways.com/travel/book/public/it_it/flightList?onds=${o}-${d}_${departDate}&ad=1&yad=0&ch=0&inf=0&cabin=M&flex=LOWEST&ond=1`;
    }
    default:
      return null;
  }
}

// Compagnie RICONOSCIUTE (presenti in airlines.json) senza un deep link diretto
// verificato: homepage ufficiale, "il posto giusto dove prenotare a mano" anche se non
// precompilata. Ogni dominio aperto dal vivo per controllarlo (vedi git log).
export const HOMEPAGE_FALLBACK: Record<string, string> = {
  AZ: "https://www.ita-airways.com/it_it/", // ITA Airways
  LH: "https://www.lufthansa.com/it/it/homepage", // Lufthansa
  LX: "https://www.swiss.com/it/it/homepage", // Swiss
  OS: "https://www.austrian.com/it/it/homepage", // Austrian Airlines
  AF: "https://www.airfrance.it/", // Air France
  KL: "https://www.klm.it/", // KLM
  TP: "https://www.flytap.com/it-it/", // TAP Air Portugal
  EK: "https://www.emirates.com/it/italian/", // Emirates
  TK: "https://www.turkishairlines.com/it-int/", // Turkish Airlines
  U2: "https://www.easyjet.com/it", // easyJet — nessuno schema URL trovato
  IB: "https://www.iberia.com/it/", // Iberia — round-trip ha schema, one-way no
  SK: "https://www.flysas.com/it/", // SAS Scandinavian Airlines
  "3F": "https://www.flyone.eu/am/", // FLYONE Armenia
  // Aggiunte il 22/09/2026, giro esaustivo su richiesta esplicita dell'utente — ognuna
  // bloccata da qualcosa di concreto e verificato dal vivo (mai per pigrizia): verifica
  // anti-bot (Cloudflare/Akamai) sull'motore di prenotazione vero, o motore a stato di
  // sessione senza URL condivisibile (vedi commenti puntuali sotto).
  DL: "https://www.delta.com", // Delta — stato di sessione (cacheKeySuffix), niente URL
  AA: "https://www.aa.com", // American Airlines — stato di sessione, niente URL
  JL: "https://www.jal.co.jp/it/it/", // Japan Airlines — stato di sessione (JAL_SESSION_ID)
  NH: "https://www.ana.co.jp/en/it/", // ANA — stato di sessione (POST, nessun URL)
  QF: "https://www.qantas.com", // Qantas — bloccato da Akamai ("Access Denied") sul motore vero
  SQ: "https://www.singaporeair.com/en_UK/it/home", // Singapore Airlines — hash SPA, stato di sessione
  KE: "https://www.koreanair.com/it/it", // Korean Air — calendario non automatizzabile, da riprovare
};

// Applica lo schema one-way diretto o, altrimenti, la homepage — su una singola tratta
// (biglietti separati). NIENTE fallback finale: se non conosciamo né l'uno né l'altro,
// deepLink resta null e il client mostra il messaggio "prenota da solo" invece di un
// link verso un sito terzo mai richiesto.
export function withAirlineDeepLink<T extends { airline?: string | null; originAirport?: string | null; destinationAirport?: string | null; date?: string | null }>(
  leg: T
): T & { deepLink: string | null } {
  if (!leg) return leg as T & { deepLink: string | null };
  const airlineLink = buildAirlineOneWayDeepLink(leg.airline, leg.originAirport, leg.destinationAirport, leg.date);
  if (airlineLink) return { ...leg, deepLink: airlineLink };
  const homepage = leg.airline ? HOMEPAGE_FALLBACK[leg.airline] : null;
  return { ...leg, deepLink: homepage ?? null };
}
