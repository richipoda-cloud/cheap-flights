import { useRef, useState } from "react";
import { COLORS } from "../theme/colors";

const DELETE_WIDTH = 76;
const OPEN_THRESHOLD = DELETE_WIDTH / 2;

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
            background: COLORS.warn,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(33,30,43,0.25)",
          }}
        >
          <span style={{ fontSize: 18 }}>🗑️</span>
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
