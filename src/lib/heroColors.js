// Campiona in-browser (via canvas) il colore del cielo (fascia superiore) e il colore di
// fondo (fascia inferiore) di una foto hero — stesso principio gia' usato per il colore
// hardcoded dell'hero Islanda di default (HERO_BOTTOM_COLOR in Home.jsx, campionato a
// mano una volta), ma calcolato al volo per qualunque foto invece di doverlo ricampionare
// a mano ogni volta che si aggiunge una destinazione.
//
// Il campionamento avviene qui (nel browser dell'utente) e non lato server/script perche'
// da una sessione Claude (cloud o device bridge sul Mac) l'accesso diretto a
// images.unsplash.com e' bloccato dal proxy di rete della sessione — verificato dal vivo
// il 28/09/2026 (curl -I restituisce 403 "blocked-by-allowlist"). Il browser dell'utente
// non ha questa restrizione.
//
// Risultato cachato sia in memoria (Map, evita di far ripartire la Promise se la stessa
// foto viene richiesta più volte nello stesso caricamento pagina) SIA in localStorage
// (persistente tra aperture dell'app) — segnalato dall'utente: la prima volta che una
// foto viene mostrata c'è comunque un breve caricamento (default Islanda finché il
// colore vero non è pronto, il tempo di scaricare l'immagine e leggerla via canvas), ma
// dalla seconda volta in poi (stessa foto già vista, o "preparata in anticipo" mentre
// l'app era ancora aperta — vedi Home.jsx + heroRotation.js/peekNextDestination) il
// colore è già in cache: la foto compare subito, senza passare dal default.
const cache = new Map();
const STORAGE_KEY = "hero-colors-cache-v1";

function readPersistentCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    // localStorage non disponibile (navigazione privata, quota piena) — si procede
    // senza cache persistente, solo quella in memoria per la sessione corrente.
    return {};
  }
}

function writePersistentEntry(imageUrl, colors) {
  try {
    const all = readPersistentCache();
    all[imageUrl] = colors;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Idem sopra — se non si riesce a salvare, niente persistenza, nessun crash.
  }
}

// Lettura SINCRONA della cache persistente — usata da Home per mostrare la foto giusta
// subito, senza passare dal default, se è già stata campionata in precedenza (in questa
// sessione o in una passata) o preparata in anticipo.
export function getCachedHeroColors(imageUrl) {
  if (!imageUrl) return null;
  return readPersistentCache()[imageUrl] ?? null;
}

// Ultima foto (+ colori) effettivamente mostrata in Home, per-dispositivo — segnalato
// dall'utente: anche con la cache sopra, all'apertura dell'app si vedeva comunque
// l'Islanda per un istante, perché è il valore iniziale del componente PRIMA ancora di
// sapere quale sia l'ultima ricerca (arriva da una query al database, mai istantanea).
// Qui si salva invece l'ultima foto mostrata per davvero, cosi' il prossimo avvio può
// partire direttamente da quella (letta in modo sincrono, vedi Home.jsx) invece che da
// un valore fisso — l'effect dopo il mount la corregge comunque se serve (nuova ricerca),
// ma senza passare dal default nel frattempo.
//
// rotationSignature: quando la foto salvata viene dalla rotazione "Ovunque" (non da una
// destinazione fissa), memorizza la firma (id ricerca) usata per pescarla dal mazzo di
// heroRotation.js — permette al prossimo avvio di far avanzare la rotazione in modo
// SINCRONO (vedi consumeNextRotationSync), partendo già dalla foto NUOVA invece che da
// questa (vecchia) per poi cambiarla sotto gli occhi dell'utente. Segnalato dall'utente:
// senza questo, il flash sull'Islanda era sparito ma ne restava uno identico con "la foto
// precedente" al posto dell'Islanda — stesso identico problema, causa diversa.
const LAST_SHOWN_KEY = "hero-last-shown-v1";

export function getLastShownHero() {
  try {
    const raw = localStorage.getItem(LAST_SHOWN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setLastShownHero(url, skyColor, bottomColor, rotationSignature = null) {
  try {
    localStorage.setItem(LAST_SHOWN_KEY, JSON.stringify({ url, skyColor, bottomColor, rotationSignature }));
  } catch {
    // localStorage non disponibile — niente persistenza, nessun crash: si ricomincia
    // semplicemente dal default al prossimo avvio, come prima di questo fix.
  }
}

function hexOf(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.round(v).toString(16).padStart(2, "0").toUpperCase())
      .join("")
  );
}

function averageRegion(ctx, x, y, w, h) {
  const { data } = ctx.getImageData(x, y, w, h);
  let r = 0;
  let g = 0;
  let b = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  return hexOf(r / n, g / n, b / n);
}

// Ritorna una Promise<{skyColor, bottomColor}>. Risultato cachato per URL — chiamata piu'
// volte con la stessa foto (es. l'utente torna in Home, o una foto "preparata in
// anticipo" viene poi davvero mostrata) non ricampiona da capo.
export function sampleHeroColors(imageUrl) {
  if (cache.has(imageUrl)) return cache.get(imageUrl);

  const persisted = getCachedHeroColors(imageUrl);
  if (persisted) {
    const resolved = Promise.resolve(persisted);
    cache.set(imageUrl, resolved);
    return resolved;
  }

  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const W = img.naturalWidth;
        const H = img.naturalHeight;
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        // Stessa fascia centrale (30%-70% larghezza) usata per il campionamento offline
        // di riferimento — cielo in cima, fondo in basso, entrambi alti l'8% della foto.
        const bandX = Math.round(W * 0.3);
        const bandW = Math.round(W * 0.4);
        const bandH = Math.max(1, Math.round(H * 0.08));

        const skyColor = averageRegion(ctx, bandX, 0, bandW, bandH);
        const bottomColor = averageRegion(ctx, bandX, H - bandH, bandW, bandH);
        const result = { skyColor, bottomColor };
        writePersistentEntry(imageUrl, result);
        resolve(result);
      } catch (e) {
        // getImageData puo' fallire per "tainted canvas" se il CDN non manda header CORS
        // permissivi — non dovrebbe succedere con images.unsplash.com, ma niente crash:
        // il chiamante ricade sui colori di default.
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = imageUrl;
  });

  cache.set(imageUrl, promise);
  return promise;
}
