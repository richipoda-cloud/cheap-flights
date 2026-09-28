// Rotazione della foto hero in Home per le ricerche "Ovunque" (nessuna destinazione
// precisa scelta dall'utente) — quando l'ultima ricerca non ha una destinazione precisa
// e ha trovato dei risultati (vedi Results.jsx, attachResultDestinations), invece di
// restare sempre sulla foto di default si mostra una foto diversa tra quelle destinazioni
// ad ogni apertura dell'app. Richiesto esplicitamente dall'utente: ordine casuale ma SENZA
// ripetizioni finché non sono comparse tutte le destinazioni del lotto corrente (poi si
// rimescola da capo), cambio legato all'apertura dell'app (non al giorno/orario).
//
// Stato tenuto in localStorage (per-dispositivo, sopravvive alla chiusura dell'app) come
// un "mazzo" (bag) di codici ancora da mostrare per il lotto corrente. "signature"
// identifica il lotto (id della ricerca "Ovunque" più recente): se cambia — nuova
// ricerca "Ovunque" con risultati diversi — si riparte con un mazzo nuovo invece di
// continuare quello vecchio.
const STORAGE_KEY = "hero-rotation-v1";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Guarda quale sarà la PROSSIMA destinazione della rotazione senza consumarla dal mazzo
// (a differenza di pickRotatingDestination) — usata da Home per "preparare in anticipo"
// la foto successiva (precampionarne i colori, vedi heroColors.js) mentre l'app è ancora
// aperta, cosi' alla prossima apertura compare subito senza il flash sulla foto di default.
// Richiesto esplicitamente dall'utente. Ritorna null se il mazzo corrente è già esaurito
// (il prossimo giro rimescolerà una sequenza nuova, non prevedibile senza deciderla ora
// per davvero) — caso raro, accettato: capita solo all'esaurimento di un giro completo.
export function peekNextDestination(signature) {
  let state = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state = raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
  if (!state || state.signature !== signature) return null;
  return Array.isArray(state.bag) && state.bag.length > 0 ? state.bag[0] : null;
}

// Come pickRotatingDestination, ma SENZA il fallback "rimescola se il mazzo non
// corrisponde/è vuoto" — usata da Home per far avanzare la rotazione in modo SINCRONO,
// prima ancora di sapere (query Supabase, mai istantanea) quale sia davvero l'ultima
// ricerca. Il mazzo in localStorage è la stessa identica fonte usata da
// pickRotatingDestination, quindi se la firma corrisponde a quella che ha prodotto la
// foto mostrata l'ultima volta, il prossimo elemento del mazzo è esattamente quello che
// pickRotatingDestination sceglierebbe una volta caricati i dati veri — lo si consuma già
// ora cosi' la Home può partire direttamente dalla foto nuova (che era già stata
// precampionata via peekNextDestination + sampleHeroColors alla chiusura precedente),
// invece che da quella vecchia per poi cambiarla sotto agli occhi dell'utente.
// Ritorna null se il mazzo non corrisponde alla firma attesa o è vuoto (rimescolerà, non
// prevedibile in anticipo) — il chiamante ricade sulla foto precedente in quel caso, e la
// rotazione vera avverrà comunque, con un possibile cambio visibile, una volta noti i
// dati reali (stesso limite raro già accettato per peekNextDestination).
export function consumeNextRotationSync(signature) {
  if (!signature) return null;
  let state = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state = raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
  if (!state || state.signature !== signature || !Array.isArray(state.bag) || state.bag.length === 0) {
    return null;
  }
  const [next, ...rest] = state.bag;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ signature, bag: rest }));
  } catch {
    // Idem sotto: se non si riesce a salvare, la rotazione semplicemente non persiste,
    // nessun crash — si continua comunque a usare "next" per questa apertura.
  }
  return next;
}

export function pickRotatingDestination(signature, codes) {
  if (!codes || codes.length === 0) return null;
  if (codes.length === 1) return codes[0];

  let state = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state = raw ? JSON.parse(raw) : null;
  } catch {
    // localStorage non disponibile (navigazione privata, quota piena) — si procede
    // comunque con un mazzo nuovo ad ogni apertura, solo senza persistenza tra le sessioni.
    state = null;
  }

  let bag = state && state.signature === signature ? state.bag : null;
  if (!Array.isArray(bag) || bag.length === 0) {
    bag = shuffle(codes);
  }

  const [next, ...rest] = bag;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ signature, bag: rest }));
  } catch {
    // Idem sopra: se non si riesce a salvare, la rotazione semplicemente non persiste,
    // nessun crash.
  }

  return next;
}
