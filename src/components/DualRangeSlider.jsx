import { COLORS } from "../theme/colors";

// Espresso in GIORNI (non notti): 1 giorno = andata/ritorno in giornata (0 notti).
// giorni = notti + 1 — la conversione verso il filtro reale (in notti) avviene nel
// chiamante (Search.jsx) al momento dell'invio, qui si ragiona solo in giorni.
const MIN_DAYS = 1;
const MAX_DAYS = 15;

// Slider a due maniglie per la durata soggiorno — due <input type="range"> sovrapposti,
// z-index alternato in base a quale maniglia è più vicina al bordo per restare
// trascinabile anche quando i due valori si avvicinano. Stile in theme/fonts.css.
// Il range selezionato include sempre tutti i valori intermedi (es. 1–8 giorni copre
// anche 3, 5, 7 gg...), non solo gli estremi — il filtro lato server è già inclusivo.
export function DualRangeSlider({ min, max, onChange }) {
  const lo = min ?? MIN_DAYS;
  const hi = max ?? MAX_DAYS;

  const setLo = (v) => onChange(Math.min(Number(v), hi), hi);
  const setHi = (v) => onChange(lo, Math.max(Number(v), lo));

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, marginBottom: 10 }}>
        {lo} — {hi === MAX_DAYS ? `${MAX_DAYS}+` : hi} giorni
      </div>
      <div className="dual-range">
        <input
          type="range"
          min={MIN_DAYS}
          max={MAX_DAYS}
          value={lo}
          onChange={(e) => setLo(e.target.value)}
          style={{ zIndex: lo > MAX_DAYS - 2 ? 5 : 3 }}
        />
        <input
          type="range"
          min={MIN_DAYS}
          max={MAX_DAYS}
          value={hi}
          onChange={(e) => setHi(e.target.value)}
          style={{ zIndex: 4 }}
        />
      </div>
    </div>
  );
}

export { MIN_DAYS, MAX_DAYS };
