import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";

// ─── Paleta de colores ────────────────────────────────────────────────────────
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

const TIPO_LABELS = {
  factura_a: "Factura A", factura_b: "Factura B", factura_c: "Factura C",
  ticket: "Ticket Fiscal", servicio_publico: "Servicio Público",
  recibo_sueldo: "Recibo de Sueldo", ddjj: "DDJJ", otro: "Otro",
};

const fmtPeso = (n) =>
  n != null && n !== "" && n !== 0
    ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(n)
    : "—";

const fmtFecha = (s) => {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00");
  return isNaN(d) ? s : d.toLocaleDateString("es-AR");
};

const estadoCfg = {
  procesado:  { label: "Procesado", bg: "#eafaf1", color: "#27ae60" },
  revisar:    { label: "Revisar",   bg: "#fef5ec", color: "#e67e22" },
  procesando: { label: "En curso",  bg: "#eaf4fb", color: "#2980b9" },
  error:      { label: "Error",     bg: "#fdf0ef", color: "#e74c3c" },
};

const Badge = ({ estado }) => {
  const c = estadoCfg[estado] || estadoCfg.error;
  return (
    <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}44`, borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>
      {c.label}
    </span>
  );
};

const TipoBadge = ({ tipo }) => (
  <span style={{ background: C.accentBg, color: C.accentDark, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
    {TIPO_LABELS[tipo] || tipo || "—"}
  </span>
);

// ─── Llamada a la API (via proxy Vercel) ──────────────────────────────────────
async function procesarConClaude(file) {
  const base64 = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  const isPdf = file.type === "application/pdf";

  const prompt = `Sos un sistema experto en comprobantes fiscales argentinos.
Analizá el documento y extraé TODA la información relevante.
Respondé ÚNICAMENTE con JSON válido, sin texto adicional ni backticks.
{
  "tipo": "factura_a"|"factura_b"|"factura_c"|"ticket"|"servicio_publico"|"recibo_sueldo"|"ddjj"|"otro",
  "numero_comprobante": "string|null",
  "punto_venta": "string|null",
  "fecha_emision": "YYYY-MM-DD|null",
  "fecha_vencimiento": "YYYY-MM-DD|null",
  "emisor_razon_social": "string|null",
  "emisor_cuit": "string|null",
  "emisor_domicilio": "string|null",
  "receptor_razon_social": "string|null",
  "receptor_cuit": "string|null",
  "receptor_domicilio": "string|null",
  "neto_gravado": number|null,
  "iva_alicuota": number|null,
  "iva_importe": number|null,
  "percepciones": number|null,
  "otros_tributos": number|null,
  "total": number|null,
  "moneda": "ARS"|"USD"|"EUR"|"otro",
  "items": [{"descripcion":"string","cantidad":number|null,"unidad":"string|null","precio_unitario":number|null,"subtotal":number|null}],
  "periodo": "string|null",
  "empleado_nombre": "string|null",
  "empleado_cuil": "string|null",
  "texto_original": "resumen del texto clave del documento en max 500 caracteres",
  "observaciones": "string|null",
  "confianza": "alta"|"media"|"baja"
}`;

  const block = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image",    source: { type: "base64", media_type: file.type, data: base64 } };

  const resp = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [{ role: "user", content: [block, { type: "text", text: prompt }] }],
    }),
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error?.message || "Error en el servidor");
  return JSON.parse(data.content.map((b) => b.text || "").join("").replace(/```json|```/g, "").trim());
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────
const Div = ({ label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 0" }}>
    <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, whiteSpace: "nowrap" }}>{label}</span>
    <div style={{ flex: 1, height: 1, background: C.border }} />
  </div>
);

const F = ({ l, v, bold }) => (
  <div>
    <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{l}</div>
    <div style={{ fontSize: 13, fontWeight: bold ? 700 : 400, color: v ? C.text : C.textMuted }}>{v || "—"}</div>
  </div>
);

const Grid2 = ({ a, b }) => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
    <F l={a.l} v={a.v} />
    <F l={b.l} v={b.v} />
  </div>
);

// ─── App principal ────────────────────────────────────────────────────────────
export default function App() {
  const [comp, setComp]       = useState([]);
  const [drag, setDrag]       = useState(false);
  const [selId, setSelId]     = useState(null);
  const [fTipo, setFTipo]     = useState("todos");
  const [fEst, setFEst]       = useState("todos");
  const [q, setQ]             = useState("");
  const [editing, setEditing] = useState(false);
  const [editD, setEditD]     = useState({});
  const fileRef = useRef();

  const procesar = useCallback(async (files) => {
    const items = Array.from(files).map((f) => ({
      id: crypto.randomUUID(),
      nombre: f.name,
      estado: "procesando",
      datos: null,
      error: null,
      file: f,
      fileUrl: URL.createObjectURL(f),
    }));
    setComp((p) => [...items, ...p]);
    for (const item of items) {
      try {
        const datos = await procesarConClaude(item.file);
        setComp((p) => p.map((c) =>
          c.id === item.id
            ? { ...c, estado: datos.confianza === "baja" ? "revisar" : "procesado", datos }
            : c
        ));
      } catch (e) {
        setComp((p) => p.map((c) =>
          c.id === item.id ? { ...c, estado: "error", error: e.message } : c
        ));
      }
    }
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files.length) procesar(e.dataTransfer.files);
  }, [procesar]);

  const filtrados = comp.filter((c) => {
    if (fTipo !== "todos" && c.datos?.tipo !== fTipo) return false;
    if (fEst  !== "todos" && c.estado       !== fEst)  return false;
    if (q.trim()) {
      const s = q.toLowerCase();
      return (
        c.nombre.toLowerCase().includes(s) ||
        c.datos?.emisor_razon_social?.toLowerCase().includes(s) ||
        c.datos?.emisor_cuit?.includes(s) ||
        c.datos?.numero_comprobante?.includes(s)
      );
    }
    return true;
  });

  const withData   = comp.filter((c) => c.datos);
  const totalFact  = withData.reduce((s, c) => s + (c.datos.total       || 0), 0);
  const creditoIVA = withData.reduce((s, c) => s + (c.datos.iva_importe || 0), 0);
  const pendientes = comp.filter((c) => c.estado === "revisar").length;
  const enCurso    = comp.filter((c) => c.estado === "procesando").length;
  const sel        = selId ? comp.find((c) => c.id === selId) : null;

  const exportExcel = () => {
    const rows = withData.map((c) => ({
      Archivo:            c.nombre,
      Tipo:               TIPO_LABELS[c.datos.tipo] || c.datos.tipo,
      "N° Comprobante":   c.datos.numero_comprobante || "",
      "Punto de Venta":   c.datos.punto_venta || "",
      "Fecha Emisión":    c.datos.fecha_emision || "",
      "Fecha Venc.":      c.datos.fecha_vencimiento || "",
      Emisor:             c.datos.emisor_razon_social || "",
      "CUIT Emisor":      c.datos.emisor_cuit || "",
      Receptor:           c.datos.receptor_razon_social || "",
      "CUIT Receptor":    c.datos.receptor_cuit || "",
      "Neto Gravado":     c.datos.neto_gravado ?? "",
      "IVA %":            c.datos.iva_alicuota ?? "",
      "IVA $":            c.datos.iva_importe ?? "",
      Percepciones:       c.datos.percepciones ?? "",
      "Otros Tributos":   c.datos.otros_tributos ?? "",
      Total:              c.datos.total ?? "",
      Moneda:             c.datos.moneda || "ARS",
      Período:            c.datos.periodo || "",
      Empleado:           c.datos.empleado_nombre || "",
      CUIL:               c.datos.empleado_cuil || "",
      Estado:             c.estado,
      Observaciones:      c.datos.observaciones || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    // Ancho de columnas automático
    const colWidths = Object.keys(rows[0] || {}).map((k) => ({ wch: Math.max(k.length, 14) }));
    ws["!cols"] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comprobantes");
    XLSX.writeFile(wb, `comprobantes_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const aprobar     = (id) => setComp((p) => p.map((c) => c.id === id ? { ...c, estado: "procesado" } : c));
  const guardarEdit = () => {
    setComp((p) => p.map((c) => c.id === selId ? { ...c, datos: { ...c.datos, ...editD } } : c));
    setEditing(false);
  };

  const ss  = { background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" };
  const tdS = { padding: "11px 14px", fontSize: 13, verticalAlign: "middle" };
  const btnS = (bg) => ({ flex: 1, background: bg, color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 700, fontSize: 13, cursor: "pointer" });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Segoe UI',system-ui,sans-serif", fontSize: 14, color: C.text }}>

      {/* ── Header ── */}
      <div style={{ background: C.navy, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 58, position: "sticky", top: 0, zIndex: 200, boxShadow: "0 2px 10px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, background: C.accent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18, color: "#fff" }}>D</div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Digitalizador de comprobantes</div>
            <div style={{ color: "#7a9cc8", fontSize: 11 }}>Panel principal · IA integrada</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {enCurso > 0 && (
            <span style={{ background: C.accentBg, color: C.accent, border: `1px solid ${C.accent}55`, borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 700 }}>
              ⚡ Procesando {enCurso}…
            </span>
          )}
          <div style={{ width: 34, height: 34, background: C.navyLight, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13, border: `2px solid ${C.accent}` }}>
            HM
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "14px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20, maxWidth: 900 }}>
          {[
            { label: "Total comprobantes", val: comp.length,         icon: "📄", color: C.text    },
            { label: "Total facturado",    val: fmtPeso(totalFact),  icon: "💰", color: C.success  },
            { label: "Crédito IVA",        val: fmtPeso(creditoIVA), icon: "🧾", color: C.accent   },
            { label: "Pend. revisión",     val: pendientes,          icon: "⚠", color: C.warning  },
          ].map((s) => (
            <div key={s.label}>
              <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>{s.icon} {s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Contenido principal ── */}
      <div style={{ padding: "20px 24px", maxWidth: 1320, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 440px" : "1fr", gap: 20, alignItems: "start" }}>

          {/* ── Columna izquierda ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current.click()}
              style={{ background: drag ? C.accentBg : C.white, border: `2px dashed ${drag ? C.accent : "#b8c4d8"}`, borderRadius: 14, padding: "28px 20px", textAlign: "center", cursor: "pointer", transition: "all .2s", boxShadow: C.shadow }}
            >
              <div style={{ fontSize: 36, marginBottom: 8 }}>⬆️</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Arrastrá tus PDFs o imágenes acá</div>
              <div style={{ color: C.textSec, fontSize: 13 }}>Facturas A/B/C · Tickets · Servicios · Recibos de sueldo · DDJJ</div>
              <button
                onClick={(e) => { e.stopPropagation(); fileRef.current.click(); }}
                style={{ marginTop: 14, background: C.accent, color: "#fff", border: "none", borderRadius: 8, padding: "9px 22px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
              >
                + Cargar archivos
              </button>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple style={{ display: "none" }} onChange={(e) => procesar(e.target.files)} />
            </div>

            {/* Filtros y buscador */}
            <div style={{ background: C.white, borderRadius: 12, padding: 16, boxShadow: C.shadow, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: C.textMuted }}>🔍</span>
                <input
                  value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por proveedor, CUIT o número de comprobante"
                  style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 34px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, color: C.text, background: C.bg, outline: "none" }}
                />
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} style={ss}>
                  <option value="todos">Todos los tipos</option>
                  {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={fEst} onChange={(e) => setFEst(e.target.value)} style={ss}>
                  <option value="todos">Todos los estados</option>
                  <option value="procesado">Procesado</option>
                  <option value="revisar">Revisar</option>
                  <option value="procesando">En curso</option>
                  <option value="error">Error</option>
                </select>
                <div style={{ flex: 1 }} />
                <button
                  onClick={exportExcel} disabled={!withData.length}
                  style={{ background: withData.length ? C.accent : "#ccc", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 700, fontSize: 13, cursor: withData.length ? "pointer" : "not-allowed" }}
                >
                  ⬇ Exportar a Excel
                </button>
              </div>
            </div>

            {/* Tabla */}
            <div style={{ background: C.white, borderRadius: 12, boxShadow: C.shadow, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                    {["Proveedor", "Tipo", "Comprobante", "Fecha", "Neto", "IVA", "Total", "Estado"].map((h) => (
                      <th key={h} style={{ padding: "11px 14px", textAlign: "left", color: C.textMuted, fontWeight: 700, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: "48px 20px", textAlign: "center", color: C.textMuted }}>
                        {comp.length === 0 ? "Cargá comprobantes para comenzar" : "Sin resultados para ese filtro"}
                      </td>
                    </tr>
                  ) : filtrados.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => { setSelId(c.id === selId ? null : c.id); setEditing(false); }}
                      style={{ borderBottom: `1px solid ${C.border}`, background: c.id === selId ? C.accentBg : "transparent", cursor: "pointer", transition: "background .1s" }}
                      onMouseEnter={(e) => { if (c.id !== selId) e.currentTarget.style.background = "#f5f7ff"; }}
                      onMouseLeave={(e) => { if (c.id !== selId) e.currentTarget.style.background = "transparent"; }}
                    >
                      <td style={tdS}>
                        {c.estado === "procesando"
                          ? <span style={{ color: C.textMuted }}>⏳ {c.nombre}</span>
                          : <>
                              <div style={{ fontWeight: 600 }}>{c.datos?.emisor_razon_social || c.nombre}</div>
                              {c.datos?.emisor_cuit && <div style={{ fontSize: 11, color: C.textMuted }}>CUIT {c.datos.emisor_cuit}</div>}
                            </>}
                      </td>
                      <td style={tdS}>{c.datos ? <TipoBadge tipo={c.datos.tipo} /> : "—"}</td>
                      <td style={{ ...tdS, fontFamily: "monospace", color: C.textSec, fontSize: 12 }}>{c.datos?.numero_comprobante || "—"}</td>
                      <td style={{ ...tdS, color: C.textSec }}>{fmtFecha(c.datos?.fecha_emision)}</td>
                      <td style={tdS}>{fmtPeso(c.datos?.neto_gravado)}</td>
                      <td style={{ ...tdS, color: C.textSec }}>{fmtPeso(c.datos?.iva_importe)}</td>
                      <td style={{ ...tdS, fontWeight: 700 }}>{fmtPeso(c.datos?.total)}</td>
                      <td style={tdS}><Badge estado={c.estado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Panel de detalle ── */}
          {sel && (
            <div style={{ position: "sticky", top: 76, borderRadius: 14, overflow: "hidden", boxShadow: C.shadowLg, maxHeight: "calc(100vh - 96px)", overflowY: "auto" }}>

              {/* Cabecera del panel */}
              <div style={{ background: C.navy, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, marginRight: 10 }}>
                  <div style={{ color: C.accent, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>Detalle del comprobante</div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, lineHeight: 1.4 }}>
                    {sel.datos
                      ? `${TIPO_LABELS[sel.datos.tipo] || sel.datos.tipo}${sel.datos.numero_comprobante ? " · " + sel.datos.numero_comprobante : ""} · ${sel.datos.emisor_razon_social || sel.nombre}`
                      : sel.nombre}
                  </div>
                </div>
                <button
                  onClick={() => { setSelId(null); setEditing(false); }}
                  style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 16, flexShrink: 0 }}
                >✕</button>
              </div>

              {/* Texto original */}
              {sel.datos?.texto_original && (
                <div style={{ background: "#f8fafc", borderBottom: `1px solid ${C.border}`, padding: "14px 20px" }}>
                  <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>Documento original</div>
                  <pre style={{ fontFamily: "monospace", fontSize: 12, color: C.textSec, margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6, background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
                    {sel.datos.texto_original}
                  </pre>
                </div>
              )}

              {/* Preview si no hay texto */}
              {sel.fileUrl && !sel.datos?.texto_original && (
                <div style={{ background: "#f8fafc", borderBottom: `1px solid ${C.border}` }}>
                  {sel.nombre.toLowerCase().endsWith(".pdf")
                    ? <iframe src={sel.fileUrl} style={{ width: "100%", height: 220, border: "none", display: "block" }} title="preview" />
                    : <img src={sel.fileUrl} alt="comprobante" style={{ width: "100%", maxHeight: 220, objectFit: "contain", display: "block", background: "#fff" }} />}
                </div>
              )}

              {/* Datos extraídos */}
              {sel.datos && !editing && (
                <div style={{ background: C.white, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Datos extraídos</span>
                    <span style={{
                      background: sel.datos.confianza === "alta" ? C.successBg : sel.datos.confianza === "media" ? C.warningBg : C.dangerBg,
                      color:      sel.datos.confianza === "alta" ? C.success   : sel.datos.confianza === "media" ? C.warning   : C.danger,
                      border: "1px solid currentColor", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700
                    }}>Confianza {sel.datos.confianza}</span>
                  </div>

                  <Grid2 a={{ l: "Tipo", v: TIPO_LABELS[sel.datos.tipo] || sel.datos.tipo }} b={{ l: "N° Comprobante", v: sel.datos.numero_comprobante }} />
                  <Grid2 a={{ l: "Fecha emisión", v: fmtFecha(sel.datos.fecha_emision) }} b={{ l: "Vencimiento", v: fmtFecha(sel.datos.fecha_vencimiento) }} />
                  {sel.datos.periodo && <F l="Período" v={sel.datos.periodo} />}

                  <Div label="Emisor" />
                  <F l="Razón social" v={sel.datos.emisor_razon_social} bold />
                  <Grid2 a={{ l: "CUIT", v: sel.datos.emisor_cuit }} b={{ l: "Domicilio", v: sel.datos.emisor_domicilio }} />

                  <Div label="Receptor" />
                  <F l="Nombre / Razón social" v={sel.datos.receptor_razon_social || sel.datos.empleado_nombre} bold />
                  <Grid2 a={{ l: "CUIT / CUIL", v: sel.datos.receptor_cuit || sel.datos.empleado_cuil }} b={{ l: "Domicilio", v: sel.datos.receptor_domicilio }} />

                  {sel.datos.items?.length > 0 && (
                    <>
                      <Div label="Detalle de ítems" />
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr>
                            {["Descripción", "Cant.", "P. Unit.", "Total"].map((h) => (
                              <th key={h} style={{ textAlign: "left", color: C.textMuted, fontWeight: 700, padding: "4px 6px", borderBottom: `1px solid ${C.border}`, fontSize: 10, textTransform: "uppercase" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sel.datos.items.map((it, i) => (
                            <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                              <td style={{ padding: "6px 6px", lineHeight: 1.4 }}>{it.descripcion}</td>
                              <td style={{ padding: "6px 6px", color: C.textSec, whiteSpace: "nowrap" }}>{it.cantidad != null ? `${it.cantidad}${it.unidad ? " " + it.unidad : ""}` : "—"}</td>
<td style={{ padding: "6px 6px", color: C.textSec, whiteSpace: "nowrap" }}>{fmtPeso(it.precio_unitario)}</td>
<td style={{ padding: "6px 6px", fontWeight: 600, whiteSpace: "nowrap" }}>{fmtPeso(it.subtotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  <Div label="Totales" />
                  <div style={{ background: C.bg, borderRadius: 8, padding: "12px 14px" }}>
                    {[
                      ["Neto gravado", sel.datos.neto_gravado],
                      [`IVA${sel.datos.iva_alicuota ? " " + sel.datos.iva_alicuota + "%" : ""}`, sel.datos.iva_importe],
                      ["Percepciones", sel.datos.percepciones],
                      ["Otros tributos", sel.datos.otros_tributos],
                    ].filter(([, v]) => v != null && v !== 0).map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                        <span style={{ color: C.textSec }}>{k}</span><span>{fmtPeso(v)}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4, fontWeight: 800, fontSize: 16 }}>
                      <span>TOTAL</span>
                      <span style={{ color: C.accent }}>{fmtPeso(sel.datos.total)}</span>
                    </div>
                  </div>

                  {sel.datos.observaciones && <F l="Observaciones" v={sel.datos.observaciones} />}

                  <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                    {sel.estado === "revisar" && (
                      <button onClick={() => aprobar(sel.id)} style={btnS(C.accent)}>✓ Aprobar y guardar</button>
                    )}
                    <button onClick={() => { setEditing(true); setEditD({ ...sel.datos }); }} style={btnS("#6c757d")}>
                      ✎ Editar campos
                    </button>
                  </div>
                </div>
              )}

              {/* Formulario edición */}
              {sel.datos && editing && (
                <div style={{ background: C.white, padding: "16px 20px" }}>
                  <div style={{ fontWeight: 700, marginBottom: 14, color: C.navy }}>✎ Editar campos</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      ["emisor_razon_social",  "Emisor razón social"],
                      ["emisor_cuit",          "CUIT Emisor"],
                      ["receptor_razon_social","Receptor / Nombre"],
                      ["receptor_cuit",        "CUIT Receptor"],
                      ["fecha_emision",        "Fecha emisión (YYYY-MM-DD)"],
                      ["fecha_vencimiento",    "Fecha vencimiento (YYYY-MM-DD)"],
                      ["numero_comprobante",   "N° Comprobante"],
                      ["neto_gravado",         "Neto gravado"],
                      ["iva_importe",          "IVA importe"],
                      ["percepciones",         "Percepciones"],
                      ["otros_tributos",       "Otros tributos"],
                      ["total",                "Total"],
                    ].map(([k, label]) => (
                      <div key={k}>
                        <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>{label}</div>
                        <input
                          value={editD[k] ?? ""}
                          onChange={(e) => setEditD((p) => ({ ...p, [k]: e.target.value }))}
                          style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, color: C.text, background: C.bg }}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                    <button onClick={guardarEdit} style={btnS(C.accent)}>💾 Guardar</button>
                    <button onClick={() => setEditing(false)} style={btnS("#6c757d")}>Cancelar</button>
                  </div>
                </div>
              )}

              {sel.estado === "error" && (
                <div style={{ background: C.dangerBg, padding: "14px 20px", color: C.danger, fontWeight: 600, fontSize: 13 }}>
                  ⚠ Error al procesar: {sel.error}
                </div>
              )}
              {sel.estado === "procesando" && (
                <div style={{ background: C.blueBg, padding: "24px", textAlign: "center", color: C.blue, fontWeight: 600 }}>
                  ⚡ Analizando con IA…
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
