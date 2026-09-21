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
