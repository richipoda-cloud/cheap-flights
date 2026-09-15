import { useRef, useState } from "react";
import { COLORS } from "../theme/colors";

const DELETE_WIDTH = 76;
const OPEN_THRESHOLD = DELETE_WIDTH / 2;
// Unico punto dell'app dove si usa un rosso vero (non COLORS.warn/terracotta): l'azione
// di eliminare è distruttiva e va riconoscibile subito, come lo swipe-delete iOS classico.
const DELETE_RED = "#E5484D";

// Icona cestino disegnata a mano (non emoji: il glifo 🗑️ ha colori propri del font,
// non controllabili via CSS — qui serve garantito bianco puro).
function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

// Trascina la riga a sinistra per rivelare il cestino rosso (pattern iOS classico) —
// touch per mobile, mouse drag per desktop/test. Il cestino resta coperto finché non
// si trascina oltre metà della sua larghezza, poi si aggancia aperto o richiuso.
export function SwipeToDelete({ children, onDelete }) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startOffset = useRef(0);

  const begin = (clientX) => {
    startX.current = clientX;
    startOffset.current = offset;
    setDragging(true);
  };

  const move = (clientX) => {
    if (!dragging) return;
    const delta = clientX - startX.current;
    const next = Math.min(0, Math.max(-DELETE_WIDTH, startOffset.current + delta));
    setOffset(next);
  };

  const end = () => {
    setDragging(false);
    setOffset(Math.abs(offset) > OPEN_THRESHOLD ? -DELETE_WIDTH : 0);
  };

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 14, marginBottom: 10 }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: DELETE_WIDTH,
          background: COLORS.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          onClick={onDelete}
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: DELETE_RED,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(33,30,43,0.25)",
          }}
        >
          <TrashIcon />
        </div>
      </div>
      <div
        onTouchStart={(e) => begin(e.touches[0].clientX)}
        onTouchMove={(e) => move(e.touches[0].clientX)}
        onTouchEnd={end}
        onMouseDown={(e) => begin(e.clientX)}
        onMouseMove={(e) => dragging && move(e.clientX)}
        onMouseUp={end}
        onMouseLeave={() => dragging && end()}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? "none" : "transform 0.2s ease",
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}
