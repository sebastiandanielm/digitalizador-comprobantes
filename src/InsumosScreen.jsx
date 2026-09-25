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

const INSUMO_VACIO = {
  codigo: "", descripcion: "", tipo: "", material: "", proveedor: "",
  busqueda: "", fecha_precio: "", largo_mm: "", ancho_mm: "", ancho_pulg: "",
  medida2_mm: "", pe: "", espesor: "", peso: "",
  precio_tn_usd: "", valor_dolar: "", precio_pieza: "",
  fecha_stock: "", stock_un: "", peso_stock_kg: "",
  stock_minimo_kg: "", stock_min_un: "", a_comprar_kg: "", a_comprar: "",
  alarma_aplazada_hasta: "", notificar: "Si"
};

function parsNum(s) {
  if (!s) return 0;
  return parseFloat(String(s).replace(/\./g,"").replace(",",".")) || 0;
}

function estadoStock(insumo) {
  if (insumo.notificar !== "Si") return "sin_alarma";
  const stockUn = parsNum(insumo.stock_un);
  const stockMin = parsNum(insumo.stock_min_un);
  const stockKg = parsNum(insumo.peso_stock_kg);
  const stockMinKg = parsNum(insumo.stock_minimo_kg);
  // Usar unidades si hay stock_min_un, sino kg
  if (stockMin > 0) {
    if (stockUn <= 0) return "sin_stock";
    if (stockUn <= stockMin) return "bajo";
    return "ok";
  }
  if (stockMinKg > 0) {
    if (stockKg <= 0) return "sin_stock";
    if (stockKg <= stockMinKg) return "bajo";
    return "ok";
  }
  return "sin_minimo";
}

const ESTADO_CFG = {
  ok:          { label: "✓ OK",        bg: "#eafaf1", color: "#27ae60" },
  bajo:        { label: "⚠ Stock bajo", bg: "#fef5ec", color: "#e67e22" },
  sin_stock:   { label: "✕ Sin stock",  bg: "#fdf0ef", color: "#e74c3c" },
  sin_alarma:  { label: "— Ref.",       bg: C.bg,      color: C.textMuted },
  sin_minimo:  { label: "? S/mínimo",   bg: C.bg,      color: C.textMuted },
};

async function apiSheets(action, data, rowIndex) {
  const r = await fetch("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, data, rowIndex }),
  });
  return r.json();
}

function rowToInsumo(row, i) {
  return {
    _idx: i,
    codigo:              row[0]  || "",
    descripcion:         row[1]  || "",
    tipo:                row[2]  || "",
    material:            row[3]  || "",
    proveedor:           row[4]  || "",
    busqueda:            row[5]  || "",
    fecha_precio:        row[6]  || "",
    largo_mm:            row[7]  || "",
    ancho_mm:            row[8]  || "",
    ancho_pulg:          row[9]  || "",
    medida2_mm:          row[10] || "",
    pe:                  row[11] || "",
    espesor:             row[12] || "",
    peso:                row[13] || "",
    precio_tn_usd:       row[14] || "",
    valor_dolar:         row[15] || "",
    precio_pieza:        row[16] || "",
    fecha_stock:         row[17] || "",
    stock_un:            row[18] || "",
    peso_stock_kg:       row[19] || "",
    stock_minimo_kg:     row[20] || "",
    stock_min_un:        row[21] || "",
    a_comprar_kg:        row[22] || "",
    a_comprar:           row[23] || "",
    alarma_aplazada_hasta: row[24] || "",
    notificar:           row[25] || "Si",
  };
}

function insumoToRow(d) {
  return [
    d.codigo, d.descripcion, d.tipo, d.material, d.proveedor,
    d.busqueda, d.fecha_precio, d.largo_mm, d.ancho_mm, d.ancho_pulg,
    d.medida2_mm, d.pe, d.espesor, d.peso,
    d.precio_tn_usd, d.valor_dolar, d.precio_pieza,
    d.fecha_stock, d.stock_un, d.peso_stock_kg,
    d.stock_minimo_kg, d.stock_min_un, d.a_comprar_kg, d.a_comprar,
    d.alarma_aplazada_hasta, d.notificar,
  ];
}

export default function InsumosScreen({ onVolver }) {
  const [insumos, setInsumos]       = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [q, setQ]                   = useState("");
  const [fDesc, setFDesc]           = useState("todos");
  const [fProv, setFProv]           = useState("todos");
  const [fEstado, setFEstado]       = useState("todos");
  const [modal, setModal]           = useState(null); // null | "nuevo" | "editar" | "aplazar"
  const [form, setForm]             = useState(INSUMO_VACIO);
  const [formIdx, setFormIdx]       = useState(null);
  const [guardando, setGuardando]   = useState(false);
  const [aplazarFecha, setAplazarFecha] = useState("");
  const [aplazarIdx, setAplazarIdx]     = useState(null);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      const data = await apiSheets("get_insumos");
      const rows = data.values || [];
      if (rows.length <= 1) { setInsumos([]); }
      else { setInsumos(rows.slice(1).map((row, i) => rowToInsumo(row, i))); }
    } catch(e) { console.error(e); }
    setCargando(false);
  };

  // Opciones para filtros
  const descripciones = [...new Set(insumos.map(i => i.descripcion).filter(Boolean))].sort();
  const proveedores   = [...new Set(insumos.map(i => i.proveedor).filter(Boolean))].sort();

  const filtrados = insumos.filter(ins => {
    if (fDesc !== "todos" && ins.descripcion !== fDesc) return false;
    if (fProv !== "todos" && ins.proveedor !== fProv) return false;
    if (fEstado !== "todos") {
      const est = estadoStock(ins);
      if (fEstado === "alarma" && est !== "bajo" && est !== "sin_stock") return false;
      if (fEstado === "ok" && est !== "ok") return false;
      if (fEstado === "ref" && est !== "sin_alarma") return false;
    }
    if (q.trim()) {
      const s = q.toLowerCase();
      return ins.busqueda.toLowerCase().includes(s) ||
             ins.descripcion.toLowerCase().includes(s) ||
             ins.tipo.toLowerCase().includes(s) ||
             ins.material.toLowerCase().includes(s) ||
             ins.proveedor.toLowerCase().includes(s) ||
             ins.codigo.toLowerCase().includes(s);
    }
    return true;
  });

  const alarmas = insumos.filter(i => {
    const est = estadoStock(i);
    if (est !== "bajo" && est !== "sin_stock") return false;
    // Verificar si está aplazada
    if (i.alarma_aplazada_hasta) {
      const hasta = new Date(i.alarma_aplazada_hasta);
      if (hasta > new Date()) return false;
    }
    return true;
  });

  const abrirNuevo = () => { setForm({ ...INSUMO_VACIO }); setFormIdx(null); setModal("nuevo"); };
  const abrirEditar = (ins) => { setForm({ ...ins }); setFormIdx(ins._idx); setModal("editar"); };
  const cerrarModal = () => { setModal(null); setForm(INSUMO_VACIO); setFormIdx(null); };

  const guardar = async () => {
    if (!form.descripcion.trim()) return alert("La descripción es obligatoria");
    setGuardando(true);
    try {
      // Generar busqueda automática si está vacía
      if (!form.busqueda.trim()) {
        form.busqueda = [form.descripcion, form.tipo, form.material, form.espesor ? `esp${form.espesor}` : ""]
          .filter(Boolean).join(" ");
      }
      if (modal === "nuevo") {
        await apiSheets("append_insumo", insumoToRow(form));
      } else {
        await apiSheets("update_insumo", insumoToRow(form), formIdx);
      }
      await cargar();
      cerrarModal();
    } catch(e) { console.error(e); }
    setGuardando(false);
  };

  const aplazarAlarma = async () => {
    if (!aplazarFecha) return;
    const ins = insumos.find(i => i._idx === aplazarIdx);
    if (!ins) return;
    const actualizado = { ...ins, alarma_aplazada_hasta: aplazarFecha };
    await apiSheets("update_insumo", insumoToRow(actualizado), aplazarIdx);
    await cargar();
    setModal(null);
    setAplazarFecha("");
    setAplazarIdx(null);
  };

  const inp = (field, label, placeholder = "") => (
    <div>
      <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>{label}</div>
      <input value={form[field]||""} onChange={e => setForm(p => ({...p, [field]: e.target.value}))}
        placeholder={placeholder}
        style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, color: C.text, background: C.bg }} />
    </div>
  );

  const sel = (field, label, options) => (
    <div>
      <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>{label}</div>
      <select value={form[field]||""} onChange={e => setForm(p => ({...p, [field]: e.target.value}))}
        style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, color: C.text, background: C.bg }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  const ss = { background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" };

  return (
    <div style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <button onClick={onVolver}
          style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          ← Volver
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 22, color: C.navy }}>📦 Insumos</div>
          <div style={{ color: C.textMuted, fontSize: 13 }}>{insumos.length} insumos registrados · {alarmas.length > 0 && <span style={{ color: C.danger, fontWeight: 700 }}>⚠ {alarmas.length} con stock bajo</span>}</div>
        </div>
        <button onClick={abrirNuevo}
          style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
          + Nuevo insumo
        </button>
      </div>

      {/* Alertas de stock */}
      {alarmas.length > 0 && (
        <div style={{ background: C.dangerBg, border: `1px solid ${C.danger}44`, borderRadius: 12, padding: "14px 20px", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: C.danger, marginBottom: 8, fontSize: 14 }}>⚠ Insumos con stock bajo o sin stock</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {alarmas.slice(0, 6).map((ins, i) => (
              <div key={i} style={{ background: C.white, borderRadius: 8, padding: "6px 12px", fontSize: 12, border: `1px solid ${C.danger}44` }}>
                <span style={{ fontWeight: 600 }}>{ins.busqueda || ins.descripcion}</span>
                <span style={{ color: C.textMuted }}> · {ins.proveedor}</span>
                <button onClick={() => { setAplazarIdx(ins._idx); setModal("aplazar"); }}
                  style={{ marginLeft: 8, background: "none", border: "none", color: C.warning, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                  Aplazar ⏰
                </button>
              </div>
            ))}
            {alarmas.length > 6 && <div style={{ fontSize: 12, color: C.danger, padding: "6px 0" }}>+{alarmas.length - 6} más...</div>}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div style={{ background: C.white, borderRadius: 12, padding: 16, boxShadow: C.shadow, marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 2, minWidth: 220 }}>
          <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: C.textMuted }}>🔍</span>
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="Buscar por descripción, tipo, material, proveedor..."
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 34px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, color: C.text, background: C.bg, outline: "none" }} />
        </div>
        <select value={fDesc} onChange={e => setFDesc(e.target.value)} style={ss}>
          <option value="todos">Todos los tipos</option>
          {descripciones.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={fProv} onChange={e => setFProv(e.target.value)} style={ss}>
          <option value="todos">Todos los proveedores</option>
          {proveedores.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={fEstado} onChange={e => setFEstado(e.target.value)} style={ss}>
          <option value="todos">Todos los estados</option>
          <option value="alarma">⚠ Con alarma</option>
          <option value="ok">✓ Stock OK</option>
          <option value="ref">— Solo referencia</option>
        </select>
        <div style={{ color: C.textMuted, fontSize: 13 }}>{filtrados.length} resultados</div>
      </div>

      {/* Tabla */}
      <div style={{ background: C.white, borderRadius: 12, boxShadow: C.shadow, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: C.navy }}>
            <tr>
              {["Código", "Descripción / Búsqueda", "Tipo", "Material", "Proveedor", "Espesor", "Precio Pieza", "Fecha Precio", "Stock UN", "Stock Kg", "Mín. UN", "Estado", ""].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#fff", fontWeight: 700, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={13} style={{ padding: "48px 20px", textAlign: "center", color: C.textMuted }}>⏳ Cargando insumos...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={13} style={{ padding: "48px 20px", textAlign: "center", color: C.textMuted }}>Sin resultados</td></tr>
            ) : filtrados.map((ins, i) => {
              const est = estadoStock(ins);
              const estCfg = ESTADO_CFG[est];
              const alarmaActiva = (est === "bajo" || est === "sin_stock") &&
                (!ins.alarma_aplazada_hasta || new Date(ins.alarma_aplazada_hasta) <= new Date());
              return (
                <tr key={i}
                  style={{ borderBottom: `1px solid ${C.border}`, background: alarmaActiva ? "#fff5f5" : "transparent", transition: "background .1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = alarmaActiva ? "#ffeeee" : "#f5f7ff"}
                  onMouseLeave={e => e.currentTarget.style.background = alarmaActiva ? "#fff5f5" : "transparent"}>
                  <td style={{ padding: "10px 14px", fontSize: 11, fontFamily: "monospace", color: C.textMuted }}>{ins.codigo || "—"}</td>
                  <td style={{ padding: "10px 14px", maxWidth: 220 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{ins.busqueda || ins.descripcion}</div>
                    {ins.busqueda && ins.descripcion !== ins.busqueda && (
                      <div style={{ fontSize: 11, color: C.textMuted }}>{ins.descripcion}</div>
                    )}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: C.textSec }}>{ins.tipo || "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: C.textSec }}>{ins.material || "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12 }}>{ins.proveedor || "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: C.textSec }}>{ins.espesor || "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600, color: C.accent }}>{ins.precio_pieza || "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: C.textMuted }}>{ins.fecha_precio || "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: ins.stock_un ? 700 : 400, color: ins.stock_un ? C.text : C.textMuted }}>{ins.stock_un || "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: C.textSec }}>{ins.peso_stock_kg || "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: C.textSec }}>{ins.stock_min_un || "—"}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ background: estCfg.bg, color: estCfg.color, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {estCfg.label}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => abrirEditar(ins)}
                        style={{ background: C.accentBg, color: C.accent, border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                        ✎
                      </button>
                      {alarmaActiva && (
                        <button onClick={() => { setAplazarIdx(ins._idx); setModal("aplazar"); }}
                          style={{ background: C.warningBg, color: C.warning, border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                          ⏰
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal aplazar alarma */}
      {modal === "aplazar" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: C.white, borderRadius: 16, padding: 28, maxWidth: 380, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: C.navy, marginBottom: 8 }}>⏰ Aplazar alarma</div>
            <div style={{ color: C.textSec, fontSize: 14, marginBottom: 20 }}>
              Seleccioná hasta cuándo aplazar la alarma de stock bajo:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {[7, 15, 30, 60].map(d => {
                const fecha = new Date();
                fecha.setDate(fecha.getDate() + d);
                const val = fecha.toISOString().slice(0,10);
                return (
                  <button key={d} onClick={() => setAplazarFecha(val)}
                    style={{ background: aplazarFecha === val ? C.accent : C.accentBg, color: aplazarFecha === val ? "#fff" : C.accent, border: `1px solid ${C.accent}44`, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                    {d} días
                  </button>
                );
              })}
            </div>
            <input type="date" value={aplazarFecha} onChange={e => setAplazarFecha(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={aplazarAlarma} disabled={!aplazarFecha}
                style={{ flex: 1, background: aplazarFecha ? C.accent : "#ccc", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 700, cursor: aplazarFecha ? "pointer" : "not-allowed" }}>
                Aplazar
              </button>
              <button onClick={() => { setModal(null); setAplazarFecha(""); setAplazarIdx(null); }}
                style={{ flex: 1, background: "#6c757d", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 700, cursor: "pointer" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nuevo/editar */}
      {(modal === "nuevo" || modal === "editar") && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: C.white, borderRadius: 16, width: "100%", maxWidth: 860, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>

            <div style={{ background: C.navy, padding: "20px 24px", borderRadius: "16px 16px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>{modal === "nuevo" ? "➕ Nuevo insumo" : "✎ Editar insumo"}</div>
              <button onClick={cerrarModal} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>

            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Identificación */}
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr 1fr", gap: 12 }}>
                {inp("codigo", "Código")}
                {inp("descripcion", "Descripción *", "Ej: Chapa, Caño, Ángulo...")}
                {inp("tipo", "Tipo", "Ej: LAF, Redondo, Igual...")}
                {inp("material", "Material", "Ej: 1010, Inox 304, Aluminio...")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {inp("proveedor", "Proveedor")}
                {inp("busqueda", "Búsqueda (auto si vacío)", "Ej: Chapa LAF 1010 esp1mm")}
              </div>

              {/* Dimensiones */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>Dimensiones</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
                  {inp("largo_mm", "Largo (mm)")}
                  {inp("ancho_mm", "Ancho (mm)")}
                  {inp("ancho_pulg", "Ancho (pulg)")}
                  {inp("medida2_mm", "Medida 2 (mm)")}
                  {inp("espesor", "Espesor")}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 12 }}>
                  {inp("pe", "PE (Peso específico)")}
                  {inp("peso", "Peso (kg/pieza)")}
                </div>
              </div>

              {/* Precios */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>Precios</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  {inp("precio_tn_usd", "Precio Tn (u$s)")}
                  {inp("valor_dolar", "Valor Dólar")}
                  {inp("precio_pieza", "Precio Pieza ($)")}
                  {inp("fecha_precio", "Fecha Precio")}
                </div>
              </div>

              {/* Stock */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>Stock</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {inp("stock_un", "Stock (UN)")}
                  {inp("peso_stock_kg", "Stock (Kg)")}
                  {inp("fecha_stock", "Fecha Stock")}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 12 }}>
                  {inp("stock_minimo_kg", "Stock Mínimo (Kg)")}
                  {inp("stock_min_un", "Stock Mínimo (UN)")}
                  {inp("a_comprar_kg", "A comprar (Kg)")}
                  {inp("a_comprar", "A comprar (UN)")}
                </div>
              </div>

              {/* Configuración */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>Configuración</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {sel("notificar", "Notificar alarma de stock", ["Si", "No"])}
                  {inp("alarma_aplazada_hasta", "Alarma aplazada hasta (YYYY-MM-DD)")}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                <button onClick={guardar} disabled={guardando}
                  style={{ flex: 1, background: C.accent, color: "#fff", border: "none", borderRadius: 8, padding: "12px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                  {guardando ? "Guardando..." : "💾 Guardar"}
                </button>
                <button onClick={cerrarModal}
                  style={{ flex: 1, background: "#6c757d", color: "#fff", border: "none", borderRadius: 8, padding: "12px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
