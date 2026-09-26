import { useState, useEffect, useRef } from "react";

const C = {
  bg: "#f0f2f7", white: "#ffffff", border: "#e2e6f0",
  accent: "#0aada8", accentDark: "#088c88", accentBg: "#e6f7f7",
  navy: "#0d1f3c", navyLight: "#1a3360",
  success: "#27ae60", successBg: "#eafaf1",
  warning: "#e67e22", warningBg: "#fef5ec",
  danger: "#e74c3c", dangerBg: "#fdf0ef",
  blue: "#2980b9", blueBg: "#eaf4fb",
  text: "#1a1a2e", textSec: "#5a6278", textMuted: "#9aa0b4",
  shadow: "0 2px 12px rgba(0,0,0,0.08)",
  shadowLg: "0 8px 32px rgba(0,0,0,0.13)",
};

// Módulos del sistema — disponibles y próximos
const MODULOS = [
  // Disponibles
  { key: "digitalizador", label: "Digitalizador", icon: "📄", desc: "Subí facturas, DDJJ y comprobantes. La IA los lee automáticamente.", disponible: true,
    keywords: ["digitalizar","factura","comprobante","subir","cargar","pdf","imagen","ddjj","recibo"] },
  { key: "pagos", label: "Pagos", icon: "💳", desc: "Generá órdenes de pago a proveedores y optimizá el uso de cheques.", disponible: true,
    keywords: ["pago","orden de pago","pagar","proveedor","cheque","transferencia","echeq"] },
  { key: "cheques", label: "Cheques", icon: "🏦", desc: "Gestioná la cartera de eCheques de terceros recibidos.", disponible: true,
    keywords: ["cheque","cartera","echeq","terceros","depositar","endoso"] },
  { key: "contactos", label: "Contactos", icon: "👥", desc: "Administrá proveedores, clientes y organismos con sus datos fiscales.", disponible: true,
    keywords: ["contacto","proveedor","cliente","cuit","organismo","banco","cbu"] },
  // Próximos
  { key: "costos", label: "Costos", icon: "📊", desc: "Analizá costos por categoría: impuestos, sueldos, servicios, materiales.", disponible: true,
    keywords: ["costo","gasto","analisis","categoria","material","sueldo","impuesto"] },
  { key: "cc_proveedores", label: "Cta. Cte. Proveedores", icon: "📋", desc: "Saldo y facturas pendientes por proveedor.", disponible: false,
    keywords: ["cuenta corriente","saldo proveedor","deuda","pendiente","proveedor"] },
  { key: "cc_clientes", label: "Cta. Cte. Clientes", icon: "👤", desc: "Saldo y cobranzas pendientes por cliente.", disponible: false,
    keywords: ["cuenta corriente cliente","cobranza","saldo cliente","cobrar"] },
  { key: "compras", label: "Listado de Compras", icon: "🛒", desc: "Historial y análisis de compras por insumo y proveedor.", disponible: false,
    keywords: ["compra","insumo","materia prima","listado compras","precio"] },
  { key: "ventas", label: "Listado de Ventas", icon: "💼", desc: "Historial de ventas y facturación a clientes.", disponible: false,
    keywords: ["venta","facturacion","cliente","listado ventas","remito"] },
  { key: "presupuestos", label: "Presupuestos", icon: "📝", desc: "Armá presupuestos para clientes usando costos reales de producción.", disponible: false,
    keywords: ["presupuesto","cotizacion","cliente","precio","oferta"] },
];

export default function HomeScreen({ onNavegar, buscadorConfig }) {
  const [busq, setBusq] = useState("");
  const [resultados, setResultados] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef();

  // Combinar keywords fijas con las configuradas por el operador
  const modulosConKeywords = MODULOS.map(m => {
    const config = buscadorConfig?.find(c => c.key === m.key);
    const keywordsExtra = config?.keywords || [];
    return { ...m, keywords: [...m.keywords, ...keywordsExtra] };
  });

  const buscar = (texto) => {
    setBusq(texto);
    if (!texto.trim()) { setResultados([]); setShowResults(false); return; }
    const s = texto.toLowerCase();
    const matches = modulosConKeywords.filter(m =>
      m.label.toLowerCase().includes(s) ||
      m.keywords.some(k => k.toLowerCase().includes(s))
    );
    setResultados(matches);
    setShowResults(true);
  };

  const navegar = (key) => {
    setBusq("");
    setResultados([]);
    setShowResults(false);
    onNavegar(key);
  };

  const disponibles = modulosConKeywords.filter(m => m.disponible);
  const proximos = modulosConKeywords.filter(m => !m.disponible);

  return (
    <div style={{ minHeight: "calc(100vh - 58px)", background: C.bg, padding: "32px 24px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>

        {/* Bienvenida */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👋</div>
          <div style={{ fontWeight: 800, fontSize: 26, color: C.navy, marginBottom: 8 }}>Bienvenido a MICOFY</div>
          <div style={{ color: C.textSec, fontSize: 15 }}>¿Qué querés hacer hoy?</div>
        </div>

        {/* Buscador */}
        <div style={{ position: "relative", maxWidth: 600, margin: "0 auto 40px" }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 18, color: C.textMuted }}>🔍</span>
            <input
              ref={inputRef}
              value={busq}
              onChange={e => buscar(e.target.value)}
              onFocus={() => busq && setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 150)}
              placeholder="Buscá una función... ej: orden de pago, digitalizar factura"
              style={{ width: "100%", boxSizing: "border-box", padding: "16px 20px 16px 48px", border: `2px solid ${busq ? C.accent : C.border}`, borderRadius: 14, fontSize: 15, color: C.text, background: C.white, outline: "none", boxShadow: busq ? `0 0 0 3px ${C.accent}22` : C.shadow, transition: "all .2s" }}
            />
            {busq && (
              <button onClick={() => { setBusq(""); setResultados([]); setShowResults(false); inputRef.current.focus(); }}
                style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 18 }}>✕</button>
            )}
          </div>

          {/* Resultados del buscador */}
          {showResults && resultados.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, background: C.white, borderRadius: 12, boxShadow: C.shadowLg, border: `1px solid ${C.border}`, zIndex: 100, overflow: "hidden" }}>
              {resultados.map((m, i) => (
                <div key={m.key} onMouseDown={() => navegar(m.key)}
                  style={{ padding: "14px 18px", cursor: m.disponible ? "pointer" : "default", display: "flex", alignItems: "center", gap: 14, borderBottom: i < resultados.length - 1 ? `1px solid ${C.border}` : "none", background: "transparent", transition: "background .1s" }}
                  onMouseEnter={e => { if (m.disponible) e.currentTarget.style.background = C.accentBg; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                  <span style={{ fontSize: 24 }}>{m.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.navy }}>{m.label}</div>
                    <div style={{ fontSize: 12, color: C.textSec }}>{m.desc}</div>
                  </div>
                  {m.disponible
                    ? <span style={{ background: C.accent, color: "#fff", borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>Ir →</span>
                    : <span style={{ background: C.bg, color: C.textMuted, borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>Próximamente</span>
                  }
                </div>
              ))}
            </div>
          )}

          {showResults && busq && resultados.length === 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, background: C.white, borderRadius: 12, boxShadow: C.shadowLg, border: `1px solid ${C.border}`, zIndex: 100, padding: "20px", textAlign: "center", color: C.textMuted }}>
              No se encontró ninguna función para "<strong>{busq}</strong>".<br/>
              <span style={{ fontSize: 12 }}>Podés agregar palabras clave en ⚙ Configuración.</span>
            </div>
          )}
        </div>

        {/* Módulos disponibles */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Módulos activos</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
            {disponibles.map(m => (
              <div key={m.key} onClick={() => navegar(m.key)}
                style={{ background: C.white, borderRadius: 14, padding: "22px 20px", cursor: "pointer", border: `2px solid transparent`, boxShadow: C.shadow, transition: "all .2s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = C.shadowLg; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = C.shadow; }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>{m.icon}</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: C.navy, marginBottom: 6 }}>{m.label}</div>
                <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.5 }}>{m.desc}</div>
                <div style={{ marginTop: 14, color: C.accent, fontWeight: 700, fontSize: 13 }}>Abrir →</div>
              </div>
            ))}
          </div>
        </div>

        {/* Módulos próximos */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>En desarrollo</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
            {proximos.map(m => (
              <div key={m.key}
                style={{ background: C.white, borderRadius: 14, padding: "22px 20px", border: `2px dashed ${C.border}`, boxShadow: "none", opacity: 0.7 }}>
                <div style={{ fontSize: 36, marginBottom: 12, filter: "grayscale(1)" }}>{m.icon}</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: C.textSec, marginBottom: 6 }}>{m.label}</div>
                <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>{m.desc}</div>
                <div style={{ marginTop: 14 }}>
                  <span style={{ background: C.bg, color: C.textMuted, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700 }}>🔒 Próximamente</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
