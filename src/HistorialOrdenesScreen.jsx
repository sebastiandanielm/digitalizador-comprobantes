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

const fmtPeso = (n) => {
  if (!n && n !== 0) return "—";
  const num = typeof n === "string" ? parseFloat(n.replace(/\$/g,"").replace(/\./g,"").replace(",",".").trim()) : n;
  if (isNaN(num)) return n || "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(num);
};

const fmtFecha = (s) => {
  if (!s) return "—";
  return s;
};

const parseMonto = (s) => {
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

// Parsear una fila del sheet a objeto orden
function rowToOrden(row, sheetRowIndex) {
  // Columnas: 0=NroOrden, 1=Fecha, 2=Proveedor, 3=CUIT, 4=DatosBancarios
  // 5-11=Fact1, 12-18=Fact2, 19-25=Fact3, 26-32=Fact4, 33-39=Fact5
  // 40=Subtotal, 41=IVA, 42=PercIVA, 43=IIBB_CABA, 44=IIBB_BsAs, 45=TOTAL
  // 46-50=FP1, 51-55=FP2, ... hasta FP17 (cada una: tipo, nro, banco, fecha, monto)

  const facturas = [];
  for (let i = 0; i < 5; i++) {
    const base = 5 + i * 7;
    if (row[base]) {
      facturas.push({
        numero:   row[base]   || "",
        fecha:    row[base+1] || "",
        cantidad: row[base+2] || "",
        detalle:  row[base+3] || "",
        precio:   row[base+4] || "",
        tc:       row[base+5] || "1",
        total:    row[base+6] || "",
      });
    }
  }

  const formas_pago = [];
  for (let i = 0; i < 17; i++) {
    const base = 46 + i * 5;
    if (row[base]) {
      formas_pago.push({
        tipo:       row[base]   || "",
        nro_cheque: row[base+1] || "",
        banco:      row[base+2] || "",
        fecha:      row[base+3] || "",
        monto:      row[base+4] || "",
      });
    }
  }

  return {
    _sheetRowIndex: sheetRowIndex,
    nro_orden:       row[0]  || "",
    fecha:           row[1]  || "",
    proveedor:       row[2]  || "",
    cuit:            row[3]  || "",
    datos_bancarios: row[4]  || "",
    subtotal:        row[40] || "",
    iva:             row[41] || "",
    percepcion_iva:  row[42] || "",
    iibb_caba:       row[43] || "",
    iibb_bsas:       row[44] || "",
    total:           row[45] || "",
    facturas,
    formas_pago,
  };
}

export default function HistorialOrdenesScreen({ onVolver }) {
  const [ordenes, setOrdenes]           = useState([]);
  const [cargando, setCargando]         = useState(true);
  const [busq, setBusq]                 = useState("");
  const [filtroProv, setFiltroProv]     = useState("");
  const [filtroFechaD, setFiltroFechaD] = useState("");
  const [filtroFechaH, setFiltroFechaH] = useState("");
  const [ordenSelec, setOrdenSelec]     = useState(null);
  const [editando, setEditando]         = useState(false);

  const cargar = () => {
    setCargando(true);
    apiSheets("get_ordenes").then(data => {
      const rows = data.values || [];
      // Las primeras 2 filas son encabezados
      const dataRows = rows.slice(2);
      setOrdenes(dataRows.map((r, i) => rowToOrden(r, i + 2)));
      setCargando(false);
    });
  };

  useEffect(() => { cargar(); }, []);

  // Filtros
  const proveedores = [...new Set(ordenes.map(o => o.proveedor).filter(Boolean))].sort();

  const ordenesFiltradas = ordenes.filter(o => {
    if (filtroProv && o.proveedor !== filtroProv) return false;
    if (busq) {
      const s = busq.toLowerCase();
      if (!o.nro_orden.toString().includes(s) &&
          !o.proveedor.toLowerCase().includes(s) &&
          !o.cuit.includes(s)) return false;
    }
    return true;
  }).sort((a, b) => parseInt(b.nro_orden) - parseInt(a.nro_orden));

  if (cargando) return (
    <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>⏳ Cargando órdenes...</div>
  );

  // Vista detalle / edición
  if (ordenSelec) {
    return (
      <DetalleOrden
        orden={ordenSelec}
        editando={editando}
        onVolver={() => { setOrdenSelec(null); setEditando(false); cargar(); }}
        onEditar={() => setEditando(true)}
        onGuardado={() => { setEditando(false); cargar(); setOrdenSelec(null); }}
      />
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <button onClick={onVolver}
          style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          ← Volver
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 22, color: C.navy }}>🔍 Órdenes de pago</div>
          <div style={{ color: C.textMuted, fontSize: 13 }}>{ordenes.length} órdenes en total</div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ background: C.white, borderRadius: 12, boxShadow: C.shadow, padding: "16px 20px", marginBottom: 20, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input value={busq} onChange={e => setBusq(e.target.value)}
          placeholder="🔍 Buscar por N°, proveedor o CUIT..."
          style={{ flex: 2, minWidth: 200, padding: "9px 14px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, outline: "none" }} />
        <select value={filtroProv} onChange={e => setFiltroProv(e.target.value)}
          style={{ flex: 1, minWidth: 180, padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, background: C.bg }}>
          <option value="">Todos los proveedores</option>
          {proveedores.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {(busq || filtroProv) && (
          <button onClick={() => { setBusq(""); setFiltroProv(""); }}
            style={{ background: C.dangerBg, color: C.danger, border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
            Limpiar
          </button>
        )}
        <div style={{ color: C.textMuted, fontSize: 13 }}>{ordenesFiltradas.length} resultado{ordenesFiltradas.length !== 1 ? "s" : ""}</div>
      </div>

      {/* Tabla */}
      <div style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, overflow: "hidden" }}>
        {ordenesFiltradas.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>No hay órdenes que coincidan con los filtros</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.border}`, background: C.bg }}>
                {["N° Orden", "Fecha", "Proveedor", "CUIT", "Facturas", "Total", "Formas de pago", ""].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: C.textMuted, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenesFiltradas.map((o, i) => (
                <tr key={i}
                  style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f5f7ff"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  onClick={() => { setOrdenSelec(o); setEditando(false); }}>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ background: C.navy, color: "#fff", borderRadius: 6, padding: "3px 10px", fontWeight: 700, fontSize: 13 }}>
                      #{o.nro_orden}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 13, color: C.textSec }}>{fmtFecha(o.fecha)}</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600 }}>{o.proveedor}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: C.textMuted, fontFamily: "monospace" }}>{o.cuit}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: C.textSec }}>{o.facturas.length} factura{o.facturas.length !== 1 ? "s" : ""}</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: C.accent }}>{fmtPeso(o.total)}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: C.textSec }}>
                    {o.formas_pago.slice(0,3).map((fp, j) => (
                      <span key={j} style={{ display: "inline-block", background: C.accentBg, color: C.accent, borderRadius: 12, padding: "2px 8px", fontSize: 11, fontWeight: 600, marginRight: 4, marginBottom: 2 }}>
                        {fp.tipo}
                      </span>
                    ))}
                    {o.formas_pago.length > 3 && <span style={{ fontSize: 11, color: C.textMuted }}>+{o.formas_pago.length - 3} más</span>}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ color: C.accent, fontWeight: 700, fontSize: 13 }}>Ver →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Componente Detalle / Edición ──────────────────────────────────────────────
function DetalleOrden({ orden, editando, onVolver, onEditar, onGuardado }) {
  const [cheques, setCheques]             = useState([]);
  const [formasPagoConfig, setFormasPagoConfig] = useState([]);
  const [cargando, setCargando]           = useState(true);
  const [guardando, setGuardando]         = useState(false);

  // Estado editable
  const [formasPago, setFormasPago]       = useState(orden.formas_pago.map(fp => ({ ...fp })));
  const [transferencia, setTransferencia] = useState(0);

  useEffect(() => {
    Promise.all([
      apiSheets("get_cartera"),
      apiSheets("get_formas_pago"),
    ]).then(([chqData, fpData]) => {
      const chqRows = chqData.values || [];
      setCheques(chqRows.slice(1).map((r, i) => ({
        _idx: i, nro_cheque: r[1]||"", banco: r[2]||"",
        titular: r[4]||"", monto: r[5]||"",
        fecha_pago: r[6]||"", estado: r[7]||"Disponible",
      })));
      setFormasPagoConfig(fpData.formas || []);
      setCargando(false);
    });
  }, []);

  const totalOrden = parseMonto(orden.total);
  const totalFormas = formasPago.reduce((s, fp) => s + parseMonto(fp.monto), 0);
  const saldo = totalOrden - totalFormas;

  const agregarFormaPago = () => {
    setFormasPago(prev => [...prev, { tipo: formasPagoConfig[0] || "Transferencia", nro_cheque: "", banco: "", fecha: "", monto: "" }]);
  };

  const actualizarFormaPago = (idx, campo, valor) => {
    setFormasPago(prev => {
      const nuevo = [...prev];
      nuevo[idx] = { ...nuevo[idx], [campo]: valor };
      return nuevo;
    });
  };

  const eliminarFormaPago = async (idx) => {
    const fp = formasPago[idx];
    // Si es un eCheq, preguntar si devolver a disponible
    if (fp.tipo === "Echeq 3" && fp.nro_cheque) {
      const cheque = cheques.find(c => c.nro_cheque === fp.nro_cheque);
      if (cheque && window.confirm(`¿Devolver el cheque N° ${fp.nro_cheque} a "Disponible"?`)) {
        await apiSheets("update_cheque", { ...cheque, estado: "Disponible" }, cheque._idx);
      }
    }
    setFormasPago(prev => prev.filter((_, i) => i !== idx));
  };

  const guardarEdicion = async () => {
    if (Math.abs(saldo) > 1) {
      alert(`El saldo no está cubierto: ${Math.abs(saldo) > 0 ? "faltan" : "sobran"} ${fmtPeso(Math.abs(saldo))}`);
      return;
    }
    setGuardando(true);
    try {
      // Armar formas de pago (máx 17, 5 cols cada una)
      const pagoCols = [];
      for (let i = 0; i < 17; i++) {
        const p = formasPago[i] || {};
        pagoCols.push(p.tipo||"", p.nro_cheque||"", p.banco||"", p.fecha||"", p.monto||"");
      }

      // Armar fila completa para actualizar
      const docCols = [];
      for (let i = 0; i < 5; i++) {
        const f = orden.facturas[i] || {};
        docCols.push(f.numero||"", f.fecha||"", f.cantidad||"", f.detalle||"", f.precio||"", f.tc||"1", f.total||"");
      }

      const row = [
        orden.nro_orden, orden.fecha, orden.proveedor, orden.cuit, orden.datos_bancarios,
        ...docCols,
        orden.subtotal||"", orden.iva||"", orden.percepcion_iva||"",
        orden.iibb_caba||"", orden.iibb_bsas||"", orden.total||"",
        ...pagoCols,
      ];

      await apiSheets("update_orden", { row }, orden._sheetRowIndex);
      onGuardado();
    } catch(e) { console.error(e); alert("Error al guardar: " + e.message); }
    setGuardando(false);
  };

  if (cargando) return <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>⏳ Cargando...</div>;

  const btnS = (bg, disabled = false) => ({
    background: disabled ? "#ccc" : bg, color: "#fff", border: "none",
    borderRadius: 8, padding: "10px 22px", fontWeight: 700, fontSize: 14,
    cursor: disabled ? "not-allowed" : "pointer",
  });

  return (
    <div style={{ padding: "24px", maxWidth: 1000, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <button onClick={onVolver}
          style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          ← Volver al historial
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 22, color: C.navy }}>
            Orden de pago #{orden.nro_orden}
            {editando && <span style={{ marginLeft: 12, background: C.warningBg, color: C.warning, borderRadius: 8, padding: "3px 12px", fontSize: 14 }}>✏ Editando</span>}
          </div>
          <div style={{ color: C.textMuted, fontSize: 13 }}>{orden.fecha} · {orden.proveedor}</div>
        </div>
        {!editando && (
          <button onClick={onEditar} style={{ background: C.warning, color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
            ✏ Editar orden
          </button>
        )}
      </div>

      {/* Proveedor */}
      <div style={{ background: C.white, borderRadius: 12, boxShadow: C.shadow, padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, color: C.navy, marginBottom: 10, fontSize: 15 }}>Proveedor</div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{orden.proveedor}</div>
        <div style={{ fontSize: 13, color: C.textMuted }}>CUIT {orden.cuit}</div>
        {orden.datos_bancarios && <div style={{ fontSize: 12, color: C.textSec, marginTop: 4 }}>{orden.datos_bancarios}</div>}
      </div>

      {/* Facturas */}
      <div style={{ background: C.white, borderRadius: 12, boxShadow: C.shadow, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: 15, color: C.navy }}>
          Facturas incluidas
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.bg }}>
              {["N° Factura", "Fecha", "Cant.", "Detalle", "Precio", "TC", "Total"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: C.textMuted, fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orden.facturas.map((f, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 13, fontWeight: 600 }}>{f.numero}</td>
                <td style={{ padding: "10px 14px", fontSize: 13, color: C.textSec }}>{f.fecha}</td>
                <td style={{ padding: "10px 14px", fontSize: 13 }}>{f.cantidad}</td>
                <td style={{ padding: "10px 14px", fontSize: 13 }}>{f.detalle}</td>
                <td style={{ padding: "10px 14px", fontSize: 13 }}>{fmtPeso(f.precio)}</td>
                <td style={{ padding: "10px 14px", fontSize: 13, color: C.textSec }}>{f.tc}</td>
                <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700 }}>{fmtPeso(f.total)}</td>
              </tr>
            ))}
            <tr style={{ background: C.bg }}>
              <td colSpan={6} style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, fontSize: 13, color: C.textSec }}>TOTAL</td>
              <td style={{ padding: "10px 14px", fontWeight: 800, fontSize: 15, color: C.accent }}>{fmtPeso(orden.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Impuestos */}
      {(orden.iva || orden.percepcion_iva || orden.iibb_caba || orden.iibb_bsas) && (
        <div style={{ background: C.white, borderRadius: 12, boxShadow: C.shadow, padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: C.navy, marginBottom: 12, fontSize: 15 }}>Impuestos</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {[
              { label: "Subtotal", val: orden.subtotal },
              { label: "IVA", val: orden.iva },
              { label: "Percepción IVA", val: orden.percepcion_iva },
              { label: "IIBB CABA", val: orden.iibb_caba },
              { label: "IIBB Bs.As.", val: orden.iibb_bsas },
            ].filter(x => x.val).map((x, i) => (
              <div key={i} style={{ background: C.bg, borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{x.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{fmtPeso(x.val)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formas de pago */}
      <div style={{ background: C.white, borderRadius: 12, boxShadow: C.shadow, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>Formas de pago</div>
          {editando && (
            <button onClick={agregarFormaPago}
              style={{ background: C.accentBg, color: C.accent, border: `1px solid ${C.accent}44`, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
              + Agregar
            </button>
          )}
        </div>

        {!editando ? (
          // Vista de solo lectura
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.bg }}>
                {["Tipo", "N° Cheque / Ref.", "Banco / Descripción", "Fecha", "Monto"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: C.textMuted, fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {formasPago.map((fp, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ background: C.accentBg, color: C.accent, borderRadius: 12, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{fp.tipo}</span>
                  </td>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 13 }}>{fp.nro_cheque || "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, color: C.textSec }}>{fp.banco || "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, color: C.textSec }}>{fp.fecha || "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700 }}>{fmtPeso(fp.monto)}</td>
                </tr>
              ))}
              <tr style={{ background: C.bg }}>
                <td colSpan={4} style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, fontSize: 13, color: C.textSec }}>TOTAL PAGADO</td>
                <td style={{ padding: "10px 14px", fontWeight: 800, fontSize: 15, color: C.success }}>{fmtPeso(totalFormas)}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          // Vista de edición
          <div style={{ padding: 20 }}>
            <div style={{ background: C.warningBg, border: `1px solid ${C.warning}44`, borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: C.warning }}>
              ⚠ Para quitar un eCheque, usá el botón ✕. El sistema te preguntará si querés devolverlo a "Disponible" en la cartera.
            </div>
            {formasPago.map((fp, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap", padding: "12px 14px", background: C.bg, borderRadius: 8 }}>
                <select value={fp.tipo} onChange={e => actualizarFormaPago(i, "tipo", e.target.value)}
                  style={{ padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, background: C.white }}>
                  {formasPagoConfig.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <input placeholder="N° cheque / ref." value={fp.nro_cheque} onChange={e => actualizarFormaPago(i, "nro_cheque", e.target.value)}
                  style={{ width: 120, padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13 }} />
                <input placeholder="Banco / descripción" value={fp.banco} onChange={e => actualizarFormaPago(i, "banco", e.target.value)}
                  style={{ width: 160, padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13 }} />
                <input placeholder="Fecha" value={fp.fecha} onChange={e => actualizarFormaPago(i, "fecha", e.target.value)}
                  style={{ width: 110, padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13 }} />
                <input placeholder="Monto" value={fp.monto} onChange={e => actualizarFormaPago(i, "monto", e.target.value)}
                  style={{ width: 130, padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontWeight: 700 }} />
                <button onClick={() => eliminarFormaPago(i)}
                  style={{ background: C.dangerBg, color: C.danger, border: "none", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontWeight: 700 }}>✕</button>
              </div>
            ))}

            {/* Saldo */}
            <div style={{ marginTop: 16, padding: "14px 16px", background: Math.abs(saldo) < 1 ? C.successBg : C.dangerBg, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: Math.abs(saldo) < 1 ? C.success : C.danger }}>
                {Math.abs(saldo) < 1 ? "✓ Saldo cubierto" : saldo > 0 ? "⚠ Falta cubrir" : "⚠ Exceso"}
              </span>
              <span style={{ fontWeight: 800, fontSize: 16, color: Math.abs(saldo) < 1 ? C.success : C.danger }}>
                Total orden: {fmtPeso(totalOrden)} · Asignado: {fmtPeso(totalFormas)} · Diferencia: {fmtPeso(Math.abs(saldo))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Botones edición */}
      {editando && (
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={guardarEdicion} disabled={Math.abs(saldo) > 1 || guardando}
            style={btnS(C.accent, Math.abs(saldo) > 1 || guardando)}>
            {guardando ? "⏳ Guardando..." : "✓ Guardar cambios"}
          </button>
          <button onClick={onVolver} style={btnS("#6c757d")}>Cancelar</button>
        </div>
      )}
    </div>
  );
}
