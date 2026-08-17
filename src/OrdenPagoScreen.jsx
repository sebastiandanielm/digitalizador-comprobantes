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
  const num = typeof n === "string" ? parseFloat(n.replace(/\./g, "").replace(",", ".")) : n;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(num);
};

const fmtFecha = (s) => {
  if (!s) return "—";
  if (s.includes("/")) return s;
  const d = new Date(s + "T00:00:00");
  return isNaN(d) ? s : d.toLocaleDateString("es-AR");
};

const parseMonto = (s) => {
  if (!s && s !== 0) return 0;
  if (typeof s === "number") return s;
  return parseFloat(String(s).replace(/\./g, "").replace(",", ".")) || 0;
};

const diasHastaFecha = (fechaStr) => {
  if (!fechaStr) return 0;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  let fecha;
  if (fechaStr.includes("/")) {
    const [d, m, a] = fechaStr.split("/");
    fecha = new Date(`${a}-${m}-${d}T00:00:00`);
  } else {
    fecha = new Date(fechaStr + "T00:00:00");
  }
  return Math.round((fecha - hoy) / (1000 * 60 * 60 * 24));
};

// ── Solver de cheques ──────────────────────────────────────────────────────────
// Algoritmo knapsack modificado para minimizar efectivo adicional
// Prioriza cheques lejanos (más días) o cercanos según configuración
function parseDiasCondicion(condicion) {
  if (!condicion) return null;
  const lower = condicion.toLowerCase();
  if (lower.includes("inmediato") || lower.includes("contado")) return 0;
  const match = condicion.match(/\d+/);
  return match ? parseInt(match[0]) : null;
}

function solverCheques(cheques, montoObjetivo, diasMaximos = null) {
  const disponibles = cheques
    .filter(c => c.estado === "Disponible")
    .map(c => ({
      ...c,
      montoNum: parseMonto(c.monto),
      dias: diasHastaFecha(c.fecha_pago),
    }))
    .filter(c => c.montoNum > 0)
    // Filtrar por días máximos si está definido
    .filter(c => diasMaximos === null || c.dias <= diasMaximos);

  if (disponibles.length === 0) return { seleccionados: [], transferencia: montoObjetivo };

  // Ordenar por días ascendente (más cercanos primero dentro del límite)
  const ordenados = [...disponibles].sort((a, b) => a.dias - b.dias);

  let mejorCombinacion = [];
  let mejorDiferencia = Infinity;

  const buscar = (idx, acumulado, seleccion) => {
    const diferencia = montoObjetivo - acumulado;
    if (acumulado >= montoObjetivo) {
      const exceso = acumulado - montoObjetivo;
      if (exceso < mejorDiferencia) {
        mejorDiferencia = exceso;
        mejorCombinacion = [...seleccion];
      }
      return;
    }
    if (idx >= ordenados.length) {
      if (diferencia < mejorDiferencia) {
        mejorDiferencia = diferencia;
        mejorCombinacion = [...seleccion];
      }
      return;
    }
    if (seleccion.length >= 10) {
      if (diferencia < mejorDiferencia) {
        mejorDiferencia = diferencia;
        mejorCombinacion = [...seleccion];
      }
      return;
    }
    buscar(idx + 1, acumulado + ordenados[idx].montoNum, [...seleccion, ordenados[idx]]);
    buscar(idx + 1, acumulado, seleccion);
  };

  buscar(0, 0, []);

  const totalCheques = mejorCombinacion.reduce((s, c) => s + c.montoNum, 0);
  const transferencia = Math.max(0, montoObjetivo - totalCheques);
  const vuelto = Math.max(0, totalCheques - montoObjetivo);

  return { seleccionados: mejorCombinacion, transferencia, vuelto, totalCheques };
}

async function apiSheets(action, data, rowIndex) {
  const r = await fetch("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, data, rowIndex }),
  });
  return r.json();
}

export default function OrdenPagoScreen({ onVolver }) {
  const [paso, setPaso]               = useState(1); // 1=proveedor, 2=facturas, 3=pago
  const [contactos, setContactos]     = useState([]);
  const [comprobantes, setComprobantes] = useState([]);
  const [cheques, setCheques]         = useState([]);
  const [cargando, setCargando]       = useState(true);

  const [busqProv, setBusqProv]       = useState("");
  const [proveedor, setProveedor]     = useState(null);
  const [facturasSelec, setFacturasSelec] = useState(new Set());
  const [ordenCheques, setOrdenCheques] = useState("dias_asc");
  const [verSolo, setVerSolo]           = useState("todos"); // "todos" | "seleccionados"
  const [solucionSolver, setSolucionSolver] = useState(null);
  const [chequesManual, setChequesManual]   = useState([]);
  const [transferencia, setTransferencia]   = useState(0);
  const [guardando, setGuardando]     = useState(false);
  const [ordenGenerada, setOrdenGenerada] = useState(null);

  useEffect(() => {
    Promise.all([
      apiSheets("get_contactos"),
      apiSheets("get"),
      apiSheets("get_cartera"),
    ]).then(([ctData, compData, chqData]) => {
      // Contactos — solo proveedores
      const ctRows = ctData.values || [];
      setContactos(ctRows.slice(1)
        .map((r, i) => ({
          _idx: i, id: r[0]||"", cuit: r[1]||"", razon_social: r[2]||"",
          tipo: r[3]||"", subtipo: r[4]||"", categoria_costo: r[5]||"",
          condicion_pago: r[6]||"", contacto: r[7]||"", telefono: r[8]||"",
          mail: r[9]||"", cbu: r[15]||"", banco: r[16]||"", alias: r[17]||"",
          preferencia_cheque: r[18]||"",
        }))
        .filter(c => c.tipo === "Proveedor")
      );

      // Comprobantes — facturas con total > 0
      const compRows = compData.values || [];
      setComprobantes(compRows.slice(1).map((r, i) => ({
        _idx: i,
        archivo: r[0]||"", tipo: r[1]||"", numero: r[2]||"",
        punto_venta: r[3]||"", fecha: r[4]||"", fecha_vto: r[5]||"",
        emisor: r[6]||"", cuit_emisor: r[7]||"",
        neto: r[10] ? parseFloat(r[10]) : 0,
        total: r[16] ? parseFloat(r[16]) : 0,
        estado: r[21]||"procesado",
      })).filter(c => c.total > 0 && !["recibo_sueldo","ddjj"].includes(c.tipo)));

      // Cheques disponibles
      const chqRows = chqData.values || [];
      setCheques(chqRows.slice(1).map((r, i) => ({
        _idx: i, id: r[0]||"", nro_cheque: r[1]||"", banco: r[2]||"",
        cuit: r[3]||"", titular: r[4]||"", monto: r[5]||"",
        fecha_pago: r[6]||"", estado: r[7]||"Disponible",
        cliente: r[8]||"", origen: r[9]||"",
      })));

      setCargando(false);
    });
  }, []);

  // Proveedores filtrados por búsqueda
  const proveedoresFiltrados = contactos.filter(c => {
    const s = busqProv.toLowerCase();
    return c.razon_social.toLowerCase().includes(s) || c.cuit.includes(s);
  });

  // Facturas del proveedor seleccionado (pendientes de pago)
  const facturasProv = proveedor
    ? comprobantes.filter(c =>
        c.cuit_emisor.replace(/[-\s]/g,"") === proveedor.cuit.replace(/[-\s]/g,"") &&
        c.estado !== "pagado"
      )
    : [];

  const totalSeleccionado = [...facturasSelec].reduce((s, idx) => {
    const f = facturasProv.find((_, i) => i === idx);
    return s + (f?.total || 0);
  }, 0);

  const toggleFactura = (idx) => {
    setFacturasSelec(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const ejecutarSolver = (dias = diasMaximos) => {
    const resultado = solverCheques(cheques, totalSeleccionado, dias);
    setSolucionSolver(resultado);
    setChequesManual(resultado.seleccionados.map(c => ({ ...c, _seleccionado: true })));
    setTransferencia(resultado.transferencia);
  };

  const irAPago = () => {
    const dias = parseDiasCondicion(proveedor?.condicion_pago);
    if (dias === null) {
      // No tiene condición definida — preguntar
      setPreguntarDias(true);
    } else {
      setDiasMaximos(dias);
      setPaso(3);
      ejecutarSolver(dias);
    }
  };

  const toggleChequeManual = (cheque) => {
    setChequesManual(prev => {
      const existe = prev.find(c => c.nro_cheque === cheque.nro_cheque);
      let nuevos;
      if (existe) {
        nuevos = prev.filter(c => c.nro_cheque !== cheque.nro_cheque);
      } else {
        nuevos = [...prev, { ...cheque, montoNum: parseMonto(cheque.monto) }];
      }
      const totalCheques = nuevos.reduce((s, c) => s + parseMonto(c.monto), 0);
      setTransferencia(Math.max(0, totalSeleccionado - totalCheques));
      return nuevos;
    });
  };

  const totalChequesSel = chequesManual.reduce((s, c) => s + parseMonto(c.monto), 0);
  const saldo = totalSeleccionado - totalChequesSel - transferencia;

  const confirmarOrden = async () => {
    if (Math.abs(saldo) > 1) {
      alert(`El saldo no está cubierto: ${fmtPeso(Math.abs(saldo))} ${saldo > 0 ? "faltan" : "sobran"}`);
      return;
    }
    setGuardando(true);
    try {
      // Generar número de orden
      const nroOrden = Date.now();
      const fecha = new Date().toLocaleDateString("es-AR");

      // Marcar cheques como "Entregado a proveedor"
      for (const cheque of chequesManual) {
        await apiSheets("update_cheque", { ...cheque, estado: "Entregado a proveedor" }, cheque._idx);
      }

      setOrdenGenerada({
        nro: nroOrden,
        fecha,
        proveedor: proveedor.razon_social,
        cuit: proveedor.cuit,
        cbu: proveedor.cbu,
        banco: proveedor.banco,
        facturas: facturasProv.filter((_, i) => facturasSelec.has(i)),
        total: totalSeleccionado,
        cheques: chequesManual,
        transferencia,
      });
      setPaso(4);
    } catch(e) { console.error(e); }
    setGuardando(false);
  };

  const ss = { background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" };
  const btnS = (bg, disabled = false) => ({
    background: disabled ? "#ccc" : bg, color: "#fff", border: "none",
    borderRadius: 8, padding: "10px 22px", fontWeight: 700, fontSize: 14,
    cursor: disabled ? "not-allowed" : "pointer",
  });

  if (cargando) return (
    <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>⏳ Cargando datos...</div>
  );

  return (
    <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <button onClick={onVolver}
          style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          ← Volver
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 22, color: C.navy }}>💳 Nueva Orden de Pago</div>
          <div style={{ color: C.textMuted, fontSize: 13 }}>Seleccioná proveedor → facturas → forma de pago</div>
        </div>
      </div>

      {/* Pasos */}
      <div style={{ display: "flex", gap: 0, marginBottom: 24, background: C.white, borderRadius: 12, overflow: "hidden", boxShadow: C.shadow }}>
        {[
          { n: 1, label: "Proveedor" },
          { n: 2, label: "Facturas" },
          { n: 3, label: "Forma de pago" },
          { n: 4, label: "Confirmación" },
        ].map((p, i) => (
          <div key={p.n} style={{
            flex: 1, padding: "14px", textAlign: "center",
            background: paso === p.n ? C.accent : paso > p.n ? C.successBg : C.white,
            color: paso === p.n ? "#fff" : paso > p.n ? C.success : C.textMuted,
            fontWeight: 700, fontSize: 13,
            borderRight: i < 3 ? `1px solid ${C.border}` : "none",
            transition: "all .2s",
          }}>
            {paso > p.n ? "✓ " : `${p.n}. `}{p.label}
          </div>
        ))}
      </div>

      {/* ── PASO 1: Selección de proveedor ── */}
      {paso === 1 && (
        <div style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, padding: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, color: C.navy }}>Seleccioná el proveedor</div>
          <input value={busqProv} onChange={e => setBusqProv(e.target.value)}
            placeholder="Buscar por nombre o CUIT..."
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, marginBottom: 16, outline: "none" }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto" }}>
            {proveedoresFiltrados.length === 0 ? (
              <div style={{ color: C.textMuted, textAlign: "center", padding: 20 }}>No hay proveedores que coincidan</div>
            ) : proveedoresFiltrados.map((c, i) => (
              <div key={i} onClick={() => { setProveedor(c); setPaso(2); }}
                style={{ padding: "14px 16px", border: `2px solid ${proveedor?.cuit === c.cuit ? C.accent : C.border}`, borderRadius: 10, cursor: "pointer", transition: "all .15s", background: proveedor?.cuit === c.cuit ? C.accentBg : C.white }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
                onMouseLeave={e => e.currentTarget.style.borderColor = proveedor?.cuit === c.cuit ? C.accent : C.border}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.razon_social}</div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>
                  CUIT {c.cuit}
                  {c.banco && ` · ${c.banco}`}
                  {c.cbu && ` · CBU: ${c.cbu}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PASO 2: Selección de facturas ── */}
      {paso === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: C.accentBg, border: `1px solid ${C.accent}44`, borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, color: C.accentDark }}>{proveedor.razon_social}</div>
              <div style={{ fontSize: 12, color: C.textSec }}>CUIT {proveedor.cuit}</div>
            </div>
            <button onClick={() => { setProveedor(null); setPaso(1); setFacturasSelec(new Set()); }}
              style={{ background: "transparent", border: `1px solid ${C.accent}`, color: C.accent, borderRadius: 7, padding: "6px 14px", cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
              Cambiar proveedor
            </button>
          </div>

          <div style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: 15, color: C.navy }}>
              Facturas pendientes — {facturasProv.length} encontradas
            </div>
            {facturasProv.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: C.textMuted }}>
                No hay facturas pendientes para este proveedor
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                    <th style={{ padding: "10px 14px", width: 36 }}>
                      <input type="checkbox"
                        checked={facturasSelec.size === facturasProv.length}
                        onChange={() => {
                          if (facturasSelec.size === facturasProv.length) setFacturasSelec(new Set());
                          else setFacturasSelec(new Set(facturasProv.map((_, i) => i)));
                        }}
                        style={{ cursor: "pointer", width: 16, height: 16 }} />
                    </th>
                    {["N° Factura", "Fecha", "Vto.", "Neto", "Total"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: C.textMuted, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {facturasProv.map((f, i) => (
                    <tr key={i} onClick={() => toggleFactura(i)}
                      style={{ borderBottom: `1px solid ${C.border}`, background: facturasSelec.has(i) ? "#fff8e6" : "transparent", cursor: "pointer" }}
                      onMouseEnter={e => { if (!facturasSelec.has(i)) e.currentTarget.style.background = "#f5f7ff"; }}
                      onMouseLeave={e => { if (!facturasSelec.has(i)) e.currentTarget.style.background = "transparent"; }}>
                      <td style={{ padding: "10px 14px" }} onClick={e => { e.stopPropagation(); toggleFactura(i); }}>
                        <input type="checkbox" checked={facturasSelec.has(i)} onChange={() => toggleFactura(i)} style={{ cursor: "pointer", width: 16, height: 16 }} />
                      </td>
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 13 }}>{f.numero || f.archivo}</td>
                      <td style={{ padding: "10px 14px", fontSize: 13, color: C.textSec }}>{fmtFecha(f.fecha)}</td>
                      <td style={{ padding: "10px 14px", fontSize: 13, color: C.textSec }}>{fmtFecha(f.fecha_vto)}</td>
                      <td style={{ padding: "10px 14px", fontSize: 13 }}>{fmtPeso(f.neto)}</td>
                      <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700 }}>{fmtPeso(f.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {facturasSelec.size > 0 && (
            <div style={{ background: C.navy, borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#fff" }}>
                <span style={{ fontSize: 13, color: "#7a9cc8" }}>{facturasSelec.size} factura{facturasSelec.size > 1 ? "s" : ""} seleccionada{facturasSelec.size > 1 ? "s" : ""}</span>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.accent }}>{fmtPeso(totalSeleccionado)}</div>
              </div>
              <button onClick={irAPago} style={btnS(C.accent)}>
                Continuar → Forma de pago
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── PASO 3: Forma de pago ── */}
      {paso === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Resumen */}
          <div style={{ background: C.navy, borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: "#7a9cc8", fontSize: 13 }}>{proveedor.razon_social} · {facturasSelec.size} factura{facturasSelec.size > 1 ? "s" : ""}</div>
              <div style={{ color: "#fff", fontSize: 22, fontWeight: 800 }}>Total a pagar: {fmtPeso(totalSeleccionado)}</div>
            </div>
            <button onClick={() => setPaso(2)} style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 600 }}>
              ← Volver a facturas
            </button>
          </div>

          {/* Modal: preguntar días cuando el proveedor no tiene condición definida */}
          {preguntarDias && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ background: C.white, borderRadius: 16, padding: 28, maxWidth: 420, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: C.navy, marginBottom: 8 }}>⚠ Condición de pago no definida</div>
                <div style={{ color: C.textSec, fontSize: 14, marginBottom: 20 }}>
                  <strong>{proveedor?.razon_social}</strong> no tiene condición de pago registrada.<br/>
                  ¿Hasta cuántos días acepta cheques?
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
                  {[0, 15, 30, 45, 60, 90].map(d => (
                    <button key={d} onClick={() => {
                      setDiasMaximos(d);
                      setPreguntarDias(false);
                      setPaso(3);
                      ejecutarSolver(d);
                    }}
                      style={{ background: C.accentBg, color: C.accent, border: `1px solid ${C.accent}44`, borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
                      {d === 0 ? "Inmediato" : `${d} días`}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input type="number" placeholder="Otro valor..."
                    style={{ flex: 1, padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14 }}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        const d = parseInt(e.target.value) || 0;
                        setDiasMaximos(d);
                        setPreguntarDias(false);
                        setPaso(3);
                        ejecutarSolver(d);
                      }
                    }}
                  />
                  <button onClick={() => setPreguntarDias(false)}
                    style={{ background: "#6c757d", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontWeight: 600 }}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Info condición de pago */}
          <div style={{ background: C.white, borderRadius: 12, boxShadow: C.shadow, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13 }}>
              <span style={{ color: C.textMuted }}>Condición de pago: </span>
              <strong>{proveedor?.condicion_pago || "No definida"}</strong>
              <span style={{ color: C.textMuted, marginLeft: 12 }}>→ Cheques hasta </span>
              <strong>{diasMaximos === 0 ? "hoy (inmediato)" : diasMaximos !== null ? `${diasMaximos} días` : "sin límite"}</strong>
            </div>
            <button onClick={() => setPreguntarDias(true)}
              style={{ background: C.accentBg, color: C.accent, border: `1px solid ${C.accent}44`, borderRadius: 7, padding: "6px 14px", cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
              Cambiar días
            </button>
          </div>

          {/* Configuración del solver */}
          <div style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.navy, marginBottom: 10 }}>⚙ Optimizador de cheques</div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ fontSize: 13, color: C.textSec }}>Filtrando cheques con hasta <strong>{diasMaximos === 0 ? "0 días" : diasMaximos !== null ? `${diasMaximos} días` : "sin límite"}</strong> a cobrar</div>
              <button onClick={() => ejecutarSolver()}
                style={{ background: C.accentBg, color: C.accent, border: `1px solid ${C.accent}44`, borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                🔄 Recalcular
              </button>
            </div>
          </div>
          {solucionSolver && (
            <div style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>
                  🤖 Cheques disponibles — {cheques.filter(c => c.estado === "Disponible").length} en cartera · <span style={{ color: C.success }}>{chequesManual.length} seleccionados</span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <select value={verSolo} onChange={e => setVerSolo(e.target.value)}
                    style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                    <option value="todos">Ver todos</option>
                    <option value="seleccionados">Solo seleccionados ({chequesManual.length})</option>
                  </select>
                  <select value={ordenCheques} onChange={e => setOrdenCheques(e.target.value)}
                    style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                    <option value="dias_asc">Días ↑ más cercanos</option>
                    <option value="dias_desc">Días ↓ más lejanos</option>
                    <option value="monto_desc">Monto ↓ mayor primero</option>
                    <option value="monto_asc">Monto ↑ menor primero</option>
                  </select>
                </div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                    <th style={{ padding: "10px 14px", width: 36 }}></th>
                    {["N° Cheque", "Titular", "Banco", "Fecha Pago", "Días", "Monto"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: C.textMuted, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let lista = cheques
                      .filter(c => c.estado === "Disponible")
                      .map(c => ({ ...c, _dias: diasHastaFecha(c.fecha_pago), _monto: parseMonto(c.monto) }));
                    if (verSolo === "seleccionados") {
                      lista = lista.filter(c => chequesManual.find(ch => ch.nro_cheque === c.nro_cheque));
                    }
                    lista.sort((a, b) => {
                      if (ordenCheques === "dias_asc")   return a._dias - b._dias;
                      if (ordenCheques === "dias_desc")  return b._dias - a._dias;
                      if (ordenCheques === "monto_desc") return b._monto - a._monto;
                      if (ordenCheques === "monto_asc")  return a._monto - b._monto;
                      return 0;
                    });
                    return lista.map((c, i) => {
                      const seleccionado = chequesManual.find(ch => ch.nro_cheque === c.nro_cheque);
                      const dentroDelLimite = diasMaximos === null || c._dias <= diasMaximos;
                      return (
                        <tr key={i} onClick={() => toggleChequeManual(c)}
                          style={{ borderBottom: `1px solid ${C.border}`, background: seleccionado ? C.successBg : !dentroDelLimite ? "#fff8f8" : "transparent", cursor: "pointer" }}
                          onMouseEnter={e => { if (!seleccionado) e.currentTarget.style.background = "#f5f7ff"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = seleccionado ? C.successBg : !dentroDelLimite ? "#fff8f8" : "transparent"; }}>
                          <td style={{ padding: "10px 14px" }}>
                            <input type="checkbox" checked={!!seleccionado} onChange={() => toggleChequeManual(c)} style={{ cursor: "pointer", width: 16, height: 16 }} />
                          </td>
                          <td style={{ padding: "10px 14px", fontFamily: "monospace", fontWeight: 700, fontSize: 13 }}>{c.nro_cheque}</td>
                          <td style={{ padding: "10px 14px", fontSize: 13 }}>{c.titular}</td>
                          <td style={{ padding: "10px 14px", fontSize: 12, color: C.textSec }}>{c.banco}</td>
                          <td style={{ padding: "10px 14px", fontSize: 13, color: C.textSec }}>{fmtFecha(c.fecha_pago)}</td>
                          <td style={{ padding: "10px 14px", fontSize: 12 }}>
                            <span style={{ background: c._dias >= 0 ? (dentroDelLimite ? C.successBg : C.warningBg) : C.dangerBg, color: c._dias >= 0 ? (dentroDelLimite ? C.success : C.warning) : C.danger, borderRadius: 20, padding: "2px 8px", fontWeight: 700, fontSize: 11 }}>
                              {c._dias >= 0 ? `+${c._dias}d` : `${c._dias}d`}
                            </span>
                            {!dentroDelLimite && <span style={{ fontSize: 10, color: C.warning, marginLeft: 4 }}>⚠ fuera de límite</span>}
                          </td>
                          <td style={{ padding: "10px 14px", fontWeight: 700, fontSize: 13 }}>{fmtPeso(c._monto)}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}

          {/* Transferencia adicional */}
          <div style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.navy, marginBottom: 14 }}>💸 Complemento por transferencia</div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ fontSize: 13, color: C.textSec }}>Monto a transferir:</div>
              <input
                type="number"
                value={transferencia}
                onChange={e => setTransferencia(parseFloat(e.target.value) || 0)}
                style={{ width: 200, padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontWeight: 700 }}
              />
            </div>
          </div>

          {/* Resumen final */}
          <div style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.navy, marginBottom: 14 }}>📊 Resumen de pago</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: C.textSec }}>Total a pagar</span>
                <span style={{ fontWeight: 700 }}>{fmtPeso(totalSeleccionado)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: C.textSec }}>Cheques seleccionados ({chequesManual.length})</span>
                <span style={{ fontWeight: 700, color: C.success }}>- {fmtPeso(totalChequesSel)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: C.textSec }}>Transferencia</span>
                <span style={{ fontWeight: 700, color: C.blue }}>- {fmtPeso(transferencia)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, borderTop: `2px solid ${C.border}`, paddingTop: 10, marginTop: 4 }}>
                <span>Saldo</span>
                <span style={{ color: Math.abs(saldo) < 1 ? C.success : C.danger }}>
                  {fmtPeso(Math.abs(saldo))} {Math.abs(saldo) < 1 ? "✓ Cubierto" : saldo > 0 ? "⚠ Falta cubrir" : "⚠ Exceso"}
                </span>
              </div>
            </div>
          </div>

          <button onClick={confirmarOrden} disabled={Math.abs(saldo) > 1 || guardando} style={btnS(C.accent, Math.abs(saldo) > 1 || guardando)}>
            {guardando ? "⏳ Generando orden..." : "✓ Confirmar y generar orden de pago"}
          </button>
        </div>
      )}

      {/* ── PASO 4: Orden generada ── */}
      {paso === 4 && ordenGenerada && (
        <div style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, padding: 28 }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <div style={{ fontWeight: 800, fontSize: 20, color: C.navy, marginBottom: 6 }}>Orden de pago generada</div>
            <div style={{ color: C.textMuted, fontSize: 14 }}>N° {ordenGenerada.nro} · {ordenGenerada.fecha}</div>
          </div>

          <div style={{ border: `2px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, color: C.navy, marginBottom: 12, fontSize: 15 }}>Proveedor</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{ordenGenerada.proveedor}</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>CUIT {ordenGenerada.cuit}</div>
            {ordenGenerada.banco && <div style={{ fontSize: 12, color: C.textMuted }}>Banco: {ordenGenerada.banco}</div>}
            {ordenGenerada.cbu && <div style={{ fontSize: 12, color: C.textMuted }}>CBU: {ordenGenerada.cbu}</div>}
          </div>

          <div style={{ border: `2px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, color: C.navy, marginBottom: 12, fontSize: 15 }}>Forma de pago</div>
            {ordenGenerada.cheques.map((c, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span>eCheq N° {c.nro_cheque} · {c.banco} · {fmtFecha(c.fecha_pago)}</span>
                <span style={{ fontWeight: 700 }}>{fmtPeso(parseMonto(c.monto))}</span>
              </div>
            ))}
            {ordenGenerada.transferencia > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span>Transferencia bancaria</span>
                <span style={{ fontWeight: 700 }}>{fmtPeso(ordenGenerada.transferencia)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, borderTop: `2px solid ${C.border}`, paddingTop: 10, marginTop: 8 }}>
              <span>TOTAL PAGADO</span>
              <span style={{ color: C.accent }}>{fmtPeso(ordenGenerada.total)}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => { setPaso(1); setProveedor(null); setFacturasSelec(new Set()); setSolucionSolver(null); setChequesManual([]); setOrdenGenerada(null); }}
              style={btnS(C.accent)}>
              + Nueva orden de pago
            </button>
            <button onClick={onVolver} style={btnS("#6c757d")}>Volver al inicio</button>
          </div>
        </div>
      )}
    </div>
  );
}
