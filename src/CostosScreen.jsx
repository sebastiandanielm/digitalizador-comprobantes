import { useState, useEffect } from "react";

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

const PROCESOS = ["Laser", "Soldado", "Conformado", "Grabado", "Producto propio", "Personales"];

const CATEGORIAS = {
  "Gastos producción": [
    "Aguas Argentinas", "Edenor", "Gas Natural", "ABL", "Seguridad e Higiene",
    "Ingresos Brutos", "Inmobiliario", "Autónomos", "Patente Strada",
    "Insumos anual", "Seguros", "Varios"
  ],
  "Gastos administrativos": [
    "Teléfono fijo", "Internet y celulares", "Hosting", "IVA Intereses",
    "Contador", "Programa contable", "Gastos extraordinarios",
    "Gastos bancarios", "Transportes", "Publicidad"
  ],
  "Sueldos": [
    "Sueldos", "Cargas sociales", "Seguro de vida y sepelio", "Servicios tercerizados"
  ],
  "Amortizaciones": ["Por máquina"],
  "Insumos oficina": ["Papelería", "Consumibles administrativos"],
  "Insumos industriales": ["Mantenimiento", "Eléctricos", "Seguridad", "Ferretería"],
};

const HORAS_MES = 21 * 8; // 168 horas

const fmtPeso = (n) => {
  if (!n && n !== 0) return "—";
  const num = typeof n === "string" ? parseFloat(n.replace(/\./g,"").replace(",",".")) : n;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(num);
};

const parsNum = (s) => {
  if (!s && s !== 0) return 0;
  if (typeof s === "number") return s;
  return parseFloat(String(s).replace(/\$/g,"").replace(/\./g,"").replace(",",".").trim()) || 0;
};

async function apiSheets(action, data, rowIndex) {
  const r = await fetch("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, data, rowIndex }),
  });
  return r.json();
}

// Obtener período actual como "MM/YYYY"
const getPeriodoActual = () => {
  const now = new Date();
  return `${String(now.getMonth()+1).padStart(2,"0")}/${now.getFullYear()}`;
};

// Obtener lista de últimos 12 períodos
const getPeriodos = () => {
  const periodos = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periodos.push(`${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`);
  }
  return periodos;
};

export default function CostosScreen({ onVolver }) {
  const [tab, setTab]               = useState("dashboard"); // "dashboard" | "carga" | "historial"
  const [periodo, setPeriodo]       = useState(getPeriodoActual());
  const [costos, setCostos]         = useState([]);
  const [amortizaciones, setAmortizaciones] = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [guardando, setGuardando]   = useState(false);

  // Estado para carga manual
  const [formCosto, setFormCosto]   = useState({
    periodo: getPeriodoActual(),
    categoria: "Gastos producción",
    subcategoria: "Edenor",
    monto: "",
    observaciones: "",
  });

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      const [costosData, amortData] = await Promise.all([
        apiSheets("get_costos"),
        apiSheets("get_amortizaciones"),
      ]);
      const costoRows = (costosData.values || []).slice(1);
      setCostos(costoRows.map((r, i) => ({
        _idx: i,
        periodo:        r[0] || "",
        proceso:        r[1] || "",
        categoria:      r[2] || "",
        subcategoria:   r[3] || "",
        monto:          parsNum(r[4]),
        costo_hora:     parsNum(r[5]),
        observaciones:  r[6] || "",
      })));

      const amortRows = (amortData.values || []).slice(1);
      setAmortizaciones(amortRows.map(r => ({
        cantidad:   parsNum(r[0]),
        maquina:    r[1] || "",
        proceso:    r[2] || "",
        precio_usd: r[3] || "",
        precio_ars: parsNum(r[5]),
        anos:       r[6] || "",
        fecha:      r[7] || "",
        valor_actual: parsNum(r[8]),
        amort_hora:   parsNum(r[9]),
      })));
    } catch(e) { console.error(e); }
    setCargando(false);
  };

  // Calcular costos del período seleccionado
  const costosPeriodo = costos.filter(c => c.periodo === periodo);

  // Total por categoría para el período
  const totalPorCategoria = {};
  Object.keys(CATEGORIAS).forEach(cat => { totalPorCategoria[cat] = 0; });
  costosPeriodo.forEach(c => {
    if (totalPorCategoria[c.categoria] !== undefined) {
      totalPorCategoria[c.categoria] += c.monto;
    }
  });

  // Amortización mensual total por proceso (desde hoja Amortizaciones)
  const amortPorProceso = {};
  PROCESOS.forEach(p => { amortPorProceso[p] = 0; });
  amortizaciones.forEach(a => {
    if (amortPorProceso[a.proceso] !== undefined) {
      amortPorProceso[a.proceso] += a.amort_hora * HORAS_MES;
    }
  });

  // Total general del período
  const totalMes = Object.values(totalPorCategoria).reduce((s, v) => s + v, 0)
    + Object.values(amortPorProceso).reduce((s, v) => s + v, 0);

  // Costo hora por proceso (distribución igualitaria)
  const costoPorProceso = {};
  PROCESOS.forEach(p => {
    const costoCompartido = totalMes / PROCESOS.length;
    const amortPropio = amortPorProceso[p] || 0;
    costoPorProceso[p] = (costoCompartido + amortPropio) / HORAS_MES;
  });

  // Guardar costo manual
  const guardarCosto = async () => {
    if (!formCosto.monto) return alert("Ingresá el monto");
    setGuardando(true);
    try {
      const row = [
        formCosto.periodo,
        "Todos", // se distribuye a todos los procesos
        formCosto.categoria,
        formCosto.subcategoria,
        formCosto.monto,
        "", // costo_hora se calcula
        formCosto.observaciones,
      ];
      await apiSheets("append_costo", row);
      await cargar();
      setFormCosto(prev => ({ ...prev, monto: "", observaciones: "" }));
      alert("Costo guardado correctamente");
    } catch(e) { console.error(e); }
    setGuardando(false);
  };

  // Historial — agrupar por período
  const periodos = [...new Set(costos.map(c => c.periodo))].sort().reverse();
  const totalPorPeriodo = periodos.map(p => {
    const total = costos.filter(c => c.periodo === p).reduce((s, c) => s + c.monto, 0);
    return { periodo: p, total };
  });

  const ss = { background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" };

  if (cargando) return (
    <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>⏳ Cargando costos...</div>
  );

  return (
    <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <button onClick={onVolver}
          style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          ← Volver
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 22, color: C.navy }}>📊 Costos</div>
          <div style={{ color: C.textMuted, fontSize: 13 }}>Costo hora por proceso · Evolución histórica</div>
        </div>
        <select value={periodo} onChange={e => setPeriodo(e.target.value)} style={ss}>
          {getPeriodos().map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 24, background: C.white, borderRadius: 12, overflow: "hidden", boxShadow: C.shadow }}>
        {[
          { key: "dashboard", label: "📊 Dashboard" },
          { key: "carga",     label: "➕ Cargar costo" },
          { key: "historial", label: "📋 Historial" },
        ].map((t, i) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ flex: 1, padding: "14px", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13,
              background: tab === t.key ? C.accent : C.white,
              color: tab === t.key ? "#fff" : C.textMuted,
              borderRight: i < 2 ? `1px solid ${C.border}` : "none" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab === "dashboard" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Costo hora por proceso */}
          <div style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, background: C.navy }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>💰 Costo hora por proceso — {periodo}</div>
              <div style={{ fontSize: 12, color: "#7a9cc8", marginTop: 4 }}>Base: 21 días × 8 horas = 168 hs/mes</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0 }}>
              {PROCESOS.map((p, i) => (
                <div key={p} style={{ padding: "20px 24px", borderRight: i % 3 < 2 ? `1px solid ${C.border}` : "none", borderBottom: i < 3 ? `1px solid ${C.border}` : "none" }}>
                  <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>{p}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: C.accent }}>{fmtPeso(costoPorProceso[p])}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>por hora</div>
                  {amortPorProceso[p] > 0 && (
                    <div style={{ fontSize: 11, color: C.textSec, marginTop: 8, background: C.bg, borderRadius: 6, padding: "4px 8px" }}>
                      Amort. {fmtPeso(amortPorProceso[p] / HORAS_MES)}/hs
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ padding: "14px 20px", borderTop: `2px solid ${C.border}`, background: C.bg, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, color: C.navy }}>Total costos del mes</span>
              <span style={{ fontWeight: 800, fontSize: 18, color: C.accent }}>{fmtPeso(totalMes)}</span>
            </div>
          </div>

          {/* Detalle por categoría */}
          <div style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: 15, color: C.navy }}>
              Detalle de costos — {periodo}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: C.bg, borderBottom: `2px solid ${C.border}` }}>
                  {["Categoría", "Monto", "% del total", "Costo hora"].map(h => (
                    <th key={h} style={{ padding: "10px 20px", textAlign: "left", color: C.textMuted, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(totalPorCategoria).map(([cat, monto], i) => (
                  <tr key={cat} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "12px 20px", fontWeight: 600, fontSize: 14 }}>{cat}</td>
                    <td style={{ padding: "12px 20px", fontSize: 14, fontWeight: 700 }}>{fmtPeso(monto)}</td>
                    <td style={{ padding: "12px 20px", fontSize: 13, color: C.textSec }}>
                      {totalMes > 0 ? `${((monto / totalMes) * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td style={{ padding: "12px 20px", fontSize: 13, color: C.accent, fontWeight: 700 }}>
                      {fmtPeso(monto / PROCESOS.length / HORAS_MES)}/hs
                    </td>
                  </tr>
                ))}
                {/* Amortizaciones */}
                <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.accentBg }}>
                  <td style={{ padding: "12px 20px", fontWeight: 600, fontSize: 14 }}>Amortizaciones</td>
                  <td style={{ padding: "12px 20px", fontSize: 14, fontWeight: 700 }}>
                    {fmtPeso(Object.values(amortPorProceso).reduce((s, v) => s + v, 0))}
                  </td>
                  <td style={{ padding: "12px 20px", fontSize: 13, color: C.textSec }}>
                    {totalMes > 0 ? `${((Object.values(amortPorProceso).reduce((s,v)=>s+v,0) / totalMes) * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td style={{ padding: "12px 20px", fontSize: 13, color: C.accent, fontWeight: 700 }}>Variable por proceso</td>
                </tr>
                <tr style={{ background: C.navy }}>
                  <td style={{ padding: "14px 20px", fontWeight: 800, fontSize: 15, color: "#fff" }}>TOTAL</td>
                  <td style={{ padding: "14px 20px", fontWeight: 800, fontSize: 15, color: C.accent }}>{fmtPeso(totalMes)}</td>
                  <td style={{ padding: "14px 20px", color: "#7a9cc8", fontSize: 13 }}>100%</td>
                  <td style={{ padding: "14px 20px", color: "#7a9cc8", fontSize: 13 }}>{fmtPeso(totalMes / PROCESOS.length / HORAS_MES)}/hs promedio</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Detalle subcategorías */}
          {costosPeriodo.length > 0 && (
            <div style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: 15, color: C.navy }}>
                Detalle por subcategoría
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: C.bg, borderBottom: `2px solid ${C.border}` }}>
                    {["Categoría", "Subcategoría", "Monto", "Observaciones"].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: C.textMuted, fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {costosPeriodo.map((c, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f5f7ff"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "10px 16px", fontSize: 13 }}>
                        <span style={{ background: C.accentBg, color: C.accent, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{c.categoria}</span>
                      </td>
                      <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600 }}>{c.subcategoria}</td>
                      <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700 }}>{fmtPeso(c.monto)}</td>
                      <td style={{ padding: "10px 16px", fontSize: 12, color: C.textSec }}>{c.observaciones || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {costosPeriodo.length === 0 && (
            <div style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, padding: 40, textAlign: "center", color: C.textMuted }}>
              No hay costos cargados para el período {periodo}.<br/>
              <span style={{ fontSize: 13 }}>Los costos se cargan automáticamente desde el Digitalizador o manualmente desde la pestaña "Cargar costo".</span>
            </div>
          )}
        </div>
      )}

      {/* ── CARGA MANUAL ── */}
      {tab === "carga" && (
        <div style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, padding: 28, maxWidth: 600 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: C.navy, marginBottom: 20 }}>➕ Cargar costo manualmente</div>
          <div style={{ background: C.warningBg, border: `1px solid ${C.warning}44`, borderRadius: 8, padding: "10px 16px", marginBottom: 20, fontSize: 13, color: C.warning }}>
            ⚠ Usá esta opción solo cuando no tengas documento digital. Los costos del Digitalizador se clasifican automáticamente.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Período</div>
              <select value={formCosto.periodo} onChange={e => setFormCosto(p => ({...p, periodo: e.target.value}))}
                style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, background: C.bg }}>
                {getPeriodos().map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Categoría</div>
              <select value={formCosto.categoria}
                onChange={e => setFormCosto(p => ({...p, categoria: e.target.value, subcategoria: CATEGORIAS[e.target.value][0]}))}
                style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, background: C.bg }}>
                {Object.keys(CATEGORIAS).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Subcategoría</div>
              <select value={formCosto.subcategoria} onChange={e => setFormCosto(p => ({...p, subcategoria: e.target.value}))}
                style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, background: C.bg }}>
                {(CATEGORIAS[formCosto.categoria] || []).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Monto ($)</div>
              <input type="number" value={formCosto.monto} onChange={e => setFormCosto(p => ({...p, monto: e.target.value}))}
                placeholder="Ej: 45000"
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14 }} />
            </div>

            <div>
              <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Observaciones</div>
              <input value={formCosto.observaciones} onChange={e => setFormCosto(p => ({...p, observaciones: e.target.value}))}
                placeholder="Ej: Factura Edenor enero 2026"
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14 }} />
            </div>

            <button onClick={guardarCosto} disabled={guardando}
              style={{ background: guardando ? "#ccc" : C.accent, color: "#fff", border: "none", borderRadius: 8, padding: "12px 0", fontWeight: 700, fontSize: 14, cursor: guardando ? "not-allowed" : "pointer" }}>
              {guardando ? "⏳ Guardando..." : "💾 Guardar costo"}
            </button>
          </div>
        </div>
      )}

      {/* ── HISTORIAL ── */}
      {tab === "historial" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: 15, color: C.navy }}>
              Evolución de costos por período
            </div>
            {totalPorPeriodo.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>No hay datos históricos aún</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: C.bg, borderBottom: `2px solid ${C.border}` }}>
                    {["Período", "Total costos", "Costo hora promedio", "vs. anterior"].map(h => (
                      <th key={h} style={{ padding: "10px 20px", textAlign: "left", color: C.textMuted, fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {totalPorPeriodo.map((p, i) => {
                    const anterior = totalPorPeriodo[i+1]?.total || 0;
                    const diff = anterior > 0 ? ((p.total - anterior) / anterior * 100) : 0;
                    return (
                      <tr key={p.periodo}
                        style={{ borderBottom: `1px solid ${C.border}`, background: p.periodo === periodo ? C.accentBg : "transparent", cursor: "pointer" }}
                        onClick={() => { setPeriodo(p.periodo); setTab("dashboard"); }}
                        onMouseEnter={e => { if (p.periodo !== periodo) e.currentTarget.style.background = "#f5f7ff"; }}
                        onMouseLeave={e => { if (p.periodo !== periodo) e.currentTarget.style.background = "transparent"; }}>
                        <td style={{ padding: "12px 20px", fontWeight: 700, fontSize: 14 }}>{p.periodo}</td>
                        <td style={{ padding: "12px 20px", fontSize: 14, fontWeight: 700, color: C.accent }}>{fmtPeso(p.total)}</td>
                        <td style={{ padding: "12px 20px", fontSize: 13, color: C.textSec }}>{fmtPeso(p.total / PROCESOS.length / HORAS_MES)}/hs</td>
                        <td style={{ padding: "12px 20px", fontSize: 13 }}>
                          {anterior > 0 ? (
                            <span style={{ color: diff > 0 ? C.danger : C.success, fontWeight: 700 }}>
                              {diff > 0 ? "↑" : "↓"} {Math.abs(diff).toFixed(1)}%
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
