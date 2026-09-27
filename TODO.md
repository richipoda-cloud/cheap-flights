# TODO

Idee non ancora implementate, raccolte qui invece che perse in chat.

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

## Home: immagine di sfondo hero dinamica

Oggi (21/09/2026) la foto hero di Home è fissa (Islanda, Landmannalaugar/valle glaciale).
Idea proposta dall'utente: renderla variabile, due approcci possibili (non mutuamente esclusivi):

1. **Una serie di foto prestabilita** — un pool di foto verificate (stesso criterio già
   usato: cercate e aperte dal vivo prima di usarle, licenza libera tipo Unsplash), scelta
   casuale o a rotazione ad ogni visita/giorno.

2. **Foto in base all'ultima ricerca** — città/paese/capitale della destinazione
   dell'ultima ricerca salvata (`searches` più recente), invece di una foto fissa.
   Punto aperto da decidere: se l'ultima ricerca è "Ovunque" (nessuna destinazione
   specifica), serve stabilire o una foto diversa dedicata a quel caso, o tenere l'Islanda
   attuale come predefinita per "Ovunque".

Da chiarire prima di implementare: da dove arrivano le foto per opzione 2 (dataset a
mano per le destinazioni più comuni? servizio esterno tipo Unsplash Source/API con query
dinamica sul nome città? entrambi hanno tradeoff su affidabilità/licenza/costo) — vale lo
stesso principio già seguito in questo progetto: mai un URL o uno schema indovinato,
verificare dal vivo prima di usarlo.
