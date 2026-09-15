import { COLORS } from "../theme/colors";

const MAX_NIGHTS = 14;

// Slider a due maniglie per la durata soggiorno — due <input type="range"> sovrapposti,
// z-index alternato in base a quale maniglia è più vicina al bordo per restare
// trascinabile anche quando i due valori si avvicinano. Stile in theme/fonts.css.
export function DualRangeSlider({ min, max, onChange }) {
  const lo = min ?? 0;
  const hi = max ?? MAX_NIGHTS;

  const setLo = (v) => onChange(Math.min(Number(v), hi), hi);
  const setHi = (v) => onChange(lo, Math.max(Number(v), lo));

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, marginBottom: 10 }}>
        {lo} — {hi === MAX_NIGHTS ? `${MAX_NIGHTS}+` : hi} notti
      </div>
      <div className="dual-range">
        <input
          type="range"
          min={0}
          max={MAX_NIGHTS}
          value={lo}
          onChange={(e) => setLo(e.target.value)}
          style={{ zIndex: lo > MAX_NIGHTS - 2 ? 5 : 3 }}
        />
        <input
          type="range"
          min={0}
          max={MAX_NIGHTS}
          value={hi}
          onChange={(e) => setHi(e.target.value)}
          style={{ zIndex: 4 }}
        />
      </div>
    </div>
  );
}

export { MAX_NIGHTS };
