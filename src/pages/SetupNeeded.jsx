import { COLORS, RADIUS } from "../theme/colors";

// Mostrata al posto di un crash a schermo bianco quando mancano le env var Supabase
// (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) — es. primo deploy Vercel prima del setup.
export function SetupNeeded() {
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
          maxWidth: 420,
          border: `1px solid ${COLORS.hairline}`,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 22, color: COLORS.ink, marginBottom: 10 }}>
          Configurazione mancante
        </div>
        <div style={{ fontSize: 13, color: COLORS.inkSoft, lineHeight: 1.5 }}>
          Servono le variabili d'ambiente del progetto Supabase:
          <br />
          <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code>
          <br />
          <br />
          In locale: copia <code>.env.example</code> in <code>.env</code>. Su Vercel: Settings →
          Environment Variables, poi Redeploy.
        </div>
      </div>
    </div>
  );
}
