import { COLORS, RADIUS, SHADOW } from "../theme/colors";

// variant: "outline" (default, come PrimaryButton guardaroba) | "solid" (CTA verde piena)
export function PrimaryButton({ children, onClick, variant = "outline", disabled, style }) {
  const base = {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: "0.01em",
    borderRadius: RADIUS.button,
    padding: "11px 18px",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    cursor: disabled ? "default" : "pointer",
    ...style,
  };

  if (disabled) {
    return (
      <button
        disabled
        style={{ ...base, background: "#B9C2AE", color: "#fff", border: "none" }}
      >
        {children}
      </button>
    );
  }

  if (variant === "solid") {
    return (
      <button
        onClick={onClick}
        style={{
          ...base,
          background: COLORS.accent,
          color: "#fff",
          border: "none",
          boxShadow: SHADOW.ctaButton,
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      style={{
        ...base,
        color: COLORS.ink,
        background: "transparent",
        border: `1px solid ${COLORS.hairline}`,
      }}
    >
      {children}
    </button>
  );
}
