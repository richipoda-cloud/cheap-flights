// Foto hero curate a mano per destinazione, usate in Home per lo sfondo dinamico legato
// all'ultima ricerca fatta (vedi Home.jsx). Ampliato progressivamente con le destinazioni
// gia' scelte (vedi memoria progetto: 28 extra-Europa/charter + 46 europee, soggetto
// approvato per ciascuna) man mano che si sourcia la foto vera su Unsplash.
//
// Ogni foto verificata a mano su unsplash.com prima di essere scelta: prefisso "photo-"
// (gratuita), MAI "premium_photo-" (Unsplash+, richiede abbonamento) — stesso identico
// controllo gia' fatto per la foto Islanda di default in Home.jsx. Chiave = codice citta'/
// aeroporto Travelpayouts (src/data/cities.json), maiuscolo.
//
// Le 28 destinazioni extra-Europa/charter sono complete. Europee in corso (39/46).
const DESTINATION_PHOTOS = {
  TIA: "https://images.unsplash.com/photo-1632353913765-9b56b7b4bd55", // Tirana, Piazza Skanderbeg
  ZAG: "https://images.unsplash.com/photo-1761422901254-e5c1ad423b1c", // Zagabria, Piazza Ban Jelacic
  BCN: "https://images.unsplash.com/photo-1583422409516-2895a77efded", // Barcellona, skyline
  LMP: "https://images.unsplash.com/photo-1706169577130-08529f31fbbf", // Lampedusa, spiaggia
  TCI: "https://images.unsplash.com/photo-1691397553539-c7c573138747", // Tenerife, paesaggio
  NYC: "https://images.unsplash.com/photo-1499092346589-b9b6be3e94b2", // New York, skyline Manhattan/Brooklyn Bridge
  MIA: "https://images.unsplash.com/photo-1717940749812-c202bec41ee5", // Miami, skyline da spiaggia
  TYO: "https://images.unsplash.com/photo-1513407030348-c983a97b98d8", // Tokyo, skyline con Tokyo Tower
  DXB: "https://images.unsplash.com/photo-1579525612525-053cd3e8cbd7", // Dubai, skyline aereo con Burj Khalifa
  CAI: "https://images.unsplash.com/photo-1568322445389-f64ac2515020", // Il Cairo, Sfinge e Piramide
  CMN: "https://images.unsplash.com/photo-1538230575309-59dfc388ae36", // Casablanca, citta'
  RAK: "https://images.unsplash.com/photo-1570135460237-510ca82c6781", // Marrakech, medina/souk
  TLV: "https://images.unsplash.com/photo-1719757633949-3a0e42706f6d", // Tel Aviv, skyline da spiaggia
  IST: "https://images.unsplash.com/photo-1619965342156-8e28c92028e7", // Istanbul, moschea sull'acqua
  DEL: "https://images.unsplash.com/photo-1587474260584-136574528ed5", // Delhi, India Gate
  BJS: "https://images.unsplash.com/photo-1701571398927-e6b1919390d0", // Pechino, skyline
  SHA: "https://images.unsplash.com/photo-1545893835-abaa50cbe628", // Shanghai, skyline Lujiazui/Bund
  SEL: "https://images.unsplash.com/photo-1532649097480-b67d52743b69", // Seoul, skyline notturno
  BKK: "https://images.unsplash.com/photo-1563492065599-3520f775eeed", // Bangkok, templi
  YTO: "https://images.unsplash.com/photo-1543962226-818f4301073f", // Toronto, skyline con CN Tower
  SAO: "https://images.unsplash.com/photo-1561592390-42c07289e9cb", // San Paolo, skyline
  ZNZ: "https://images.unsplash.com/photo-1575999502951-4ab25b5ca889", // Zanzibar, spiaggia
  MBA: "https://images.unsplash.com/photo-1642741974974-37cafd8fc3bf", // Mombasa/Diani, spiaggia al tramonto
  PUJ: "https://images.unsplash.com/photo-1705507972578-78537a2dda73", // Punta Cana, spiaggia
  MLE: "https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b", // Maldive, bungalow sull'acqua
  CMB: "https://images.unsplash.com/photo-1740812517495-812e90ca01b1", // Colombo, citta' e oceano
  DPS: "https://images.unsplash.com/photo-1555400038-63f5ba517a47", // Bali, risaie a Tegalalang
  CUN: "https://images.unsplash.com/photo-1602088113235-229c19758e9f", // Cancun, spiaggia
  MAD: "https://images.unsplash.com/photo-1631178629147-b1e7e4a62403", // Madrid, skyline
  LIS: "https://images.unsplash.com/photo-1697748525265-7431cba075b6", // Lisbona, tram di Alfama
  PAR: "https://images.unsplash.com/photo-1570097703229-b195d6dd291f", // Parigi, Tour Eiffel
  LON: "https://images.unsplash.com/photo-1549483249-f0b359d1e289", // Londra, skyline con Gherkin e Thames
  BER: "https://images.unsplash.com/photo-1599946347371-68eb71b16afc", // Berlino, skyline
  AMS: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017", // Amsterdam, canali
  BRU: "https://images.unsplash.com/photo-1575845664732-ee40fdc525a3", // Bruxelles, edifici storici
  DUB: "https://images.unsplash.com/photo-1644955538144-7d896b5ffc70", // Dublino, skyline con ponte
  VIE: "https://images.unsplash.com/photo-1516550893923-42d28e5677af", // Vienna, skyline al tramonto
  ZRH: "https://images.unsplash.com/photo-1664459937096-d395cd77f8b8", // Zurigo, ponte e citta'
  PRG: "https://images.unsplash.com/photo-1600623471616-8c1966c91ff6", // Praga, Ponte Carlo e Castello al tramonto
  BUD: "https://images.unsplash.com/photo-1616432902940-b7a1acbc60b3", // Budapest, Parlamento sul Danubio
  KRK: "https://images.unsplash.com/photo-1650709224943-7187a0bb1412", // Cracovia, centro storico
  BUH: "https://images.unsplash.com/photo-1690285044968-e2c856885065", // Bucarest, Palazzo del Parlamento
  ATH: "https://images.unsplash.com/photo-1603565816030-6b389eeb23cb", // Atene, Acropoli al tramonto
  MLA: "https://images.unsplash.com/photo-1600498202878-79bdcbe69033", // Malta/La Valletta, skyline
  PMI: "https://images.unsplash.com/photo-1579551450606-1b2180590522", // Palma di Maiorca, spiaggia
  IBZ: "https://images.unsplash.com/photo-1622890806166-111d7f6c7c97", // Ibiza, spiaggia
  NCE: "https://images.unsplash.com/photo-1554149082-75d460afced3", // Nizza, costa/Costa Azzurra
  CPH: "https://images.unsplash.com/photo-1693085777063-138a4cf57c3f", // Copenaghen, Nyhavn
  STO: "https://images.unsplash.com/photo-1759094310451-b1d216921168", // Stoccolma, skyline sul lungomare
  RIX: "https://images.unsplash.com/photo-1685470934582-3636319a3be9", // Riga, centro storico con torre dell'orologio
  SPU: "https://images.unsplash.com/photo-1629277911349-4414807025e0", // Spalato, costa
  OPO: "https://images.unsplash.com/photo-1780999255455-1f881a62129c", // Porto, ponte Dom Luis I sul Douro
  SVQ: "https://images.unsplash.com/photo-1509840841025-9088ba78a826", // Siviglia, Cattedrale
  VLC: "https://images.unsplash.com/photo-1719401542194-95139aed215c", // Valencia, Citta' delle Arti e delle Scienze
  MUC: "https://images.unsplash.com/photo-1577462282244-b58c2816d686", // Monaco di Baviera, vista aerea
  FRA: "https://images.unsplash.com/photo-1540646794357-6cbbd6f3501e", // Francoforte, skyline aereo
  HAM: "https://images.unsplash.com/photo-1551353471-1975b91e445b", // Amburgo, porto
  BEG: "https://images.unsplash.com/photo-1713132508337-4e06156b544f", // Belgrado, ponte sul fiume e citta'
  GVA: "https://images.unsplash.com/photo-1633022326182-1b36700bc49a", // Ginevra, Jet d'Eau
  EDI: "https://images.unsplash.com/photo-1619187731847-28392c0c7917", // Edimburgo, castello
  MAN: "https://images.unsplash.com/photo-1663345332112-3d866f301ab4", // Manchester, skyline
  HEL: "https://images.unsplash.com/photo-1538332576228-eb5b4c4de6f5", // Helsinki, Cattedrale
  VNO: "https://images.unsplash.com/photo-1667743350028-e0a17093d7e4", // Vilnius, centro storico con torre dell'orologio
  TLL: "https://images.unsplash.com/photo-1731139892979-6016ef80c69d", // Tallinn, centro storico
  SOF: "https://images.unsplash.com/photo-1635544039349-eff845bd6220", // Sofia, Cattedrale Alexander Nevsky
  LJU: "https://images.unsplash.com/photo-1578386269334-4e912b9cdbc8", // Lubiana, castello
  BTS: "https://images.unsplash.com/photo-1693141157418-4543599b079c", // Bratislava, centro storico con torre dell'orologio
};

// Stessi parametri usati per la foto di default (Home.jsx): w=1200/q=80/dpr=2 per restare
// nitida sugli schermi ad alta densita' senza pesare troppo.
export function destinationPhotoUrl(code) {
  if (!code) return null;
  const base = DESTINATION_PHOTOS[code.toUpperCase()];
  if (!base) return null;
  return `${base}?auto=format&fit=crop&w=1200&q=80&dpr=2`;
}
