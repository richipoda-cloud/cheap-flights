# TODO

Idee non ancora implementate, raccolte qui invece che perse in chat.

## Compagnia/orario mai disponibili per USA, Giappone, Cina, Corea, Thailandia, Canada, Brasile

Limite strutturale, non un bug da correggere con più codice — verificato a fondo il
27-28/09/2026 dopo segnalazione dell'utente. Il volo di RITORNO verso l'Italia per queste
destinazioni non ha ALCUN dato nonstop in v3/prices_for_dates, controllato in 4 modi
diversi: aeroporto specifico (JFK/EWR/LGA/HND/NRT/PEK/PVG/CAN/HKG/ICN/PUS/BKK/DMK/YYZ/YUL/
GRU/GIG), città aggregata (NYC/MIA/TYO/SEL/YTO/SAO), codice paese, e codice città interno
dell'API (MIL). Zero in tutti i casi (JFK ne aveva 2, troppo pochi per essere reali).
Andata invece spesso ricca di dati (NYC 83, TYO 30 nonstop) — asimmetria dovuta a come
Travelpayouts popola la cache (frequenza di ricerca reale su siti partner, non schedule
voli), non un problema nostro risolvibile lato codice.

Uniche vie oltre questo punto, entrambe scartate per ora:
- **Scraping di Aviasales** (il motore dietro Travelpayouts, con più campi) — rifiutato:
  violerebbe i loro termini d'uso e quasi certamente ha protezione anti-bot.
- **Aviasales Flight Search API (real-time)** — non è a pagamento in euro, è gated da
  traffico: richiede un progetto con almeno **50.000 utenti attivi al mese (MAU)**
  (verificato dal vivo sulla doc ufficiale, novembre 2025). Sotto quella soglia non è
  accessibile a nessun prezzo. Da riconsiderare solo se l'app dovesse mai raggiungere
  quel traffico.

Per queste destinazioni resta: prezzo vero, conferma che è un volo diretto, data esatta —
mai compagnia/orario prima della prenotazione (fallback "non confermato" già in LegBox/
BookingAction).

## Ampliare COUNTRY_MAJOR_CITIES (search-direct) ad altri paesi

Scoperto il 27/09/2026 (segnalato dall'utente: "0 risultati per USA impossibile, esistono
voli diretti da Milano"): v2/prices/latest interrogato con `destination=CODICE PAESE`
(es. "US") ha una cache molto più povera di quando si passa una città/aeroporto specifico
— verificato dal vivo: MXP->US (paese) dava 20 risultati totali, ZERO senza scalo;
MXP->NYC (città) 182, di cui 83 senza scalo. `COUNTRY_MAJOR_CITIES` in
`supabase/functions/search-direct/index.ts` aggiunge IN PIÙ una query per le città
principali di un paese, verificate una per una dal vivo per avere davvero voli nonstop
in cache — non esaustiva (impossibile per tutti i 237 paesi, gli USA da soli hanno ~2000
città in `cities.json`).

Stesso giorno, ampliato da 2 a 13 paesi dopo "verifica anche altre destinazioni con lo
stesso problema" — testati ~25 paesi (destination=PAESE vs le sue città principali,
soglia pratica ~15+ voli nonstop per aggiungerla, non un singolo risultato isolato).
Aggiunti: US (NYC/MIA), JP (TYO), AE (DXB), EG (CAI), MA (CMN/RAK), IL (TLV), TR (IST),
IN (DEL), CN (PEK/PVG), KR (SEL), TH (BKK), CA (YTO), BR (SAO). Testati ma SENZA aggiunta
perché zero nonstop anche a livello di città (rete reale così, non un buco nei dati):
QA (Doha), MX, AR, AU, ZA, DO, CU, LK, ID, SG, KE, TZ, VN.

Da ampliare ulteriormente se altri paesi vengono segnalati con lo stesso sintomo — stesso
metodo: testare `destination=CODICE PAESE` vs le città principali una per una (query
diretta a v2/prices/latest, contare `number_of_changes:0`) prima di aggiungere qualunque
città alla lista, mai indovinare quali città potrebbero avere voli diretti.

## Compromesso "voli con scalo nella lista base" (deciso il 27/09/2026: NO per ora)

Proposto come alternativa al filtro attuale (Risultati = solo davvero diretti, salvo
toggle "Andata/Ritorno con scalo" esplicito): tenere i voli con scalo in lista ma
etichettati subito con un badge "N scali" visibile senza aprire il dettaglio, invece di
nasconderli del tutto. L'utente ha scelto di nasconderli (bottone esplicito) invece di
questo compromesso — lasciato qui nel caso si voglia riconsiderare in futuro.

## Ampliare il più possibile le compagnie con link diretto/homepage

Richiesto esplicitamente il 21/09/2026, dopo la rimozione di Google Flights come ultima
spiaggia (vedi commit "Via Google Flights..."): ora quando una compagnia non è né in
`buildAirlineDeepLink`/`buildAirlineOneWayDeepLink` né in `HOMEPAGE_FALLBACK`
(`supabase/functions/_shared/airlineLinks.ts`), l'utente vede solo il messaggio "prenota
da solo" — corretto rispetto a un link verso un sito terzo mai richiesto, ma ovviamente
meno comodo di un link diretto o anche solo della homepage. `airlines.json` ha centinaia
di codici: coprirli TUTTI uno per uno non è realistico, ma vale la pena allargare
`HOMEPAGE_FALLBACK` (bastano pochi minuti a compagnia: aprire il sito ufficiale dal vivo e
controllare il dominio, stesso identico metodo già usato per quelle attuali) alle
compagnie che compaiono più spesso nei risultati reali, invece di aspettare che l'utente
le segnali una per una infastidito. Stesso principio di sempre: mai un dominio indovinato,
sempre aperto e controllato dal vivo prima di aggiungerlo.

## Link diretti one-way per le 8 compagnie aggiunte dopo (FATTO 21/09/2026, tranne IB)

`buildAirlineOneWayDeepLink` in `supabase/functions/verify-price/index.ts` ora copre anche
EW/BT/DE/QR/EY/PC/BA (oltre a FR/W6/W4/VY/V7 già presenti), ognuno verificato dal vivo
impostando "Sola andata"/"One way" sul sito reale e guardando l'URL/i risultati:

- [x] Eurowings (EW) — MXP-DUS
- [x] Air Baltic (BT) — VRN-RIX
- [x] Condor (DE) — MXP-FRA
- [x] Qatar Airways (QR) — MXP-DOH
- [x] Etihad (EY) — FCO-AUH
- [x] Pegasus (PC) — VCE-SAW
- [x] British Airways (BA) — MIL-LON
- [ ] Iberia (IB) — NON fatto: "Sola andata" Roma-Barcellona dà un errore generico sul
      sito Iberia stesso ("Si è verificato un errore generale"), riprodotto due volte
      (anche con URL costruito a mano). Non uno schema indovinato male — il sito proprio
      non completa quella ricerca al momento. Da riprovare in futuro, magari è transitorio.

## Home: immagine di sfondo hero dinamica (FATTO 28/09/2026)

Implementata al 100%, in più round successivi:

- `src/data/destinationPhotos.js` — mapping completo di 74 destinazioni (codice città
  Travelpayouts → foto Unsplash gratuita), ognuna scelta dall'utente tra opzioni reali
  mostrate in chat, mai scelta in autonomia
- Per l'ultima ricerca con destinazione fissa: foto di quella destinazione, con colori
  cielo/fondo campionati dal vivo (`src/lib/heroColors.js`, canvas in-browser) e usati
  per il gradiente in cima/fondo e per il `theme-color` della barra di stato
- Per l'ultima ricerca "Ovunque" (nessuna destinazione precisa): rotazione tra le foto
  delle destinazioni trovate nei risultati (fino a 10, salvate in
  `filters._resultDestinations`), casuale senza ripetizioni finché non sono comparse
  tutte, un cambio ad ogni apertura dell'app (`src/lib/heroRotation.js`, shuffle bag in
  localStorage)
- Nessun flash all'apertura: né sulla foto di default (stato iniziale seminato da
  `getLastShownHero()`), né sulla foto della volta precedente per le ricerche in
  rotazione (`consumeNextRotationSync` fa avanzare il mazzo in modo sincrono prima del
  primo render)
- Cambio foto con dissolvenza morbida (crossfade CSS 450ms, `useCrossfadeHero` in
  `src/pages/Home.jsx`) invece di uno scatto secco, con precaricamento dell'immagine
  prima di iniziare la transizione

Confermato funzionante dall'utente il 28/09/2026 ("molto meglio").

## Bug minori noti, non urgenti

- Nessun feedback visivo dopo "Salva nei preferiti" e nessuna deduplicazione se il
  bottone viene cliccato più volte di fretta
- Campo destinazione in Search richiede doppio click
- Voci Storico poco distintive (non mostrano notti/flessibilità nell'elenco)
- Falso avviso "returnsElsewhere" su codici città con più aeroporti sotto lo stesso
  codice (es. BRU/CRL Bruxelles)
- Spazio vuoto su viewport desktop (layout pensato per mobile)

## Idea in sospeso: refactor one-way anche per i Diretti "normali"

Il refactor one-way (costruzione da tratte reali v3 invece di round-trip nidificati v2)
è già stato fatto per Percorsi creativi e per i risultati Diretti extra-Europa. Da
valutare se applicarlo anche ai risultati Diretti "normali" (voci non extra-Europa) dove
non ancora fatto.

## Pacchetto di attività finali (solo alla fine di tutto il resto, in ordine di priorità)

1. Test E2E con utente fittizio nuovo da zero
2. Onboarding + consenso termini al primo accesso + prompt pianificazione giornaliera
3. Sync app iOS Capacitor con l'ultima versione web
4. Security review (dati utente + protezione da copia/furto)
5. Rapportino statistiche uso per lo sviluppatore (non per l'utente)

## Alert operativi da monitorare

- Vercel: Deployment Storage al 100% (10GB) sul progetto — avviso upgrade a Pro, non
  ancora agito
- Supabase: dal 30 ottobre 2026 smetterà di dare accesso automatico alla Data API alle
  nuove tabelle create nello schema public (tabelle esistenti non toccate) — servirà un
  grant esplicito per ogni nuova tabella creata dopo quella data
- Modal: avviso di budget usage ricevuto per un workspace "richipoda" — non ancora
  chiarito se collegato a questo progetto o ad altro
