import { useState, useEffect } from "react";

const C = {
  bg: "#f0f2f7", white: "#ffffff", border: "#e2e6f0",
  accent: "#0aada8", accentDark: "#088c88", accentBg: "#e6f7f7",
  navy: "#0d1f3c", navyLight: "#1a3360",
  success: "#27ae60", successBg: "#eafaf1",
  warning: "#e67e22", warningBg: "#fef5ec",
  danger: "#e74c3c", dangerBg: "#fdf0ef",
  blue: "#2980b9", blueBg: "#eaf4fb",
  purple: "#8e44ad", purpleBg: "#f5eef8",
  text: "#1a1a2e", textSec: "#5a6278", textMuted: "#9aa0b4",
  shadow: "0 2px 12px rgba(0,0,0,0.08)",
  shadowLg: "0 8px 32px rgba(0,0,0,0.13)",
};

const fmtPeso = (n) =>
  n != null && n !== "" && n !== 0
    ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(Number(n))
    : "—";

const fmtFecha = (s) => {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00");
  return isNaN(d) ? s : d.toLocaleDateString("es-AR");
};

const parsNum = (val) => {
  if (val == null || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const limpio = String(val).replace(/\$/g,"").replace(/\s/g,"").replace(/\./g,"").replace(",",".").trim();
  const n = parseFloat(limpio);
  return isNaN(n) ? 0 : n;
};

// ── API helpers ──────────────────────────────────────────────────────────────

async function apiSheets(body) {
  const r = await fetch("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function cargarComprobantes() {
  const d = await apiSheets({ action: "get" });
  const rows = d.values || [];
  if (rows.length <= 1) return [];
  return rows.slice(1).map((row, i) => ({
    sheetRowIndex: i,
    tipo:              row[1]  || "",
    numero:            row[2]  || "",
    punto_venta:       row[3]  || "",
    fecha_emision:     row[4]  || "",
    fecha_vencimiento: row[5]  || "",
    proveedor:         row[6]  || "",
    cuit:              row[7]  || "",
    total:             parsNum(row[16]),
    moneda:            row[17] || "ARS",
    periodo:           row[18] || "",
    estado:            row[21] || "procesado",
    condicion_venta:   row[23] || "",
    contacto_tipo:     row[47] || "",
  }));
}

async function cargarConfiguracion() {
  // Leer bancos desde Configuracion col A (cuentas bancarias)
  const d = await apiSheets({ action: "get_tipos" });
  const rows = d.values || [];
  // Buscar filas con "banco" o cuentas — devolver col B como nombre de banco
  // La configuración actual guarda bancos en otra sección; por ahora leemos col C (formas de pago)
  const fp = await apiSheets({ action: "get_formas_pago" });
  return fp.formas || [];
}

async function marcarPagado(rowIndex) {
  await apiSheets({ action: "update_comprobante", rowIndex, data: { estado: "pagado" } });
}

async function registrarPagoInmediato(data) {
  await apiSheets({ action: "append_pago_inmediato", data });
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function CuentasCorrientesProveedoresScreen({ onVolver, onIrAPagos }) {
  const [comprobantes, setComprobantes]   = useState([]);
  const [cargando, setCargando]           = useState(true);
  const [selCuit, setSelCuit]             = useState(null);   // CUIT del proveedor expandido
  const [q, setQ]                         = useState("");
  const [filtroPendiente, setFiltroPendiente] = useState(true); // true = solo pendientes
  const [modalPagoInm, setModalPagoInm]   = useState(null);   // { comp, tipo } o null
  const [pagando, setPagando]             = useState(false);
  const [bancos, setBancos]               = useState(["Credicoop", "Patagonia", "Banco"]);
  const [mensajeOk, setMensajeOk]         = useState("");

  useEffect(() => {
    Promise.all([cargarComprobantes(), cargarConfiguracion()]).then(([comps, formas]) => {
      setComprobantes(comps);
      // Extraer nombres de bancos desde formas de pago que no sean genéricas
      const bancosDetectados = formas.filter(f =>
        !["Efectivo","Transferencia","Echeq 3","Echeq Propio","Cheque","Saldo a favor Sermetales","Saldo a favor Proveedor"].includes(f)
      );
      if (bancosDetectados.length > 0) setBancos(bancosDetectados);
      setCargando(false);
    });
  }, []);

  // Filtrar solo comprobantes de proveedores (tipo Proveedor o facturas recibidas)
  const TIPOS_PROVEEDOR = ["factura_a","factura_b","factura_c","ticket","servicio_publico","ddjj","impuesto","otro"];

  const compProv = comprobantes.filter(c => {
    const esProv = TIPOS_PROVEEDOR.includes(c.tipo) && c.contacto_tipo !== "Cliente";
    if (!esProv) return false;
    if (filtroPendiente && c.estado === "pagado") return false;
    if (q.trim()) {
      const s = q.toLowerCase();
      return c.proveedor.toLowerCase().includes(s) || c.cuit.includes(s);
    }
    return true;
  });

  // Agrupar por proveedor (CUIT)
  const porProveedor = compProv.reduce((acc, c) => {
    const key = c.cuit || c.proveedor;
    if (!acc[key]) acc[key] = { cuit: c.cuit, proveedor: c.proveedor, items: [] };
    acc[key].items.push(c);
    return acc;
  }, {});

  const proveedores = Object.values(porProveedor).sort((a, b) => {
    const saldoA = a.items.reduce((s, c) => s + c.total, 0);
    const saldoB = b.items.reduce((s, c) => s + c.total, 0);
    return saldoB - saldoA; // Mayor deuda primero
  });

  const totalGeneral = proveedores.reduce((s, p) => s + p.items.reduce((ss, c) => ss + c.total, 0), 0);
  const cantPendientes = compProv.filter(c => c.estado !== "pagado").length;

  // ── Pago inmediato ──────────────────────────────────────────────────────────

  const ejecutarPagoInmediato = async (comp, formaPago) => {
    setPagando(true);
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      await registrarPagoInmediato({
        fecha: hoy,
        proveedor: comp.proveedor,
        cuit: comp.cuit,
        comprobante: `${comp.tipo} ${comp.punto_venta ? comp.punto_venta + "-" : ""}${comp.numero}`,
        total: comp.total,
        forma_pago: formaPago,
        periodo: comp.periodo,
      });
      await marcarPagado(comp.sheetRowIndex);
      // Actualizar estado local
      setComprobantes(prev =>
        prev.map(c => c.sheetRowIndex === comp.sheetRowIndex ? { ...c, estado: "pagado" } : c)
      );
      setMensajeOk(`✓ Pago registrado — ${comp.proveedor} — ${fmtPeso(comp.total)} en ${formaPago}`);
      setTimeout(() => setMensajeOk(""), 4000);
    } catch (e) {
      console.error(e);
    }
    setPagando(false);
    setModalPagoInm(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const ss = { background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" };

  return (
    <div style={{ padding: "28px 24px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={onVolver}
          style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          ← Volver
        </button>
        <div>
          <div style={{ fontWeight: 800, fontSize: 22, color: C.navy }}>🏢 Cuentas Corrientes — Proveedores</div>
          <div style={{ color: C.textMuted, fontSize: 13, marginTop: 2 }}>Facturas pendientes de pago agrupadas por proveedor</div>
        </div>
      </div>

      {/* Mensaje de éxito */}
      {mensajeOk && (
        <div style={{ background: C.successBg, border: `1px solid ${C.success}44`, borderRadius: 10, padding: "12px 18px", marginBottom: 16, color: C.success, fontWeight: 700, fontSize: 14 }}>
          {mensajeOk}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total adeudado", val: fmtPeso(totalGeneral), icon: "💰", color: totalGeneral > 0 ? C.danger : C.success },
          { label: "Facturas pendientes", val: cantPendientes, icon: "📄", color: C.warning },
          { label: "Proveedores con deuda", val: proveedores.length, icon: "🏢", color: C.navy },
        ].map(k => (
          <div key={k.label} style={{ background: C.white, borderRadius: 12, padding: "18px 20px", boxShadow: C.shadow }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{k.icon} {k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ background: C.white, borderRadius: 12, padding: "14px 16px", boxShadow: C.shadow, marginBottom: 20, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: C.textMuted }}>🔍</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar proveedor o CUIT..."
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 34px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, color: C.text, background: C.bg, outline: "none" }} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, color: C.textSec }}>
          <input type="checkbox" checked={filtroPendiente} onChange={e => setFiltroPendiente(e.target.checked)}
            style={{ width: 16, height: 16, cursor: "pointer" }} />
          Solo pendientes de pago
        </label>
      </div>

      {/* Lista de proveedores */}
      {cargando ? (
        <div style={{ background: C.white, borderRadius: 12, padding: "48px", textAlign: "center", color: C.textMuted, boxShadow: C.shadow }}>
          ⏳ Cargando comprobantes…
        </div>
      ) : proveedores.length === 0 ? (
        <div style={{ background: C.white, borderRadius: 12, padding: "48px", textAlign: "center", color: C.textMuted, boxShadow: C.shadow }}>
          {filtroPendiente ? "🎉 No hay facturas pendientes de pago" : "No se encontraron comprobantes"}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {proveedores.map(prov => {
            const saldo = prov.items.reduce((s, c) => s + c.total, 0);
            const expandido = selCuit === (prov.cuit || prov.proveedor);
            const key = prov.cuit || prov.proveedor;
            const pendientesCount = prov.items.filter(c => c.estado !== "pagado").length;

            return (
              <div key={key} style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, overflow: "hidden", border: expandido ? `2px solid ${C.accent}` : `1px solid ${C.border}` }}>

                {/* Fila resumen del proveedor */}
                <div
                  onClick={() => setSelCuit(expandido ? null : key)}
                  style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", background: expandido ? C.accentBg : C.white }}
                >
                  {/* Icono */}
                  <div style={{ width: 42, height: 42, background: expandido ? C.accent : C.bg, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, transition: "all .2s" }}>
                    🏢
                  </div>

                  {/* Nombre + CUIT */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {prov.proveedor || "Sin nombre"}
                    </div>
                    {prov.cuit && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>CUIT {prov.cuit}</div>}
                  </div>

                  {/* Badges */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                    <span style={{ background: C.warningBg, color: C.warning, border: `1px solid ${C.warning}44`, borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>
                      {prov.items.length} fact{prov.items.length !== 1 ? "uras" : "ura"}
                    </span>
                    {pendientesCount > 0 && pendientesCount < prov.items.length && (
                      <span style={{ background: C.dangerBg, color: C.danger, border: `1px solid ${C.danger}44`, borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>
                        {pendientesCount} pendiente{pendientesCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {/* Saldo total */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>Saldo pendiente</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: saldo > 0 ? C.danger : C.success }}>{fmtPeso(saldo)}</div>
                  </div>

                  {/* Flecha */}
                  <div style={{ color: C.textMuted, fontSize: 18, transition: "transform .2s", transform: expandido ? "rotate(90deg)" : "none" }}>›</div>
                </div>

                {/* Detalle expandido */}
                {expandido && (
                  <div style={{ borderTop: `1px solid ${C.border}` }}>

                    {/* Botón Generar Orden de Pago — acción principal */}
                    <div style={{ padding: "14px 20px", background: "#f8fafc", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10, alignItems: "center" }}>
                      <button
                        onClick={() => onIrAPagos && onIrAPagos({
                          proveedor: prov.proveedor,
                          cuit: prov.cuit,
                          facturas: prov.items.filter(c => c.estado !== "pagado"),
                          total: saldo,
                        })}
                        style={{ background: C.navy, color: "#fff", border: "none", borderRadius: 9, padding: "10px 22px", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                        📋 Generar Orden de Pago
                      </button>
                      <div style={{ color: C.textMuted, fontSize: 13 }}>o registrar un</div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: C.textSec }}>Pago inmediato →</div>
                    </div>

                    {/* Tabla de facturas */}
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: C.bg }}>
                          {["Tipo / N°", "Fecha", "Vencimiento", "Período", "Total", "Estado", "Acciones"].map(h => (
                            <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {prov.items.map((comp, idx) => {
                          const pagado = comp.estado === "pagado";
                          return (
                            <tr key={idx} style={{ borderTop: `1px solid ${C.border}`, background: pagado ? "#f9fafb" : C.white, opacity: pagado ? 0.65 : 1 }}>
                              <td style={{ padding: "12px 16px" }}>
                                <div style={{ fontWeight: 600, fontSize: 13, color: C.navy }}>
                                  {comp.tipo?.replace("_", " ").toUpperCase()}
                                </div>
                                <div style={{ fontSize: 12, color: C.textMuted, fontFamily: "monospace" }}>
                                  {comp.punto_venta ? `${comp.punto_venta}-` : ""}{comp.numero || "—"}
                                </div>
                              </td>
                              <td style={{ padding: "12px 16px", fontSize: 13, color: C.textSec }}>{fmtFecha(comp.fecha_emision)}</td>
                              <td style={{ padding: "12px 16px", fontSize: 13 }}>
                                {comp.fecha_vencimiento ? (
                                  <span style={{
                                    color: new Date(comp.fecha_vencimiento) < new Date() && !pagado ? C.danger : C.textSec,
                                    fontWeight: new Date(comp.fecha_vencimiento) < new Date() && !pagado ? 700 : 400,
                                  }}>
                                    {fmtFecha(comp.fecha_vencimiento)}
                                    {new Date(comp.fecha_vencimiento) < new Date() && !pagado && " ⚠"}
                                  </span>
                                ) : "—"}
                              </td>
                              <td style={{ padding: "12px 16px", fontSize: 13, color: C.textSec }}>{comp.periodo || "—"}</td>
                              <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: 14, color: pagado ? C.textMuted : C.text }}>{fmtPeso(comp.total)}</td>
                              <td style={{ padding: "12px 16px" }}>
                                {pagado ? (
                                  <span style={{ background: C.successBg, color: C.success, border: `1px solid ${C.success}44`, borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>✓ Pagado</span>
                                ) : (
                                  <span style={{ background: C.dangerBg, color: C.danger, border: `1px solid ${C.danger}44`, borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>Pendiente</span>
                                )}
                              </td>
                              <td style={{ padding: "12px 16px" }}>
                                {!pagado && (
                                  <button
                                    onClick={() => setModalPagoInm(comp)}
                                    style={{ background: C.accentBg, color: C.accentDark, border: `1px solid ${C.accent}44`, borderRadius: 7, padding: "6px 14px", cursor: "pointer", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>
                                    💵 Pago inmediato
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {/* Subtotal del proveedor */}
                      <tfoot>
                        <tr style={{ borderTop: `2px solid ${C.border}`, background: C.bg }}>
                          <td colSpan={4} style={{ padding: "12px 16px", fontWeight: 700, fontSize: 13, color: C.textSec }}>Total pendiente — {prov.proveedor}</td>
                          <td style={{ padding: "12px 16px", fontWeight: 800, fontSize: 16, color: C.danger }}>{fmtPeso(saldo)}</td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal Pago Inmediato ────────────────────────────────────────────── */}
      {modalPagoInm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(13,31,60,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setModalPagoInm(null); }}>
          <div style={{ background: C.white, borderRadius: 18, boxShadow: C.shadowLg, width: 420, overflow: "hidden" }}>

            {/* Cabecera del modal */}
            <div style={{ background: C.navy, padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: C.accent, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Pago inmediato</div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{modalPagoInm.proveedor}</div>
              </div>
              <button onClick={() => setModalPagoInm(null)}
                style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 6, width: 30, height: 30, cursor: "pointer", fontSize: 17 }}>✕</button>
            </div>

            {/* Detalle de la factura */}
            <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>Comprobante</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {modalPagoInm.tipo?.replace("_"," ").toUpperCase()} {modalPagoInm.punto_venta ? `${modalPagoInm.punto_venta}-` : ""}{modalPagoInm.numero}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>Fecha</div>
                  <div style={{ fontSize: 13 }}>{fmtFecha(modalPagoInm.fecha_emision)}</div>
                </div>
              </div>
              <div style={{ background: C.bg, borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: C.textSec, fontWeight: 600 }}>Total a pagar</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: C.danger }}>{fmtPeso(modalPagoInm.total)}</span>
              </div>
            </div>

            {/* Botones de forma de pago */}
            <div style={{ padding: "20px 22px" }}>
              <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>Seleccioná la forma de pago</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>

                {/* Efectivo */}
                <button
                  onClick={() => ejecutarPagoInmediato(modalPagoInm, "Efectivo")}
                  disabled={pagando}
                  style={{ background: C.successBg, color: C.success, border: `2px solid ${C.success}55`, borderRadius: 12, padding: "16px 12px", cursor: "pointer", fontWeight: 700, fontSize: 14, textAlign: "center", transition: "all .15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.success; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.successBg; e.currentTarget.style.color = C.success; }}>
                  💵<br /><span style={{ fontSize: 13, marginTop: 4, display: "block" }}>Efectivo</span>
                </button>

                {/* Banco 1 — Credicoop */}
                <button
                  onClick={() => ejecutarPagoInmediato(modalPagoInm, bancos[0] || "Credicoop")}
                  disabled={pagando}
                  style={{ background: C.blueBg, color: C.blue, border: `2px solid ${C.blue}55`, borderRadius: 12, padding: "16px 12px", cursor: "pointer", fontWeight: 700, fontSize: 14, textAlign: "center", transition: "all .15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.blue; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.blueBg; e.currentTarget.style.color = C.blue; }}>
                  🏦<br /><span style={{ fontSize: 13, marginTop: 4, display: "block" }}>{bancos[0] || "Credicoop"}</span>
                </button>

                {/* Banco 2 — Patagonia */}
                <button
                  onClick={() => ejecutarPagoInmediato(modalPagoInm, bancos[1] || "Patagonia")}
                  disabled={pagando}
                  style={{ background: C.accentBg, color: C.accentDark, border: `2px solid ${C.accent}55`, borderRadius: 12, padding: "16px 12px", cursor: "pointer", fontWeight: 700, fontSize: 14, textAlign: "center", transition: "all .15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.accentBg; e.currentTarget.style.color = C.accentDark; }}>
                  🏦<br /><span style={{ fontSize: 13, marginTop: 4, display: "block" }}>{bancos[1] || "Patagonia"}</span>
                </button>

                {/* Banco 3 */}
                <button
                  onClick={() => ejecutarPagoInmediato(modalPagoInm, bancos[2] || "Banco")}
                  disabled={pagando}
                  style={{ background: C.purpleBg, color: C.purple, border: `2px solid ${C.purple}55`, borderRadius: 12, padding: "16px 12px", cursor: "pointer", fontWeight: 700, fontSize: 14, textAlign: "center", transition: "all .15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.purple; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.purpleBg; e.currentTarget.style.color = C.purple; }}>
                  🏦<br /><span style={{ fontSize: 13, marginTop: 4, display: "block" }}>{bancos[2] || "Banco"}</span>
                </button>

              </div>

              {pagando && (
                <div style={{ textAlign: "center", marginTop: 16, color: C.accent, fontWeight: 700, fontSize: 13 }}>
                  ⏳ Registrando pago…
                </div>
              )}

              <button onClick={() => setModalPagoInm(null)} disabled={pagando}
                style={{ width: "100%", marginTop: 14, background: "transparent", color: C.textSec, border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 0", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
