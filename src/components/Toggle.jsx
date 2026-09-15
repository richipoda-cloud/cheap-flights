import { COLORS } from "../theme/colors";

// Switch iOS-style: track pillola + thumb cerchio, verde quando ON.
export function Toggle({ checked, onChange }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      style={{
        width: 46,
        height: 26,
        borderRadius: 13,
        background: checked ? COLORS.accent : COLORS.hairline,
        position: "relative",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background 0.15s ease",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 22 : 2,
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "#FFFFFF",
          boxShadow: "0 1px 3px rgba(33,30,43,0.3)",
          transition: "left 0.15s ease",
        }}
      />
    </div>
  );
}
