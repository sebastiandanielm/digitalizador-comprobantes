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

const HORAS_DIA  = 9;
const DIAS_MES   = 21;
const HORAS_MES  = DIAS_MES * HORAS_DIA; // 189 hs

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

const getPeriodoActual = () => {
  const now = new Date();
  return `${String(now.getMonth()+1).padStart(2,"0")}/${now.getFullYear()}`;
};

const getPeriodos = () => {
  const periodos = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periodos.push(`${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`);
  }
  return periodos;
};

// Calcular costo/hora según periodicidad en días hábiles
// monto / diasHabiles / HORAS_DIA = costo por hora normalizado a 1 mes
// Luego multiplicamos por DIAS_MES para obtener el monto mensual equivalente
const costoHoraPorPeriodicidad = (monto, diasHabiles) => {
  const dias = parsNum(diasHabiles) || DIAS_MES; // default 21 si no tiene
  return monto / dias / HORAS_DIA;
};

export default function CostosScreen({ onVolver }) {
  const [tab, setTab]               = useState("dashboard");
  const [periodo, setPeriodo]       = useState(getPeriodoActual());
  const [costos, setCostos]         = useState([]);
  const [amortizaciones, setAmortizaciones] = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [guardando, setGuardando]   = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [msgProceso, setMsgProceso] = useState("");

  const [formCosto, setFormCosto] = useState({
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
      setCostos(costoRows.map((r) => ({
        periodo:        r[0] || "",
        proceso:        r[1] || "",
        categoria:      r[2] || "",
        subcategoria:   r[3] || "",
        monto:          parsNum(r[4]),
        costo_hora:     parsNum(r[5]),
        observaciones:  r[6] || "",
        dias_habiles:   parsNum(r[7]) || DIAS_MES, // col H — periodicidad en días hábiles
      })));

      const amortRows = (amortData.values || []).slice(1);
      setAmortizaciones(amortRows.map(r => ({
        maquina:      r[1] || "",
        proceso:      r[2] || "",
        valor_actual: parsNum(r[8]),
        amort_hora:   parsNum(r[9]),
      })));
    } catch(e) { console.error(e); }
    setCargando(false);
  };

  const costosPeriodo = costos.filter(c => c.periodo === periodo);

  // ── Info sueldos: detectar directos/indirectos por subcategoría guardada
  const calcularUnidadesSueldos = (cp) => {
    const directos   = new Set();
    const indirectos = new Set();
    cp.forEach(c => {
      if (c.categoria === "Sueldos") {
        const sub = (c.subcategoria || "").toLowerCase();
        if (sub.includes("directo"))   directos.add(c.subcategoria);
        else if (sub.includes("indirecto")) indirectos.add(c.subcategoria);
      }
    });
    const cantDirectos  = directos.size;
    const hayIndirectos = indirectos.size > 0 ? 1 : 0;
    const unidades      = cantDirectos + hayIndirectos;
    const horas         = unidades > 0 ? HORAS_MES * unidades : HORAS_MES;
    return { directos: cantDirectos, indirectos: indirectos.size, unidades, horas };
  };

  const sueldosInfo    = calcularUnidadesSueldos(costosPeriodo);
  const HORAS_SUELDOS  = sueldosInfo.horas;

  // ── Amortizaciones por proceso
  const amortPorProceso = {};
  PROCESOS.forEach(p => { amortPorProceso[p] = 0; });
  amortizaciones.forEach(a => {
    if (amortPorProceso[a.proceso] !== undefined) {
      amortPorProceso[a.proceso] += a.amort_hora * HORAS_MES;
    }
  });

  // ── Costo hora de sueldos (total sueldos del período ÷ HORAS_SUELDOS)
  // Los sueldos son siempre periodicidad 21 días (mensual), no aplica col U
  const totalSueldosPeriodo = (() => {
    const unicos = {};
    const counts = {};
    costosPeriodo.filter(c => c.categoria === "Sueldos").forEach(c => {
      if (!unicos[c.subcategoria]) { unicos[c.subcategoria] = 0; counts[c.subcategoria] = 0; }
      unicos[c.subcategoria] += c.monto;
      counts[c.subcategoria]++;
    });
    return Object.keys(unicos).reduce((s, k) => {
      return s + (counts[k] > 1 ? unicos[k] / counts[k] : unicos[k]);
    }, 0);
  })();
  const costoHoraSueldos = HORAS_SUELDOS > 0 ? totalSueldosPeriodo / HORAS_SUELDOS : 0;

  // ── Costo hora por proceso considerando periodicidad
  // Para cada registro: costo_hora = monto / dias_habiles / HORAS_DIA
  // Sueldos se manejan aparte (siempre 21 días × unidades)
  const costoHoraPorProceso = {};
  PROCESOS.forEach(p => { costoHoraPorProceso[p] = 0; });

  costosPeriodo.forEach(c => {
    if (c.categoria === "Sueldos") return; // sueldos van aparte
    if (costoHoraPorProceso[c.proceso] !== undefined) {
      // costo hora normalizado según periodicidad del contacto
      costoHoraPorProceso[c.proceso] += costoHoraPorPeriodicidad(c.monto, c.dias_habiles);
    }
  });

  // Sumar amortizaciones (siempre en base mensual)
  PROCESOS.forEach(p => {
    costoHoraPorProceso[p] += (amortPorProceso[p] || 0) / HORAS_MES;
  });

  // Agregar costo hora sueldos igual a todos los procesos
  PROCESOS.forEach(p => {
    costoHoraPorProceso[p] += costoHoraSueldos;
  });

  // ── Total por categoría (monto real, sin duplicar por procesos)
  const totalPorCategoria = {};
  Object.keys(CATEGORIAS).forEach(cat => { totalPorCategoria[cat] = 0; });

  // Para categorías con periodicidad: convertir a equivalente mensual
  // monto_mensual_equiv = costo_hora × HORAS_MES
  const subcatsVistas = {};
  costosPeriodo.forEach(c => {
    if (totalPorCategoria[c.categoria] === undefined) return;
    // Deduplicar por subcategoría (puede estar en varios procesos)
    if (!subcatsVistas[c.subcategoria]) {
      subcatsVistas[c.subcategoria] = true;
      if (c.categoria === "Sueldos") {
        totalPorCategoria[c.categoria] += c.monto;
      } else {
        // Convertir a equivalente mensual según periodicidad
        const ch = costoHoraPorPeriodicidad(c.monto, c.dias_habiles);
        totalPorCategoria[c.categoria] += ch * HORAS_MES;
      }
    }
  });

  const totalAmort = Object.values(amortPorProceso).reduce((s, v) => s + v, 0);
  const totalMes   = Object.values(totalPorCategoria).reduce((s, v) => s + v, 0) + totalAmort;

  // ── Costo hora promedio total
  const costoHoraPromedio = HORAS_MES > 0
    ? Object.values(costoHoraPorProceso).reduce((s, v) => s + v, 0) / PROCESOS.length
    : 0;

  // ── Procesar comprobantes
  const procesarPeriodoACostos = async () => {
    setProcesando(true);
    setMsgProceso("Leyendo comprobantes...");
    try {
      const compData = await apiSheets("get");
      const compRows = (compData.values || []).slice(1);
      const compPeriodo = compRows.filter(r => (r[16]||"") !== "");

      if (compPeriodo.length === 0) {
        setMsgProceso("⚠ No hay comprobantes para procesar");
        setProcesando(false);
        return;
      }

      setMsgProceso(`Encontré ${compPeriodo.length} comprobantes. Limpiando datos anteriores...`);
      await apiSheets("delete_costos_todos");

      // Leer contactos
      const ctData = await apiSheets("get_contactos");
      const ctRows = (ctData.values || []).slice(1);
      const contactosMap = {};
      ctRows.forEach(r => {
        const cuit = (r[1]||"").replace(/[-\s]/g,"");
        if (cuit) {
          if (!contactosMap[cuit]) contactosMap[cuit] = [];
          contactosMap[cuit].push({
            razon_social:         r[2]||"",
            nombre_fantasia:      r[3]||"",
            subtipo:              r[5]||"",   // col F — Directo/Indirecto para sueldos
            categoria_costo:      r[6]||"",   // col G
            distribucion_proceso: r[19]||"",  // col T
            periodicidad_dias:    parsNum(r[20]) || DIAS_MES, // col U — días hábiles
          });
        }
      });

      const subcatsExistentes = new Set();
      setMsgProceso("Clasificando y guardando en Costos...");

      let agregados = 0;
      let saltados  = 0;
      let sinClasif = 0;

      for (const row of compPeriodo) {
        const cuitEmisor   = (row[7]||"").replace(/[-\s]/g,"");
        const cuitReceptor = (row[9]||"").replace(/[-\s]/g,"");
        const totalStr     = (row[16]||"0").replace(/[$\s.]/g,"").replace(",",".");
        const total        = parseFloat(totalStr) || 0;
        const emisor       = row[6]||"";
        const estado       = row[21]||"";
        const subtipo      = row[49]||"";

        if (estado === "error") continue;
        if (total <= 0) continue;

        let contactosArr = contactosMap[cuitEmisor];
        if (!contactosArr || contactosArr.length === 0) {
          contactosArr = contactosMap[cuitReceptor];
        }
        if (!contactosArr || contactosArr.length === 0) { sinClasif++; continue; }

        let contactoMatch;
        if (subtipo) {
          contactoMatch = contactosArr.find(c =>
            c.subtipo.toLowerCase() === subtipo.toLowerCase()
          );
        }
        if (!contactoMatch) {
          contactoMatch = contactosArr.find(c => !c.subtipo) || contactosArr[0];
        }

        if (!contactoMatch || !contactoMatch.categoria_costo || !contactoMatch.distribucion_proceso) {
          sinClasif++;
          continue;
        }

        const procesos = contactoMatch.distribucion_proceso
          .split(",").map(p => p.trim()).filter(Boolean);

        if (procesos.length === 0) { sinClasif++; continue; }

        const subtipoContacto = contactoMatch.subtipo || "";
        const nombreBase  = contactoMatch.razon_social || contactoMatch.nombre_fantasia || emisor;
        const subcatKey   = subtipoContacto ? `${nombreBase} - ${subtipoContacto}` : nombreBase;
        const periodoReal = (row[18]||periodo).trim();
        const diasHabiles = contactoMatch.periodicidad_dias; // col U

        for (const proceso of procesos) {
          const key = `${periodoReal}|${subcatKey}|${proceso}`;
          if (subcatsExistentes.has(key)) { saltados++; continue; }

          // Guardamos monto completo + días hábiles → el cálculo de costo hora
          // se hace en el frontend con monto / dias_habiles / HORAS_DIA
          const filaData = [
            periodoReal,
            proceso,
            contactoMatch.categoria_costo,
            subcatKey,
            total,           // col E — monto original de la factura
            "",              // col F — costo_hora (se calcula en frontend)
            emisor,          // col G — observaciones
            diasHabiles,     // col H — periodicidad en días hábiles
          ];

          await apiSheets("append_costo", filaData);
          subcatsExistentes.add(key);
          agregados++;
        }
      }

      await cargar();
      setMsgProceso(
        `✓ Proceso completado: ${agregados} registros agregados · ${saltados} ya existían · ${sinClasif} sin clasificar en Contactos`
      );
      setTimeout(() => setMsgProceso(""), 8000);

    } catch(e) {
      console.error(e);
      setMsgProceso("⚠ Error: " + e.message);
    }
    setProcesando(false);
  };

  const guardarCosto = async () => {
    if (!formCosto.monto) return alert("Ingresá el monto");
    setGuardando(true);
    try {
      const row = [
        formCosto.periodo,
        "Todos",
        formCosto.categoria,
        formCosto.subcategoria,
        formCosto.monto,
        "",
        formCosto.observaciones,
        DIAS_MES, // periodicidad default mensual
      ];
      await apiSheets("append_costo", row);
      await cargar();
      setFormCosto(prev => ({ ...prev, monto: "", observaciones: "" }));
      alert("Costo guardado correctamente");
    } catch(e) { console.error(e); }
    setGuardando(false);
  };

  const periodos = [...new Set(costos.map(c => c.periodo))].sort().reverse();
  const totalPorPeriodo = periodos.map(p => {
    const cp = costos.filter(c => c.periodo === p);
    const sv = {};
    cp.forEach(c => {
      if (!sv[c.subcategoria]) sv[c.subcategoria] = { monto: c.monto, dias: c.dias_habiles, cat: c.categoria };
    });
    const total = Object.values(sv).reduce((s, v) => {
      if (v.cat === "Sueldos") return s + v.monto;
      return s + costoHoraPorPeriodicidad(v.monto, v.dias) * HORAS_MES;
    }, 0);
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

          {/* Banner sueldos */}
          {sueldosInfo.unidades > 0 && (
            <div style={{ background: C.accentBg, border: `1px solid ${C.accent}44`, borderRadius: 12, padding: "12px 20px", display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, color: C.accent, fontWeight: 700 }}>👷 Plantilla — {periodo}</div>
              <div style={{ fontSize: 13, color: C.textSec }}>Directos: <strong style={{ color: C.navy }}>{sueldosInfo.directos}</strong></div>
              <div style={{ fontSize: 13, color: C.textSec }}>Indirectos: <strong style={{ color: C.navy }}>{sueldosInfo.indirectos}</strong></div>
              <div style={{ fontSize: 13, color: C.textSec }}>Unidades: <strong style={{ color: C.navy }}>{sueldosInfo.unidades}</strong></div>
              <div style={{ fontSize: 13, color: C.textSec }}>
                Horas sueldos: <strong style={{ color: C.accent }}>{sueldosInfo.horas} hs</strong>
                <span style={{ color: C.textMuted }}> (189 × {sueldosInfo.unidades})</span>
              </div>
              <div style={{ fontSize: 13, color: C.textSec }}>
                Costo/hora sueldos: <strong style={{ color: C.accent }}>{fmtPeso(costoHoraSueldos)}/hs</strong>
              </div>
            </div>
          )}

          {/* Costo hora por proceso */}
          <div style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, background: C.navy }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>💰 Costo hora por proceso — {periodo}</div>
              <div style={{ fontSize: 12, color: "#7a9cc8", marginTop: 4 }}>
                Base: 21 días × 9 hs = 189 hs/mes · Sueldos: 189 × {sueldosInfo.unidades || "?"} unidades = {sueldosInfo.horas || "?"} hs
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0 }}>
              {PROCESOS.map((p, i) => (
                <div key={p} style={{ padding: "20px 24px", borderRight: i % 3 < 2 ? `1px solid ${C.border}` : "none", borderBottom: i < 3 ? `1px solid ${C.border}` : "none" }}>
                  <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>{p}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: C.accent }}>{fmtPeso(costoHoraPorProceso[p])}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>por hora</div>
                  {costoHoraSueldos > 0 && (
                    <div style={{ fontSize: 11, color: C.textSec, marginTop: 6, background: C.bg, borderRadius: 6, padding: "3px 8px" }}>
                      Sueldos: {fmtPeso(costoHoraSueldos)}/hs
                    </div>
                  )}
                  {amortPorProceso[p] > 0 && (
                    <div style={{ fontSize: 11, color: C.textSec, marginTop: 4, background: C.bg, borderRadius: 6, padding: "3px 8px" }}>
                      Amort: {fmtPeso(amortPorProceso[p] / HORAS_MES)}/hs
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ padding: "14px 20px", borderTop: `2px solid ${C.border}`, background: C.bg, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, color: C.navy }}>Total costos del mes (equiv. mensual)</span>
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
                  {["Categoría", "Monto equiv. mensual", "% del total", "Costo hora"].map(h => (
                    <th key={h} style={{ padding: "10px 20px", textAlign: "left", color: C.textMuted, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(totalPorCategoria).map(([cat, monto]) => {
                  const costoHoraCat = cat === "Sueldos"
                    ? (HORAS_SUELDOS > 0 ? monto / HORAS_SUELDOS : 0)
                    : monto / PROCESOS.length / HORAS_MES;
                  return (
                    <tr key={cat} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "12px 20px", fontWeight: 600, fontSize: 14 }}>{cat}</td>
                      <td style={{ padding: "12px 20px", fontSize: 14, fontWeight: 700 }}>{fmtPeso(monto)}</td>
                      <td style={{ padding: "12px 20px", fontSize: 13, color: C.textSec }}>
                        {totalMes > 0 ? `${((monto / totalMes) * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td style={{ padding: "12px 20px", fontSize: 13, color: C.accent, fontWeight: 700 }}>
                        {fmtPeso(costoHoraCat)}/hs
                        {cat === "Sueldos" && sueldosInfo.unidades > 0 && (
                          <span style={{ fontSize: 10, color: C.textMuted, marginLeft: 4 }}>({sueldosInfo.horas}hs)</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.accentBg }}>
                  <td style={{ padding: "12px 20px", fontWeight: 600, fontSize: 14 }}>Amortizaciones</td>
                  <td style={{ padding: "12px 20px", fontSize: 14, fontWeight: 700 }}>{fmtPeso(totalAmort)}</td>
                  <td style={{ padding: "12px 20px", fontSize: 13, color: C.textSec }}>
                    {totalMes > 0 ? `${((totalAmort / totalMes) * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td style={{ padding: "12px 20px", fontSize: 13, color: C.accent, fontWeight: 700 }}>Variable por proceso</td>
                </tr>
                <tr style={{ background: C.navy }}>
                  <td style={{ padding: "14px 20px", fontWeight: 800, fontSize: 15, color: "#fff" }}>TOTAL</td>
                  <td style={{ padding: "14px 20px", fontWeight: 800, fontSize: 15, color: C.accent }}>{fmtPeso(totalMes)}</td>
                  <td style={{ padding: "14px 20px", color: "#7a9cc8", fontSize: 13 }}>100%</td>
                  <td style={{ padding: "14px 20px", color: "#7a9cc8", fontSize: 13 }}>{fmtPeso(costoHoraPromedio)}/hs promedio</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Detalle por proveedor/concepto */}
          {costosPeriodo.length > 0 && (() => {
            const consolidado = {};
            costosPeriodo.forEach(c => {
              if (!consolidado[c.subcategoria]) {
                consolidado[c.subcategoria] = {
                  categoria: c.categoria,
                  subcategoria: c.subcategoria,
                  monto_original: c.monto,
                  dias_habiles: c.dias_habiles,
                  monto_mensual: c.categoria === "Sueldos"
                    ? c.monto
                    : costoHoraPorPeriodicidad(c.monto, c.dias_habiles) * HORAS_MES,
                };
              }
            });
            const filas = Object.values(consolidado).sort((a, b) => b.monto_mensual - a.monto_mensual);
            const totalConsolidado = filas.reduce((s, f) => s + f.monto_mensual, 0);

            return (
              <div style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>Detalle por proveedor / concepto — {periodo}</div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Monto equivalente mensual por concepto (ajustado por periodicidad)</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.accent }}>{filas.length} conceptos</div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: C.bg, borderBottom: `2px solid ${C.border}` }}>
                      {["Categoría", "Proveedor / Concepto", "Monto factura", "Período (días)", "Equiv. mensual", "% del período"].map(h => (
                        <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: C.textMuted, fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}
                        onMouseEnter={e => e.currentTarget.style.background = "#f5f7ff"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "10px 16px", fontSize: 13 }}>
                          <span style={{ background: C.accentBg, color: C.accent, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{f.categoria}</span>
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600 }}>{f.subcategoria}</td>
                        <td style={{ padding: "10px 16px", fontSize: 13, color: C.textSec }}>{fmtPeso(f.monto_original)}</td>
                        <td style={{ padding: "10px 16px", fontSize: 13, color: C.textSec, textAlign: "center" }}>
                          {f.categoria === "Sueldos" ? "21" : f.dias_habiles}
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: C.navy }}>{fmtPeso(f.monto_mensual)}</td>
                        <td style={{ padding: "10px 16px", fontSize: 13, color: C.textSec }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, background: C.border, borderRadius: 4, height: 6, maxWidth: 80 }}>
                              <div style={{ width: `${Math.min(100, (f.monto_mensual/totalConsolidado)*100)}%`, background: C.accent, borderRadius: 4, height: 6 }} />
                            </div>
                            <span>{totalConsolidado > 0 ? `${((f.monto_mensual/totalConsolidado)*100).toFixed(1)}%` : "—"}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: C.navy }}>
                      <td colSpan={4} style={{ padding: "12px 16px", fontWeight: 800, fontSize: 14, color: "#fff" }}>TOTAL</td>
                      <td style={{ padding: "12px 16px", fontWeight: 800, fontSize: 14, color: C.accent }}>{fmtPeso(totalConsolidado)}</td>
                      <td style={{ padding: "12px 16px", color: "#7a9cc8", fontSize: 13 }}>100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Botón procesar */}
          <div style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>🔄 Procesar comprobantes</div>
              <div style={{ fontSize: 13, color: C.textSec, marginTop: 4 }}>
                Clasifica todos los comprobantes en Costos según la categoría, distribución y periodicidad de cada contacto.
              </div>
            </div>
            <button onClick={procesarPeriodoACostos} disabled={procesando}
              style={{ background: procesando ? "#ccc" : C.accent, color: "#fff", border: "none", borderRadius: 8, padding: "12px 24px", fontWeight: 700, fontSize: 14, cursor: procesando ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
              {procesando ? "⏳ Procesando..." : "▶ Procesar período"}
            </button>
          </div>

          {msgProceso && (
            <div style={{ background: msgProceso.startsWith("✓") ? C.successBg : msgProceso.startsWith("⚠") ? C.warningBg : C.accentBg, border: `1px solid ${msgProceso.startsWith("✓") ? C.success : msgProceso.startsWith("⚠") ? C.warning : C.accent}44`, borderRadius: 10, padding: "12px 20px", fontSize: 13, fontWeight: 600, color: msgProceso.startsWith("✓") ? C.success : msgProceso.startsWith("⚠") ? C.warning : C.accent }}>
              {msgProceso}
            </div>
          )}

          {costosPeriodo.length === 0 && !procesando && (
            <div style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, padding: 40, textAlign: "center", color: C.textMuted }}>
              No hay costos cargados para el período {periodo}.<br/>
              <span style={{ fontSize: 13 }}>Apretá "Procesar período" para clasificar los comprobantes automáticamente.</span>
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
