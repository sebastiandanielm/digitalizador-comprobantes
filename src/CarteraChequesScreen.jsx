import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

const C = {
  bg: "#f0f2f7", white: "#ffffff", border: "#e2e6f0",
  accent: "#0aada8", accentDark: "#088c88", accentBg: "#e6f7f7",
  navy: "#0d1f3c",
  success: "#27ae60", successBg: "#eafaf1",
  warning: "#e67e22", warningBg: "#fef5ec",
  danger: "#e74c3c", dangerBg: "#fdf0ef",
  blue: "#2980b9", blueBg: "#eaf4fb",
  gray: "#6c757d", grayBg: "#f8f9fa",
  text: "#1a1a2e", textSec: "#5a6278", textMuted: "#9aa0b4",
  shadow: "0 2px 12px rgba(0,0,0,0.08)",
  shadowLg: "0 8px 32px rgba(0,0,0,0.13)",
};

const ESTADOS = ["Disponible", "Entregado a proveedor", "Depositado en banco", "Anulado"];

const estadoCfg = {
  "Disponible":              { color: C.success,  bg: C.successBg  },
  "Entregado a proveedor":   { color: C.warning,  bg: C.warningBg  },
  "Depositado en banco":     { color: C.blue,     bg: C.blueBg     },
  "Anulado":                 { color: C.danger,   bg: C.dangerBg   },
};

const EstadoBadge = ({ estado }) => {
  const cfg = estadoCfg[estado] || { color: C.gray, bg: C.grayBg };
  return (
    <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}33`, borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
      {estado}
    </span>
  );
};

const fmtPeso = (n) => {
  if (n == null || n === "") return "—";
  const num = typeof n === "string" ? parseFloat(n.replace(/\./g, "").replace(",", ".")) : n;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(num);
};

const fmtFecha = (s) => {
  if (!s) return "—";
  // Formato dd/mm/yyyy
  if (s.includes("/")) return s;
  const d = new Date(s + "T00:00:00");
  return isNaN(d) ? s : d.toLocaleDateString("es-AR");
};

const parseMonto = (s) => {
  if (!s) return 0;
  if (typeof s === "number") return s;
  return parseFloat(String(s).replace(/\./g, "").replace(",", ".")) || 0;
};

async function apiSheets(action, data, rowIndex) {
  const r = await fetch("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, data, rowIndex }),
  });
  return r.json();
}

export default function CarteraChequesScreen({ onVolver }) {
  const [cheques, setCheques]         = useState([]);
  const [cargando, setCargando]       = useState(true);
  const [q, setQ]                     = useState("");
  const [fEstado, setFEstado]         = useState("todos");
  const [modal, setModal]             = useState(null);
  const [form, setForm]               = useState({});
  const [formIdx, setFormIdx]         = useState(null);
  const [guardando, setGuardando]     = useState(false);
  const [confirmElim, setConfirmElim] = useState(null);
  const [eliminando, setEliminando]   = useState(false);
  const [importando, setImportando]   = useState(false);
  const [msgImport, setMsgImport]     = useState("");
  const fileRef = useRef();

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      const data = await apiSheets("get_cartera");
      const rows = data.values || [];
      if (rows.length <= 1) { setCheques([]); }
      else {
        setCheques(rows.slice(1).map((row, i) => ({
          _idx: i,
          id:          row[0] || "",
          nro_cheque:  row[1] || "",
          banco:       row[2] || "",
          cuit:        row[3] || "",
          titular:     row[4] || "",
          monto:       row[5] || "",
          fecha_pago:  row[6] || "",
          estado:      row[7] || "Disponible",
          cliente:     row[8] || "",
          origen:      row[9] || "",
          notas:       row[10] || "",
        })));
      }
    } catch(e) { console.error(e); }
    setCargando(false);
  };

  const filtrados = cheques.filter(c => {
    if (fEstado !== "todos" && c.estado !== fEstado) return false;
    if (q.trim()) {
      const s = q.toLowerCase();
      return c.titular.toLowerCase().includes(s) ||
             c.nro_cheque.includes(s) ||
             c.banco.toLowerCase().includes(s) ||
             c.cuit.includes(s) ||
             c.cliente.toLowerCase().includes(s);
    }
    return true;
  });

  // Stats
  const disponibles  = cheques.filter(c => c.estado === "Disponible");
  const totalDisp    = disponibles.reduce((s, c) => s + parseMonto(c.monto), 0);
  const totalGeneral = cheques.reduce((s, c) => s + parseMonto(c.monto), 0);

  const abrirNuevo = () => {
    const maxId = cheques.reduce((m, c) => Math.max(m, parseInt(c.id) || 0), 0);
    setForm({ id: String(maxId + 1).padStart(4, "0"), estado: "Disponible", nro_cheque: "", banco: "", cuit: "", titular: "", monto: "", fecha_pago: "", cliente: "", origen: "", notas: "" });
    setFormIdx(null);
    setModal("form");
  };

  const abrirEditar = (c) => {
    setForm({ ...c });
    setFormIdx(c._idx);
    setModal("form");
  };

  const cerrarModal = () => { setModal(null); setForm({}); setFormIdx(null); };

  const guardar = async () => {
    if (!form.titular?.trim() && !form.nro_cheque?.trim()) return alert("Ingresá al menos el N° de cheque o el titular");
    setGuardando(true);
    try {
      if (modal === "form" && formIdx === null) {
        await apiSheets("append_cheque", form);
      } else {
        await apiSheets("update_cheque", form, formIdx);
      }
      await cargar();
      cerrarModal();
    } catch(e) { console.error(e); }
    setGuardando(false);
  };

  const eliminar = async (c) => {
    setEliminando(true);
    try {
      await apiSheets("delete_cheque", {}, c._idx);
      await cargar();
      setConfirmElim(null);
    } catch(e) { console.error(e); }
    setEliminando(false);
  };

  const cambiarEstado = async (c, nuevoEstado) => {
    try {
      await apiSheets("update_cheque", { ...c, estado: nuevoEstado }, c._idx);
      await cargar();
    } catch(e) { console.error(e); }
  };

  // Importar desde archivo del banco (Credicoop eCheq)
  const importar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportando(true);
    setMsgImport("Leyendo archivo...");
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { raw: false });

      let ok = 0;
      const maxId = cheques.reduce((m, c) => Math.max(m, parseInt(c.id) || 0), 0);

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];

        // Mapeo desde formato Credicoop eCheq
        const cheque = {
          id:         String(maxId + i + 1).padStart(4, "0"),
          nro_cheque: r["Nro. de Cheque"] || r["N° Cheque"] || r["Nro Cheque"] || "",
          banco:      r["Banco"] || r["BancoTitular"] || "",
          cuit:       r["CUIT-CUIL CDI"] || r["CUIT"] || "",
          titular:    r["Emisor"] || r["Titular"] || "",
          monto:      r["Monto"] || "",
          fecha_pago: r["Fecha de Pago"] || r["Fecha pago"] || "",
          estado:     "Disponible", // siempre Disponible al importar
          cliente:    r["Cliente"] || "",
          origen:     r["Motivo"] || r["Origen"] || "",
          notas:      "",
        };

        if (!cheque.nro_cheque && !cheque.titular) continue;

        await apiSheets("append_cheque", cheque);
        ok++;
        setMsgImport(`Importando ${ok} de ${rows.length}...`);
      }

      await cargar();
      setMsgImport(`✓ ${ok} cheques importados correctamente`);
      setTimeout(() => setMsgImport(""), 4000);
    } catch(err) {
      setMsgImport(`⚠ Error: ${err.message}`);
    }
    setImportando(false);
    e.target.value = "";
  };

  const exportar = () => {
    const rows = cheques.map(c => ({
      ID: c.id, "N° Cheque": c.nro_cheque, Banco: c.banco,
      CUIT: c.cuit, Titular: c.titular,
      Monto: parseMonto(c.monto), "Fecha Pago": c.fecha_pago,
      Estado: c.estado, Cliente: c.cliente, Origen: c.origen, Notas: c.notas,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cartera_Cheques");
    XLSX.writeFile(wb, `cartera_cheques_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const inp = (field, label, placeholder = "", type = "text") => (
    <div>
      <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>{label}</div>
      <input
        type={type}
        value={form[field] || ""}
        onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
        placeholder={placeholder}
        style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, color: C.text, background: C.bg }}
      />
    </div>
  );

  const ss = { background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" };

  return (
    <div style={{ padding: "24px", maxWidth: 1300, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <button onClick={onVolver}
          style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          ← Volver
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 22, color: C.navy }}>🏦 Cartera de Cheques</div>
          <div style={{ color: C.textMuted, fontSize: 13 }}>{cheques.length} cheques en total · {disponibles.length} disponibles</div>
        </div>
        <button onClick={() => fileRef.current.click()} disabled={importando}
          style={{ background: C.white, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          📥 Importar del banco
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={importar} />
        <button onClick={exportar} disabled={!cheques.length}
          style={{ background: C.white, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          📤 Exportar Excel
        </button>
        <button onClick={abrirNuevo}
          style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
          + Nuevo cheque
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 16 }}>
        {[
          { label: "Disponibles",    val: disponibles.length,    monto: totalDisp,    color: C.success, icon: "✅" },
          { label: "Total cartera",  val: cheques.length,        monto: totalGeneral, color: C.accent,  icon: "🏦" },
          { label: "Monto disponible", val: fmtPeso(totalDisp),  monto: null,         color: C.navy,    icon: "💰" },
        ].map((s, i) => (
          <div key={i} style={{ background: C.white, borderRadius: 12, padding: "16px 20px", boxShadow: C.shadow, borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>{s.icon} {s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{typeof s.val === "number" ? s.val : s.val}</div>
            {s.monto != null && <div style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>{fmtPeso(s.monto)}</div>}
          </div>
        ))}
      </div>

      {msgImport && (
        <div style={{ background: msgImport.startsWith("✓") ? C.successBg : C.warningBg, border: `1px solid ${msgImport.startsWith("✓") ? C.success : C.warning}44`, borderRadius: 8, padding: "10px 16px", marginBottom: 14, fontSize: 13, fontWeight: 600, color: msgImport.startsWith("✓") ? C.success : C.warning }}>
          {msgImport}
        </div>
      )}

      {/* Filtros */}
      <div style={{ background: C.white, borderRadius: 12, padding: 16, boxShadow: C.shadow, marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: C.textMuted }}>🔍</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por titular, N° cheque, banco o cliente..."
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 34px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, color: C.text, background: C.bg, outline: "none" }} />
        </div>
        <select value={fEstado} onChange={e => setFEstado(e.target.value)} style={ss}>
          <option value="todos">Todos los estados</option>
          {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <div style={{ color: C.textMuted, fontSize: 13 }}>{filtrados.length} resultados</div>
      </div>

      {/* Tabla */}
      <div style={{ background: C.white, borderRadius: 12, boxShadow: C.shadow, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.border}` }}>
              {["N° Cheque", "Titular / Emisor", "CUIT", "Banco", "Monto", "Fecha Pago", "Origen", "Estado", ""].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: C.textMuted, fontWeight: 700, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={9} style={{ padding: "48px 20px", textAlign: "center", color: C.textMuted }}>⏳ Cargando cheques...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: "48px 20px", textAlign: "center", color: C.textMuted }}>{cheques.length === 0 ? "No hay cheques en cartera — importá desde el banco" : "Sin resultados"}</td></tr>
            ) : filtrados.map((c, i) => (
              <tr key={i}
                style={{ borderBottom: `1px solid ${C.border}`, transition: "background .1s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#f5f7ff"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <td style={{ padding: "10px 14px", fontFamily: "monospace", fontWeight: 700, fontSize: 13 }}>{c.nro_cheque}</td>
                <td style={{ padding: "10px 14px", fontSize: 13 }}>
                  <div style={{ fontWeight: 600 }}>{c.titular}</div>
                  {c.cliente && <div style={{ fontSize: 11, color: C.accent }}>Cliente: {c.cliente}</div>}
                </td>
                <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "monospace", color: C.textSec }}>{c.cuit || "—"}</td>
                <td style={{ padding: "10px 14px", fontSize: 12, color: C.textSec }}>{c.banco}</td>
                <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: C.navy }}>{fmtPeso(c.monto)}</td>
                <td style={{ padding: "10px 14px", fontSize: 13, color: c.estado === "Disponible" ? C.success : C.textSec, fontWeight: c.estado === "Disponible" ? 700 : 400 }}>{fmtFecha(c.fecha_pago)}</td>
                <td style={{ padding: "10px 14px", fontSize: 12, color: C.textSec }}>{c.origen || "—"}</td>
                <td style={{ padding: "10px 14px" }}>
                  <select value={c.estado} onChange={e => cambiarEstado(c, e.target.value)}
                    style={{ background: estadoCfg[c.estado]?.bg || C.grayBg, color: estadoCfg[c.estado]?.color || C.gray, border: `1px solid ${estadoCfg[c.estado]?.color || C.gray}44`, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => abrirEditar(c)}
                      style={{ background: C.accentBg, color: C.accent, border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                      ✎
                    </button>
                    <button onClick={() => setConfirmElim(c)}
                      style={{ background: C.dangerBg, color: C.danger, border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal form */}
      {modal === "form" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: C.white, borderRadius: 16, width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto", boxShadow: C.shadowLg }}>
            <div style={{ background: C.navy, padding: "18px 24px", borderRadius: "16px 16px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{formIdx === null ? "➕ Nuevo cheque" : "✎ Editar cheque"}</div>
              <button onClick={cerrarModal} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 12 }}>
                {inp("id", "ID")}
                {inp("nro_cheque", "N° Cheque")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {inp("titular", "Titular / Emisor")}
                {inp("cuit", "CUIT / CUIL")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                {inp("banco", "Banco")}
                {inp("monto", "Monto")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {inp("fecha_pago", "Fecha de Pago", "dd/mm/aaaa")}
                <div>
                  <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>Estado</div>
                  <select value={form.estado || "Disponible"} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))}
                    style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, color: C.text, background: C.bg }}>
                    {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {inp("cliente", "Cliente origen", "¿De qué cliente proviene?")}
                {inp("origen", "Motivo / Origen")}
              </div>
              {inp("notas", "Notas")}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
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

      {/* Modal confirmar eliminar */}
      {confirmElim && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: C.white, borderRadius: 14, padding: 28, maxWidth: 400, width: "90%", textAlign: "center", boxShadow: C.shadowLg }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗑</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>¿Eliminar cheque?</div>
            <div style={{ color: C.textSec, fontSize: 14, marginBottom: 20 }}>
              <strong>N° {confirmElim.nro_cheque}</strong> — {confirmElim.titular}<br />
              {fmtPeso(confirmElim.monto)} · {fmtFecha(confirmElim.fecha_pago)}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => eliminar(confirmElim)} disabled={eliminando}
                style={{ flex: 1, background: C.danger, color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 700, cursor: "pointer" }}>
                {eliminando ? "Eliminando..." : "Sí, eliminar"}
              </button>
              <button onClick={() => setConfirmElim(null)}
                style={{ flex: 1, background: "#6c757d", color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 700, cursor: "pointer" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
