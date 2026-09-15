import { useNavigate } from "react-router-dom";
import { Card } from "../components/Card";
import { COLORS } from "../theme/colors";

function BigCard({ title, subtitle, onClick, style }) {
  return (
    <Card onClick={onClick} style={{ padding: 24, ...style }}>
      <div style={{ fontWeight: 600, fontSize: 20, color: COLORS.ink, marginBottom: 4 }}>
        {title}
      </div>
      {subtitle && <div style={{ fontSize: 13, color: COLORS.inkSoft }}>{subtitle}</div>}
    </Card>
  );
}

export function Home() {
  const navigate = useNavigate();

  return (
    // Su viewport larghi/alti (desktop) le 4 card da sole lasciavano un vuoto enorme
    // sotto, ancorate in cima. Centrando verticalmente e limitando la larghezza si
    // ottiene una composizione bilanciata invece di uno stretch edge-to-edge vuoto.
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 16 }}>
        <BigCard
          title="Cerca voli"
          subtitle="Destinazione e date libere"
          onClick={() => navigate("/search")}
        />

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <BigCard title="Preferiti" onClick={() => navigate("/favorites")} style={{ padding: 16 }} />
          </div>
          <div style={{ flex: 1 }}>
            <BigCard title="Storico" onClick={() => navigate("/history")} style={{ padding: 16 }} />
          </div>
        </div>

        <BigCard
          title="Suggeriti per te"
          subtitle="In base alle tue ricerche passate"
          onClick={() => navigate("/suggestions")}
        />
      </div>
    </div>
  );
}
