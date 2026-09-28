// Foto hero curate a mano per destinazione, usate in Home per lo sfondo dinamico legato
// all'ultima ricerca fatta (vedi Home.jsx). Set iniziale con le 5 destinazioni piu'
// ricorrenti nel progetto finora (Storico/Preferiti/test) — da ampliare nelle prossime
// sessioni con le altre destinazioni gia' scelte (vedi memoria progetto: 28 extra-Europa/
// charter + 46 europee, soggetto approvato per ciascuna).
//
// Ogni foto verificata a mano su unsplash.com prima di essere scelta: prefisso "photo-"
// (gratuita), MAI "premium_photo-" (Unsplash+, richiede abbonamento) — stesso identico
// controllo gia' fatto per la foto Islanda di default in Home.jsx. Chiave = codice citta'/
// aeroporto Travelpayouts (src/data/cities.json), maiuscolo.
const DESTINATION_PHOTOS = {
  TIA: "https://images.unsplash.com/photo-1632353913765-9b56b7b4bd55", // Tirana, Piazza Skanderbeg
  ZAG: "https://images.unsplash.com/photo-1761422901254-e5c1ad423b1c", // Zagabria, Piazza Ban Jelacic
  BCN: "https://images.unsplash.com/photo-1583422409516-2895a77efded", // Barcellona, skyline
  LMP: "https://images.unsplash.com/photo-1706169577130-08529f31fbbf", // Lampedusa, spiaggia
  TCI: "https://images.unsplash.com/photo-1691397553539-c7c573138747", // Tenerife, paesaggio
};

// Stessi parametri usati per la foto di default (Home.jsx): w=1200/q=80/dpr=2 per restare
// nitida sugli schermi ad alta densita' senza pesare troppo.
export function destinationPhotoUrl(code) {
  if (!code) return null;
  const base = DESTINATION_PHOTOS[code.toUpperCase()];
  if (!base) return null;
  return `${base}?auto=format&fit=crop&w=1200&q=80&dpr=2`;
}
