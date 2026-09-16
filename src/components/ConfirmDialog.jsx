import { COLORS, RADIUS } from "../theme/colors";
import { Card } from "./Card";
import { PrimaryButton } from "./PrimaryButton";

// Stesso rosso vero usato in SwipeToDelete — unica eccezione alla regola "mai rosso
// puro", riservata alle azioni distruttive. window.confirm() nativo del browser non
// aveva nessuna delle due, e stonava con tutto il resto dell'interfaccia.
const DELETE_RED = "#E5484D";

export function ConfirmDialog({ open, title, message, confirmLabel = "Conferma", onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(33,30,43,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 100,
      }}
    >
      <Card
        onClick={(e) => e.stopPropagation()}
        style={{ padding: 20, maxWidth: 340, width: "100%" }}
      >
        {title && (
          <div style={{ fontWeight: 600, fontSize: 16, color: COLORS.ink, marginBottom: 8 }}>{title}</div>
        )}
        {message && (
          <div style={{ fontSize: 13.5, color: COLORS.inkSoft, lineHeight: 1.5, marginBottom: 20 }}>
            {message}
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <PrimaryButton onClick={onCancel} style={{ flex: 1, justifyContent: "center" }}>
            Annulla
          </PrimaryButton>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              fontSize: 13,
              color: "#FFFFFF",
              background: DELETE_RED,
              border: "none",
              borderRadius: RADIUS.button,
              padding: "11px 18px",
              cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </Card>
    </div>
  );
}
