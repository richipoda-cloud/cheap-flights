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
const cache = new Map();

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
// volte con la stessa foto (es. l'utente torna in Home) non ricampiona da capo.
export function sampleHeroColors(imageUrl) {
  if (cache.has(imageUrl)) return cache.get(imageUrl);

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
        resolve({ skyColor, bottomColor });
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
