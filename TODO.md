# TODO

Idee non ancora implementate, raccolte qui invece che perse in chat.

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
