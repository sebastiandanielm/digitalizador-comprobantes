import { useState, useEffect } from "react";
import OrdenPagoScreen from "./OrdenPagoScreen.jsx";
import HistorialOrdenesScreen from "./HistorialOrdenesScreen.jsx";

const C = {
  bg: "#f0f2f7", white: "#ffffff", border: "#e2e6f0",
  accent: "#0aada8", accentDark: "#088c88", accentBg: "#e6f7f7",
  navy: "#0d1f3c", navyLight: "#1a3360",
  success: "#27ae60", successBg: "#eafaf1",
  warning: "#e67e22", warningBg: "#fef5ec",
  text: "#1a1a2e", textSec: "#5a6278", textMuted: "#9aa0b4",
  shadow: "0 2px 12px rgba(0,0,0,0.08)",
  shadowLg: "0 8px 32px rgba(0,0,0,0.13)",
};

export default function PagosScreen({ onVolver }) {
  const [vista, setVista] = useState("menu"); // "menu" | "nueva" | "historial"

  if (vista === "nueva") {
    return <OrdenPagoScreen onVolver={() => setVista("menu")} />;
  }

  if (vista === "historial") {
    return <HistorialOrdenesScreen onVolver={() => setVista("menu")} />;
  }

  // ── Menú principal ──
  return (
    <div style={{ padding: "32px 24px", maxWidth: 800, margin: "0 auto" }}>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 32 }}>
        <button onClick={onVolver}
          style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          ← Volver
        </button>
        <div>
          <div style={{ fontWeight: 800, fontSize: 24, color: C.navy }}>💳 Pagos</div>
          <div style={{ color: C.textMuted, fontSize: 13 }}>Gestión de órdenes de pago a proveedores</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {/* Nueva orden */}
        <div onClick={() => setVista("nueva")}
          style={{ background: C.white, borderRadius: 16, boxShadow: C.shadowLg, padding: 32, cursor: "pointer", border: `2px solid transparent`, transition: "all .2s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.transform = "translateY(-2px)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.transform = "translateY(0)"; }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: C.navy, marginBottom: 8 }}>Nueva orden de pago</div>
          <div style={{ fontSize: 14, color: C.textSec, lineHeight: 1.6 }}>
            Seleccioná un proveedor, elegí las facturas a pagar y el sistema optimiza automáticamente los cheques disponibles.
          </div>
          <div style={{ marginTop: 20, display: "inline-block", background: C.accent, color: "#fff", borderRadius: 8, padding: "10px 20px", fontWeight: 700, fontSize: 14 }}>
            Crear orden →
          </div>
        </div>

        {/* Historial */}
        <div onClick={() => setVista("historial")}
          style={{ background: C.white, borderRadius: 16, boxShadow: C.shadowLg, padding: 32, cursor: "pointer", border: `2px solid transparent`, transition: "all .2s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.navy; e.currentTarget.style.transform = "translateY(-2px)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.transform = "translateY(0)"; }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: C.navy, marginBottom: 8 }}>Órdenes generadas</div>
          <div style={{ fontSize: 14, color: C.textSec, lineHeight: 1.6 }}>
            Buscá y filtrá órdenes existentes por proveedor, fecha o número. Ver detalle completo y editar si es necesario.
          </div>
          <div style={{ marginTop: 20, display: "inline-block", background: C.navy, color: "#fff", borderRadius: 8, padding: "10px 20px", fontWeight: 700, fontSize: 14 }}>
            Ver historial →
          </div>
        </div>

      </div>
    </div>
  );
}
