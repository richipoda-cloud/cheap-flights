import { COLORS, RADIUS } from "../theme/colors";

// Pillola/badge, pattern Tag del guardaroba. tone: "accent" | "plum" | "neutral"
export function Pill({ children, tone = "neutral", active = false, onClick }) {
  const isInteractive = typeof onClick === "function";
  const activeAccent = active || tone === "accent";
  const background = activeAccent
    ? COLORS.accentSoft
    : tone === "plum"
    ? COLORS.plumSoft
    : "transparent";
  const color = activeAccent ? COLORS.accent : tone === "plum" ? COLORS.plum : COLORS.inkSoft;

  return (
    <span
      onClick={onClick}
      style={{
        fontFamily: "'Inter', sans-serif",
        fontWeight: 600,
        fontSize: 11.5,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        background,
        color,
        padding: "3px 8px",
        borderRadius: RADIUS.pill,
        display: "inline-block",
        whiteSpace: "nowrap",
        cursor: isInteractive ? "pointer" : "default",
        border: activeAccent ? "none" : `1px solid ${COLORS.hairline}`,
      }}
    >
      {children}
    </span>
  );
}
