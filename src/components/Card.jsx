import { COLORS, RADIUS, SHADOW } from "../theme/colors";

export function Card({ children, selected = false, onClick, style }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.hairline}`,
        borderRadius: RADIUS.card,
        overflow: "hidden",
        boxShadow: selected ? SHADOW.selectedCard() : "none",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
