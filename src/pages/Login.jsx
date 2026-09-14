import { COLORS, RADIUS } from "../theme/colors";
import { useAuth } from "../hooks/useAuth";

export function Login() {
  const { signInWithGoogle } = useAuth();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: COLORS.surface,
          borderRadius: RADIUS.card,
          padding: 32,
          width: "100%",
          maxWidth: 360,
          border: `1px solid ${COLORS.hairline}`,
          textAlign: "center",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 30, color: COLORS.ink, marginBottom: 6 }}>
          Cheap Flights
        </div>
        <div style={{ fontSize: 13, color: COLORS.inkSoft, marginBottom: 24, lineHeight: 1.4 }}>
          Trova il volo A/R più economico, ovunque e in qualsiasi data.
        </div>
        <button
          onClick={signInWithGoogle}
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: 13,
            color: "#fff",
            background: COLORS.accent,
            border: "none",
            borderRadius: RADIUS.button,
            padding: "11px 18px",
            width: "100%",
            cursor: "pointer",
          }}
        >
          Accedi con Google
        </button>
      </div>
    </div>
  );
}
