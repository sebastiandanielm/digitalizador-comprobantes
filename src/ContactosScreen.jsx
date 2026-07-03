import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

const C = {
  bg: "#f0f2f7", white: "#ffffff", border: "#e2e6f0",
  accent: "#0aada8", accentDark: "#088c88", accentBg: "#e6f7f7",
  navy: "#0d1f3c", success: "#27ae60", successBg: "#eafaf1",
  warning: "#e67e22", warningBg: "#fef5ec",
  danger: "#e74c3c", dangerBg: "#fdf0ef",
  text: "#1a1a2e", textSec: "#5a6278", textMuted: "#9aa0b4",
  shadow: "0 2px 12px rgba(0,0,0,0.08)",
};

const TIPOS = ["Cliente", "Proveedor", "Organismo", "Empleado", "Banco", "Socio"];
const CATEGORIAS = ["", "Materia Prima", "Servicio", "Impuesto", "Sueldo", "Flete", "Mantenimiento", "Bienes de Uso", "Otro"];
const PREFERENCIAS = ["", "Cercano", "Lejano", "Indiferente"];

const CONTACTO_VACIO = {
  id: "", cuit: "", razon_social: "", tipo: "Cliente",
  subtipo: "", categoria_costo: "", condicion_pago: "",
  contacto: "", telefono: "", mail: "",
  direccion: "", localidad: "", provincia: "", cp: "",
  condicion_iva: "", cbu: "", banco: "", alias: "",
  preferencia_cheque: "", notas: ""
};

const tipoCfg = {
  Cliente:   { color: "#2980b9", bg: "#eaf4fb" },
  Proveedor: { color: "#0aada8", bg: "#e6f7f7" },
  Organismo: { color: "#e67e22", bg: "#fef5ec" },
  Empleado:  { color: "#27ae60", bg: "#eafaf1" },
  Banco:     { color: "#7b5ef7", bg: "#f0ecff" },
  Socio:     { color: "#e74c3c", bg: "#fdf0ef" },
};

const TipoBadge = ({ tipo }) => {
  const cfg = tipoCfg[tipo] || { color: C.textMuted, bg: C.bg };
  return (
    <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}33`, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
      {tipo}
    </span>
  );
};

async function apiSheets(action, data, rowIndex) {
  const body = { action, data, rowIndex };
  const r = await fetch("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

export default function ContactosScreen({ onVolver }) {
  const [contactos, setContactos] = useState([]);
  const [cargando, setCargando]   = useState(true);
  const [q, setQ]                 = useState("");
  const [fTipo, setFTipo]         = useState("todos");
  const [modal, setModal]         = useState(null); // null | "nuevo" | "editar"
  const [form, setForm]           = useState(CONTACTO_VACIO);
  const [formIdx, setFormIdx]     = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmEliminar, setConfirmEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [msgImport, setMsgImport]   = useState("");
  const fileRef = useRef();

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      const data = await apiSheets("get_contactos");
      const rows = data.values || [];
      if (rows.length <= 1) { setContactos([]); } else {
        setContactos(rows.slice(1).map((row, i) => ({
          _idx: i,
          id: row[0]||"", cuit: row[1]||"", razon_social: row[2]||"",
          tipo: row[3]||"", subtipo: row[4]||"", categoria_costo: row[5]||"",
          condicion_pago: row[6]||"", contacto: row[7]||"", telefono: row[8]||"",
          mail: row[9]||"", direccion: row[10]||"", localidad: row[11]||"",
          provincia: row[12]||"", cp: row[13]||"", condicion_iva: row[14]||"",
          cbu: row[15]||"", banco: row[16]||"", alias: row[17]||"",
          preferencia_cheque: row[18]||"", notas: row[19]||""
        })));
      }
    } catch(e) { console.error(e); }
    setCargando(false);
  };

  const filtrados = contactos.filter(c => {
    if (fTipo !== "todos" && c.tipo !== fTipo) return false;
    if (q.trim()) {
      const s = q.toLowerCase();
      return c.razon_social.toLowerCase().includes(s) ||
             c.cuit.includes(s) ||
             c.contacto.toLowerCase().includes(s) ||
             c.mail.toLowerCase().includes(s);
    }
    return true;
  });

  const abrirNuevo = () => {
    const maxId = contactos.reduce((m, c) => Math.max(m, parseInt(c.id)||0), 0);
    setForm({ ...CONTACTO_VACIO, id: String(maxId + 1).padStart(4, "0") });
    setFormIdx(null);
    setModal("nuevo");
  };

  const abrirEditar = (c) => {
    setForm({ ...c });
    setFormIdx(c._idx);
    setModal("editar");
  };

  const cerrarModal = () => { setModal(null); setForm(CONTACTO_VACIO); setFormIdx(null); };

  const guardar = async () => {
    if (!form.razon_social.trim()) return alert("La razón social es obligatoria");
    setGuardando(true);
    try {
      if (modal === "nuevo") {
        await apiSheets("append_contacto", form);
      } else {
        await apiSheets("update_contacto", form, formIdx);
      }
      await cargar();
      cerrarModal();
    } catch(e) { console.error(e); }
    setGuardando(false);
  };

  const eliminar = async (c) => {
    setEliminando(true);
    try {
      await apiSheets("delete_contacto", {}, c._idx);
      await cargar();
      setConfirmEliminar(null);
    } catch(e) { console.error(e); }
    setEliminando(false);
  };

  const exportar = () => {
    const rows = contactos.map(c => ({
      ID: c.id, CUIT: c.cuit, "Razón Social": c.razon_social,
      Tipo: c.tipo, Subtipo: c.subtipo, "Categoría Costo": c.categoria_costo,
      "Condición Pago": c.condicion_pago, Contacto: c.contacto,
      Teléfono: c.telefono, Mail: c.mail,
      Dirección: c.direccion, Localidad: c.localidad,
      Provincia: c.provincia, CP: c.cp,
      "Condición IVA": c.condicion_iva, CBU: c.cbu,
      Banco: c.banco, Alias: c.alias,
      "Preferencia Cheque": c.preferencia_cheque, Notas: c.notas
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contactos");
    XLSX.writeFile(wb, `contactos_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const importar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportando(true);
    setMsgImport("Leyendo archivo...");
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);
      let ok = 0;
      const maxId = contactos.reduce((m, c) => Math.max(m, parseInt(c.id)||0), 0);
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const c = {
          id: r["ID"] || String(maxId + i + 1).padStart(4, "0"),
          cuit: r["CUIT"] || "",
          razon_social: r["Razón Social"] || r["Razon Social"] || r["razon_social"] || "",
          tipo: r["Tipo"] || "Cliente",
          subtipo: r["Subtipo"] || "",
          categoria_costo: r["Categoría Costo"] || r["Categoria Costo"] || "",
          condicion_pago: r["Condición Pago"] || r["Condicion Pago"] || "",
          contacto: r["Contacto"] || "",
          telefono: r["Teléfono"] || r["Telefono"] || "",
          mail: r["Mail"] || r["Email"] || "",
          direccion: r["Dirección"] || r["Direccion"] || "",
          localidad: r["Localidad"] || "",
          provincia: r["Provincia"] || "",
          cp: r["CP"] || "",
          condicion_iva: r["Condición IVA"] || r["Condicion IVA"] || "",
          cbu: r["CBU"] || "",
          banco: r["Banco"] || "",
          alias: r["Alias"] || "",
          preferencia_cheque: r["Preferencia Cheque"] || "",
          notas: r["Notas"] || ""
        };
        if (!c.razon_social) continue;
        await apiSheets("append_contacto", c);
        ok++;
        setMsgImport(`Importando ${ok} de ${rows.length}...`);
      }
      await cargar();
      setMsgImport(`✓ ${ok} contactos importados correctamente`);
      setTimeout(() => setMsgImport(""), 4000);
    } catch(err) {
      setMsgImport(`⚠ Error: ${err.message}`);
    }
    setImportando(false);
    e.target.value = "";
  };

  const inp = (field, label, placeholder="", opts={}) => (
    <div>
      <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>{label}</div>
      {opts.select ? (
        <select value={form[field]} onChange={e => setForm(p => ({...p, [field]: e.target.value}))}
          style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, color: C.text, background: C.bg }}>
          {opts.options.map(o => <option key={o} value={o}>{o || "— Sin especificar —"}</option>)}
        </select>
      ) : (
        <input value={form[field]||""} onChange={e => setForm(p => ({...p, [field]: e.target.value}))}
          placeholder={placeholder}
          style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, color: C.text, background: C.bg }} />
      )}
    </div>
  );

  const ss = { background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" };

  return (
    <div style={{ padding: "24px", maxWidth: 1300, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <button onClick={onVolver}
          style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          ← Volver
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 22, color: C.navy }}>👥 Contactos</div>
          <div style={{ color: C.textMuted, fontSize: 13 }}>{contactos.length} contactos registrados · Base de datos maestra</div>
        </div>
        <button onClick={() => fileRef.current.click()} disabled={importando}
          style={{ background: C.white, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          📥 Importar Excel
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={importar} />
        <button onClick={exportar} disabled={!contactos.length}
          style={{ background: C.white, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          📤 Exportar Excel
        </button>
        <button onClick={abrirNuevo}
          style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
          + Nuevo contacto
        </button>
      </div>

      {msgImport && (
        <div style={{ background: msgImport.startsWith("✓") ? C.successBg : C.warningBg, border: `1px solid ${msgImport.startsWith("✓") ? C.success : C.warning}44`, borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, fontWeight: 600, color: msgImport.startsWith("✓") ? C.success : C.warning }}>
          {msgImport}
        </div>
      )}

      {/* Filtros */}
      <div style={{ background: C.white, borderRadius: 12, padding: 16, boxShadow: C.shadow, marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: C.textMuted }}>🔍</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre, CUIT, mail o contacto..."
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 34px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, color: C.text, background: C.bg, outline: "none" }} />
        </div>
        <select value={fTipo} onChange={e => setFTipo(e.target.value)} style={ss}>
          <option value="todos">Todos los tipos</option>
          {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div style={{ color: C.textMuted, fontSize: 13 }}>{filtrados.length} resultados</div>
      </div>

      {/* Tabla */}
      <div style={{ background: C.white, borderRadius: 12, boxShadow: C.shadow, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.border}` }}>
              {["ID", "Razón Social / Nombre", "CUIT", "Tipo", "Subtipo", "Categoría Costo", "Contacto", "Teléfono", "Mail", ""].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: C.textMuted, fontWeight: 700, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={10} style={{ padding: "48px 20px", textAlign: "center", color: C.textMuted }}>⏳ Cargando contactos...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: "48px 20px", textAlign: "center", color: C.textMuted }}>{contactos.length === 0 ? "No hay contactos cargados" : "Sin resultados"}</td></tr>
            ) : filtrados.map((c, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.border}`, transition: "background .1s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#f5f7ff"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "monospace", color: C.textMuted }}>{c.id}</td>
                <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 600 }}>{c.razon_social}</td>
                <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "monospace", color: C.textSec }}>{c.cuit || "—"}</td>
                <td style={{ padding: "10px 14px" }}><TipoBadge tipo={c.tipo} /></td>
                <td style={{ padding: "10px 14px", fontSize: 12, color: C.textSec }}>{c.subtipo || "—"}</td>
                <td style={{ padding: "10px 14px", fontSize: 12, color: C.textSec }}>{c.categoria_costo || "—"}</td>
                <td style={{ padding: "10px 14px", fontSize: 12 }}>{c.contacto || "—"}</td>
                <td style={{ padding: "10px 14px", fontSize: 12, color: C.textSec }}>{c.telefono || "—"}</td>
                <td style={{ padding: "10px 14px", fontSize: 12, color: C.accent }}>{c.mail || "—"}</td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => abrirEditar(c)}
                      style={{ background: C.accentBg, color: C.accent, border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                      ✎ Editar
                    </button>
                    <button onClick={() => setConfirmEliminar(c)}
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

      {/* Modal nuevo/editar */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: C.white, borderRadius: 16, width: "100%", maxWidth: 760, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>

            <div style={{ background: C.navy, padding: "20px 24px", borderRadius: "16px 16px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>{modal === "nuevo" ? "➕ Nuevo contacto" : "✎ Editar contacto"}</div>
              <button onClick={cerrarModal} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>

            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Sección principal */}
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr", gap: 12 }}>
                {inp("id", "ID")}
                {inp("razon_social", "Razón Social / Nombre *", "Ej: Hollman Martin Nicolas")}
                {inp("cuit", "CUIT / CUIL", "Ej: 20-30226102-5")}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {inp("tipo", "Tipo *", "", { select: true, options: TIPOS })}
                {inp("subtipo", "Subtipo", "Ej: Ingresos Brutos")}
                {inp("categoria_costo", "Categoría Costo", "", { select: true, options: CATEGORIAS })}
              </div>

              {/* Línea divisoria */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>Datos de contacto</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  {inp("contacto", "Nombre contacto", "Ej: Juan Pérez")}
                  {inp("telefono", "Teléfono", "Ej: 11-5555-1234")}
                  {inp("mail", "Mail", "Ej: juan@empresa.com")}
                </div>
              </div>

              {/* Dirección */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>Dirección</div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 80px", gap: 12 }}>
                  {inp("direccion", "Dirección")}
                  {inp("localidad", "Localidad")}
                  {inp("provincia", "Provincia")}
                  {inp("cp", "CP")}
                </div>
              </div>

              {/* Datos fiscales y pago */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>Datos fiscales y pago</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  {inp("condicion_iva", "Condición IVA", "Ej: IVA Responsable Inscripto")}
                  {inp("condicion_pago", "Condición Pago", "Ej: 30 días")}
                  {inp("preferencia_cheque", "Pref. Cheque", "", { select: true, options: PREFERENCIAS })}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginTop: 12 }}>
                  {inp("cbu", "CBU")}
                  {inp("banco", "Banco")}
                  {inp("alias", "Alias")}
                </div>
              </div>

              {/* Notas */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                {inp("notas", "Notas adicionales")}
              </div>

              {/* Botones */}
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

      {/* Modal confirmar eliminar */}
      {confirmEliminar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: C.white, borderRadius: 14, padding: 28, maxWidth: 400, width: "90%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗑</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>¿Eliminar contacto?</div>
            <div style={{ color: C.textSec, fontSize: 14, marginBottom: 20 }}>
              <strong>{confirmEliminar.razon_social}</strong><br/>
              Esta acción no se puede deshacer.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => eliminar(confirmEliminar)} disabled={eliminando}
                style={{ flex: 1, background: C.danger, color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 700, cursor: "pointer" }}>
                {eliminando ? "Eliminando..." : "Sí, eliminar"}
              </button>
              <button onClick={() => setConfirmEliminar(null)}
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
