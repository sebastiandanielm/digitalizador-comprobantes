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
    .map(c => ({ ...c, montoNum: parseMonto(c.monto), dias: diasHastaFecha(c.fecha_pago) }))
    .filter(c => c.montoNum > 0)
    .filter(c => diasMaximos === null || c.dias <= diasMaximos);

  if (disponibles.length === 0) return { seleccionados: [], transferencia: montoObjetivo };

  const ordenados = [...disponibles].sort((a, b) => a.dias - b.dias);
  let mejorCombinacion = [];
  let mejorDiferencia = Infinity;

  const buscar = (idx, acumulado, seleccion) => {
    const diferencia = montoObjetivo - acumulado;
    if (acumulado >= montoObjetivo) {
      const exceso = acumulado - montoObjetivo;
      if (exceso < mejorDiferencia) { mejorDiferencia = exceso; mejorCombinacion = [...seleccion]; }
      return;
    }
    if (idx >= ordenados.length) {
      if (diferencia < mejorDiferencia) { mejorDiferencia = diferencia; mejorCombinacion = [...seleccion]; }
      return;
    }
    if (seleccion.length >= 10) {
      if (diferencia < mejorDiferencia) { mejorDiferencia = diferencia; mejorCombinacion = [...seleccion]; }
      return;
    }
    buscar(idx + 1, acumulado + ordenados[idx].montoNum, [...seleccion, ordenados[idx]]);
    buscar(idx + 1, acumulado, seleccion);
  };

  buscar(0, 0, []);
  const totalCheques = mejorCombinacion.reduce((s, c) => s + c.montoNum, 0);
  return {
    seleccionados: mejorCombinacion,
    transferencia: Math.max(0, montoObjetivo - totalCheques),
    vuelto: Math.max(0, totalCheques - montoObjetivo),
    totalCheques,
  };
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
  const [paso, setPaso]                     = useState(1);
  const [contactos, setContactos]           = useState([]);
  const [comprobantes, setComprobantes]     = useState([]);
  const [cheques, setCheques]               = useState([]);
  const [cargando, setCargando]             = useState(true);
  const [formasPagoConfig, setFormasPagoConfig] = useState([]);

  const [busqProv, setBusqProv]             = useState("");
  const [proveedor, setProveedor]           = useState(null);
  const [facturasSelec, setFacturasSelec]   = useState(new Set());
  const [ordenCheques, setOrdenCheques]     = useState("dias_asc");
  const [verSolo, setVerSolo]               = useState("todos");
  const [solucionSolver, setSolucionSolver] = useState(null);
  const [chequesManual, setChequesManual]   = useState([]);
  const [transferencia, setTransferencia]   = useState(0);
  const [guardando, setGuardando]           = useState(false);
  const [ordenGenerada, setOrdenGenerada]   = useState(null);
  const [diasMaximos, setDiasMaximos]       = useState(null);
  const [preguntarDias, setPreguntarDias]   = useState(false);

  // Formas de pago manuales adicionales (no cheques de cartera)
  const [formasManuales, setFormasManuales] = useState([]);
  // TC para facturas en USD
  const [tcFacturas, setTcFacturas]         = useState({});
  // Últiimo número de orden
  const [ultimoNroOrden, setUltimoNroOrden] = useState(null);

  useEffect(() => {
    Promise.all([
      apiSheets("get_contactos"),
      apiSheets("get"),
      apiSheets("get_cartera"),
      apiSheets("get_formas_pago"),
      apiSheets("get_ordenes"),
    ]).then(([ctData, compData, chqData, fpData, ordData]) => {
      // Contactos — solo proveedores
      const ctRows = ctData.values || [];
      setContactos(ctRows.slice(1)
        .map((r, i) => ({
          _idx: i, id: r[0]||"", cuit: r[1]||"", razon_social: r[2]||"",
          tipo: r[3]||"", subtipo: r[4]||"", categoria_costo: r[5]||"",
          condicion_pago: r[6]||"", contacto: r[7]||"", telefono: r[8]||"",
          mail: r[9]||"", cbu: r[15]||"", banco: r[16]||"", alias: r[17]||"",
        }))
        .filter(c => c.tipo === "Proveedor")
      );

      // Comprobantes
      const compRows = compData.values || [];
      setComprobantes(compRows.slice(1).map((r, i) => ({
        _idx: i,
        archivo: r[0]||"", tipo: r[1]||"", numero: r[2]||"",
        punto_venta: r[3]||"", fecha: r[4]||"", fecha_vto: r[5]||"",
        emisor: r[6]||"", cuit_emisor: r[7]||"",
        neto: parseMonto(r[10]), iva_21: parseMonto(r[12]),
        percepciones: parseMonto(r[14]),
        total: parseMonto(r[16]),
        moneda: r[17]||"ARS",
        estado: r[21]||"procesado",
      })).filter(c => c.total > 0 && !["recibo_sueldo","ddjj"].includes(c.tipo)));

      // Cheques
      const chqRows = chqData.values || [];
      setCheques(chqRows.slice(1).map((r, i) => ({
        _idx: i, id: r[0]||"", nro_cheque: r[1]||"", banco: r[2]||"",
        cuit: r[3]||"", titular: r[4]||"", monto: r[5]||"",
        fecha_pago: r[6]||"", estado: r[7]||"Disponible",
        cliente: r[8]||"", origen: r[9]||"",
      })));

      // Formas de pago de configuracion
      setFormasPagoConfig(fpData.formas || []);

      // Último número de orden
      const ordRows = ordData.values || [];
      const dataRows = ordRows.slice(2); // saltar 2 filas de encabezado
      if (dataRows.length > 0) {
        const lastRow = dataRows[dataRows.length - 1];
        const lastNro = parseInt(lastRow[0]) || 0;
        setUltimoNroOrden(lastNro);
      } else {
        setUltimoNroOrden(1000);
      }

      setCargando(false);
    });
  }, []);

  const proveedoresFiltrados = contactos.filter(c => {
    const s = busqProv.toLowerCase();
    return c.razon_social.toLowerCase().includes(s) || c.cuit.includes(s);
  });

  const facturasProv = proveedor
    ? comprobantes.filter(c =>
        c.cuit_emisor.replace(/[-\s]/g,"") === proveedor.cuit.replace(/[-\s]/g,"") &&
        c.estado !== "pagado"
      )
    : [];

  const totalSeleccionado = [...facturasSelec].reduce((s, idx) => {
    const f = facturasProv[idx];
    if (!f) return s;
    const tc = f.moneda !== "ARS" ? (parseMonto(tcFacturas[idx]) || 1) : 1;
    return s + (f.total * tc);
  }, 0);

  const toggleFactura = (idx) => {
    setFacturasSelec(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const ejecutarSolver = (dias) => {
    const diasAUsar = dias !== undefined ? dias : diasMaximos;
    const resultado = solverCheques(cheques, totalSeleccionado, diasAUsar);
    setSolucionSolver(resultado);
    setChequesManual(resultado.seleccionados.map(c => ({ ...c, _seleccionado: true })));
    setTransferencia(resultado.transferencia);
    setFormasManuales([]);
  };

  const irAPago = () => {
    const dias = parseDiasCondicion(proveedor?.condicion_pago);
    setDiasMaximos(dias);
    if (dias === null) {
      setPaso(3);
      setPreguntarDias(true);
      ejecutarSolver(null);
    } else {
      setPaso(3);
      ejecutarSolver(dias);
    }
  };

  const toggleChequeManual = (cheque) => {
    setChequesManual(prev => {
      const existe = prev.find(c => c.nro_cheque === cheque.nro_cheque);
      const nuevos = existe
        ? prev.filter(c => c.nro_cheque !== cheque.nro_cheque)
        : [...prev, { ...cheque, montoNum: parseMonto(cheque.monto) }];
      const totalCheques = nuevos.reduce((s, c) => s + parseMonto(c.monto), 0);
      const totalFormas = formasManuales.reduce((s, f) => s + parseMonto(f.monto), 0);
      setTransferencia(Math.max(0, totalSeleccionado - totalCheques - totalFormas));
      return nuevos;
    });
  };

  const agregarFormaPago = () => {
    setFormasManuales(prev => [...prev, { tipo: formasPagoConfig[0] || "Transferencia", nro_cheque: "", banco: "", fecha: "", monto: "" }]);
  };

  const actualizarFormaPago = (idx, campo, valor) => {
    setFormasManuales(prev => {
      const nuevo = [...prev];
      nuevo[idx] = { ...nuevo[idx], [campo]: valor };
      const totalCheques = chequesManual.reduce((s, c) => s + parseMonto(c.monto), 0);
      const totalFormas = nuevo.reduce((s, f) => s + parseMonto(f.monto), 0);
      setTransferencia(Math.max(0, totalSeleccionado - totalCheques - totalFormas));
      return nuevo;
    });
  };

  const eliminarFormaPago = (idx) => {
    setFormasManuales(prev => {
      const nuevo = prev.filter((_, i) => i !== idx);
      const totalCheques = chequesManual.reduce((s, c) => s + parseMonto(c.monto), 0);
      const totalFormas = nuevo.reduce((s, f) => s + parseMonto(f.monto), 0);
      setTransferencia(Math.max(0, totalSeleccionado - totalCheques - totalFormas));
      return nuevo;
    });
  };

  const totalChequesSel = chequesManual.reduce((s, c) => s + parseMonto(c.monto), 0);
  const totalFormasManuales = formasManuales.reduce((s, f) => s + parseMonto(f.monto), 0);
  const saldo = totalSeleccionado - totalChequesSel - totalFormasManuales - transferencia;

  const confirmarOrden = async () => {
    if (Math.abs(saldo) > 1) {
      alert(`El saldo no está cubierto: ${fmtPeso(Math.abs(saldo))} ${saldo > 0 ? "faltan" : "sobran"}`);
      return;
    }
    setGuardando(true);
    try {
      const nroOrden = (ultimoNroOrden || 1000) + 1;
      const fecha = new Date().toLocaleDateString("es-AR");

      // Armar facturas para la orden (máx 5)
      const facturasOrden = [...facturasSelec].slice(0, 5).map(idx => {
        const f = facturasProv[idx];
        const tc = f.moneda !== "ARS" ? (parseMonto(tcFacturas[idx]) || 1) : 1;
        return {
          numero:   f.numero || f.archivo,
          fecha:    f.fecha,
          cantidad: 1,
          detalle:  f.tipo,
          precio:   f.neto,
          tc:       tc === 1 ? "1" : String(tc),
          total:    f.total * tc,
        };
      });

      // Subtotal e impuestos
      const subtotal = facturasOrden.reduce((s, f) => s + parseMonto(f.total), 0);
      const ivaTotal = [...facturasSelec].reduce((s, idx) => {
        const f = facturasProv[idx];
        const tc = f.moneda !== "ARS" ? (parseMonto(tcFacturas[idx]) || 1) : 1;
        return s + (f.iva_21 * tc);
      }, 0);
      const percTotal = [...facturasSelec].reduce((s, idx) => {
        const f = facturasProv[idx];
        return s + (f.percepciones || 0);
      }, 0);

      // Marcar cheques como entregados
      for (const cheque of chequesManual) {
        await apiSheets("update_cheque", { ...cheque, estado: "Entregado a proveedor" }, cheque._idx);
      }

      // Armar formas de pago: primero cheques, luego formas manuales, luego transferencia si hay
      const todasFormasPago = [
        ...chequesManual.map(c => ({
          tipo: "Echeq 3",
          nro_cheque: c.nro_cheque,
          banco: c.banco,
          fecha: c.fecha_pago,
          monto: `$ ${fmtPeso(parseMonto(c.monto)).replace("$", "").trim()}`,
        })),
        ...formasManuales.map(f => ({
          tipo: f.tipo,
          nro_cheque: f.nro_cheque || "",
          banco: f.banco || "",
          fecha: f.fecha || "",
          monto: `$ ${fmtPeso(parseMonto(f.monto)).replace("$", "").trim()}`,
        })),
        ...(transferencia > 0 ? [{
          tipo: "Transferencia",
          nro_cheque: "",
          banco: "Cresium",
          fecha: fecha,
          monto: `$ ${fmtPeso(transferencia).replace("$", "").trim()}`,
        }] : []),
      ];

      // Guardar en Ordenes_Pago
      await apiSheets("append_orden", {
        nro_orden: nroOrden,
        fecha,
        proveedor: proveedor.razon_social,
        cuit: proveedor.cuit,
        datos_bancarios: [
          proveedor.banco ? `Banco: ${proveedor.banco}` : "",
          proveedor.cbu ? `CBU: ${proveedor.cbu}` : "",
          proveedor.alias ? `Alias: ${proveedor.alias}` : "",
        ].filter(Boolean).join(" | "),
        facturas: facturasOrden,
        subtotal,
        iva: ivaTotal,
        percepcion_iva: percTotal,
        iibb_caba: "",
        iibb_bsas: "",
        total: totalSeleccionado,
        formas_pago: todasFormasPago,
      });

      setOrdenGenerada({
        nro: nroOrden,
        fecha,
        proveedor: proveedor.razon_social,
        cuit: proveedor.cuit,
        cbu: proveedor.cbu,
        banco: proveedor.banco,
        alias: proveedor.alias,
        facturas: facturasOrden,
        total: totalSeleccionado,
        cheques: chequesManual,
        formasManuales,
        transferencia,
      });
      setUltimoNroOrden(nroOrden);
      setPaso(4);
    } catch(e) { console.error(e); alert("Error al guardar la orden: " + e.message); }
    setGuardando(false);
  };

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
          <div style={{ color: C.textMuted, fontSize: 13 }}>
            Seleccioná proveedor → facturas → forma de pago
            {ultimoNroOrden && <span style={{ marginLeft: 16, color: C.accent, fontWeight: 700 }}>Próximo N°: {ultimoNroOrden + 1}</span>}
          </div>
        </div>
      </div>

      {/* Pasos */}
      <div style={{ display: "flex", gap: 0, marginBottom: 24, background: C.white, borderRadius: 12, overflow: "hidden", boxShadow: C.shadow }}>
        {[{ n: 1, label: "Proveedor" }, { n: 2, label: "Facturas" }, { n: 3, label: "Forma de pago" }, { n: 4, label: "Confirmación" }].map((p, i) => (
          <div key={p.n} style={{
            flex: 1, padding: "14px", textAlign: "center",
            background: paso === p.n ? C.accent : paso > p.n ? C.successBg : C.white,
            color: paso === p.n ? "#fff" : paso > p.n ? C.success : C.textMuted,
            fontWeight: 700, fontSize: 13,
            borderRight: i < 3 ? `1px solid ${C.border}` : "none",
          }}>
            {paso > p.n ? "✓ " : `${p.n}. `}{p.label}
          </div>
        ))}
      </div>

      {/* ── PASO 1: Proveedor ── */}
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
                style={{ padding: "14px 16px", border: `2px solid ${proveedor?.cuit === c.cuit ? C.accent : C.border}`, borderRadius: 10, cursor: "pointer", background: proveedor?.cuit === c.cuit ? C.accentBg : C.white }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
                onMouseLeave={e => e.currentTarget.style.borderColor = proveedor?.cuit === c.cuit ? C.accent : C.border}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.razon_social}</div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>
                  CUIT {c.cuit}
                  {c.condicion_pago && ` · Pago: ${c.condicion_pago}`}
                  {c.banco && ` · ${c.banco}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PASO 2: Facturas ── */}
      {paso === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: C.accentBg, border: `1px solid ${C.accent}44`, borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, color: C.accentDark }}>{proveedor.razon_social}</div>
              <div style={{ fontSize: 12, color: C.textSec }}>CUIT {proveedor.cuit} {proveedor.condicion_pago && `· Pago: ${proveedor.condicion_pago}`}</div>
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
              <div style={{ padding: 32, textAlign: "center", color: C.textMuted }}>No hay facturas pendientes para este proveedor</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                    <th style={{ padding: "10px 14px", width: 36 }}>
                      <input type="checkbox"
                        checked={facturasSelec.size === facturasProv.length && facturasProv.length > 0}
                        onChange={() => {
                          if (facturasSelec.size === facturasProv.length) setFacturasSelec(new Set());
                          else setFacturasSelec(new Set(facturasProv.map((_, i) => i)));
                        }}
                        style={{ cursor: "pointer", width: 16, height: 16 }} />
                    </th>
                    {["N° Factura", "Fecha", "Vto.", "Neto", "Moneda", "Total ARS"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: C.textMuted, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>{h}</th>
                    ))}
                    <th style={{ padding: "10px 14px", textAlign: "left", color: C.textMuted, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>TC</th>
                  </tr>
                </thead>
                <tbody>
                  {facturasProv.map((f, i) => {
                    const esUSD = f.moneda !== "ARS";
                    const tc = parseMonto(tcFacturas[i]) || 1;
                    const totalARS = f.total * (esUSD ? tc : 1);
                    return (
                      <tr key={i} onClick={() => toggleFactura(i)}
                        style={{ borderBottom: `1px solid ${C.border}`, background: facturasSelec.has(i) ? "#fff8e6" : "transparent", cursor: "pointer" }}>
                        <td style={{ padding: "10px 14px" }} onClick={e => { e.stopPropagation(); toggleFactura(i); }}>
                          <input type="checkbox" checked={facturasSelec.has(i)} onChange={() => toggleFactura(i)} style={{ cursor: "pointer", width: 16, height: 16 }} />
                        </td>
                        <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 13 }}>{f.numero || f.archivo}</td>
                        <td style={{ padding: "10px 14px", fontSize: 13, color: C.textSec }}>{fmtFecha(f.fecha)}</td>
                        <td style={{ padding: "10px 14px", fontSize: 13, color: C.textSec }}>{fmtFecha(f.fecha_vto)}</td>
                        <td style={{ padding: "10px 14px", fontSize: 13 }}>{fmtPeso(f.neto)}</td>
                        <td style={{ padding: "10px 14px", fontSize: 12 }}>
                          <span style={{ background: esUSD ? C.warningBg : C.accentBg, color: esUSD ? C.warning : C.accent, borderRadius: 20, padding: "2px 8px", fontWeight: 700, fontSize: 11 }}>
                            {f.moneda || "ARS"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700 }}>{fmtPeso(totalARS)}</td>
                        <td style={{ padding: "6px 14px" }} onClick={e => e.stopPropagation()}>
                          {esUSD ? (
                            <input
                              type="number"
                              placeholder="TC..."
                              value={tcFacturas[i] || ""}
                              onChange={e => setTcFacturas(prev => ({ ...prev, [i]: e.target.value }))}
                              style={{ width: 90, padding: "4px 8px", border: `1px solid ${C.warning}`, borderRadius: 6, fontSize: 12, fontWeight: 700 }}
                            />
                          ) : <span style={{ fontSize: 11, color: C.textMuted }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
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

          {/* Modal días */}
          {preguntarDias && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ background: C.white, borderRadius: 16, padding: 28, maxWidth: 420, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: C.navy, marginBottom: 8 }}>⚠ Condición de pago no definida</div>
                <div style={{ color: C.textSec, fontSize: 14, marginBottom: 20 }}>
                  <strong>{proveedor?.razon_social}</strong> no tiene condición de pago registrada.<br/>¿Hasta cuántos días acepta cheques?
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
                  {[0, 15, 30, 45, 60, 90].map(d => (
                    <button key={d} onClick={() => { setDiasMaximos(d); setPreguntarDias(false); ejecutarSolver(d); }}
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
                        setDiasMaximos(d); setPreguntarDias(false); ejecutarSolver(d);
                      }
                    }} />
                  <button onClick={() => setPreguntarDias(false)}
                    style={{ background: "#6c757d", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontWeight: 600 }}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Condición de pago */}
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

          {/* Optimizador */}
          <div style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.navy, marginBottom: 10 }}>⚙ Optimizador de cheques</div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ fontSize: 13, color: C.textSec }}>Cheques hasta <strong>{diasMaximos === 0 ? "0 días" : diasMaximos !== null ? `${diasMaximos} días` : "sin límite"}</strong></div>
              <button onClick={() => ejecutarSolver()}
                style={{ background: C.accentBg, color: C.accent, border: `1px solid ${C.accent}44`, borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                🔄 Recalcular
              </button>
            </div>
          </div>

          {/* Tabla de cheques */}
          {solucionSolver && (
            <div style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>
                  🤖 Cheques de cartera — {cheques.filter(c => c.estado === "Disponible").length} disponibles · <span style={{ color: C.success }}>{chequesManual.length} seleccionados</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={verSolo} onChange={e => setVerSolo(e.target.value)}
                    style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
                    <option value="todos">Ver todos</option>
                    <option value="seleccionados">Solo seleccionados ({chequesManual.length})</option>
                  </select>
                  <select value={ordenCheques} onChange={e => setOrdenCheques(e.target.value)}
                    style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
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
                    if (verSolo === "seleccionados") lista = lista.filter(c => chequesManual.find(ch => ch.nro_cheque === c.nro_cheque));
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

          {/* Otras formas de pago */}
          <div style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>💸 Otras formas de pago</div>
              <button onClick={agregarFormaPago}
                style={{ background: C.accentBg, color: C.accent, border: `1px solid ${C.accent}44`, borderRadius: 8, padding: "7px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                + Agregar
              </button>
            </div>
            {formasManuales.length === 0 && (
              <div style={{ color: C.textMuted, fontSize: 13 }}>No hay formas de pago adicionales. Usá el botón para agregar transferencias, efectivo, saldos a favor, etc.</div>
            )}
            {formasManuales.map((fp, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                <select value={fp.tipo} onChange={e => actualizarFormaPago(i, "tipo", e.target.value)}
                  style={{ padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, background: C.bg }}>
                  {formasPagoConfig.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <input placeholder="N° cheque / ref." value={fp.nro_cheque} onChange={e => actualizarFormaPago(i, "nro_cheque", e.target.value)}
                  style={{ width: 120, padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13 }} />
                <input placeholder="Banco / descripción" value={fp.banco} onChange={e => actualizarFormaPago(i, "banco", e.target.value)}
                  style={{ width: 160, padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13 }} />
                <input placeholder="Fecha" value={fp.fecha} onChange={e => actualizarFormaPago(i, "fecha", e.target.value)}
                  style={{ width: 110, padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13 }} />
                <input type="number" placeholder="Monto" value={fp.monto} onChange={e => actualizarFormaPago(i, "monto", e.target.value)}
                  style={{ width: 130, padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontWeight: 700 }} />
                <button onClick={() => eliminarFormaPago(i)}
                  style={{ background: C.dangerBg, color: C.danger, border: "none", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontWeight: 700 }}>✕</button>
              </div>
            ))}
          </div>

          {/* Transferencia complementaria */}
          <div style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.navy, marginBottom: 14 }}>🏦 Transferencia complementaria</div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ fontSize: 13, color: C.textSec }}>Monto a transferir:</div>
              <input type="number" value={transferencia} onChange={e => setTransferencia(parseFloat(e.target.value) || 0)}
                style={{ width: 200, padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontWeight: 700 }} />
            </div>
          </div>

          {/* Resumen */}
          <div style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.navy, marginBottom: 14 }}>📊 Resumen de pago</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: C.textSec }}>Total a pagar</span>
                <span style={{ fontWeight: 700 }}>{fmtPeso(totalSeleccionado)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: C.textSec }}>eCheques ({chequesManual.length})</span>
                <span style={{ fontWeight: 700, color: C.success }}>- {fmtPeso(totalChequesSel)}</span>
              </div>
              {formasManuales.map((fp, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span style={{ color: C.textSec }}>{fp.tipo}{fp.banco ? ` · ${fp.banco}` : ""}</span>
                  <span style={{ fontWeight: 700, color: C.blue }}>- {fmtPeso(parseMonto(fp.monto))}</span>
                </div>
              ))}
              {transferencia > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span style={{ color: C.textSec }}>Transferencia</span>
                  <span style={{ fontWeight: 700, color: C.blue }}>- {fmtPeso(transferencia)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, borderTop: `2px solid ${C.border}`, paddingTop: 10, marginTop: 4 }}>
                <span>Saldo</span>
                <span style={{ color: Math.abs(saldo) < 1 ? C.success : C.danger }}>
                  {fmtPeso(Math.abs(saldo))} {Math.abs(saldo) < 1 ? "✓ Cubierto" : saldo > 0 ? "⚠ Falta cubrir" : "⚠ Exceso"}
                </span>
              </div>
            </div>
          </div>

          <button onClick={confirmarOrden} disabled={Math.abs(saldo) > 1 || guardando} style={btnS(C.accent, Math.abs(saldo) > 1 || guardando)}>
            {guardando ? "⏳ Guardando orden..." : "✓ Confirmar y generar orden de pago"}
          </button>
        </div>
      )}

      {/* ── PASO 4: Confirmación ── */}
      {paso === 4 && ordenGenerada && (
        <div style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, padding: 28 }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <div style={{ fontWeight: 800, fontSize: 20, color: C.navy, marginBottom: 6 }}>Orden de pago N° {ordenGenerada.nro} generada</div>
            <div style={{ color: C.textMuted, fontSize: 14 }}>{ordenGenerada.fecha} · Guardada en Google Sheets</div>
          </div>

          <div style={{ border: `2px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: C.navy, marginBottom: 10, fontSize: 15 }}>Proveedor</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{ordenGenerada.proveedor}</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>CUIT {ordenGenerada.cuit}</div>
            {ordenGenerada.banco && <div style={{ fontSize: 12, color: C.textMuted }}>Banco: {ordenGenerada.banco}</div>}
            {ordenGenerada.cbu && <div style={{ fontSize: 12, color: C.textMuted }}>CBU: {ordenGenerada.cbu}</div>}
          </div>

          <div style={{ border: `2px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: C.navy, marginBottom: 10, fontSize: 15 }}>Forma de pago</div>
            {ordenGenerada.cheques.map((c, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span>eCheq N° {c.nro_cheque} · {c.banco} · {fmtFecha(c.fecha_pago)}</span>
                <span style={{ fontWeight: 700 }}>{fmtPeso(parseMonto(c.monto))}</span>
              </div>
            ))}
            {ordenGenerada.formasManuales.map((fp, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span>{fp.tipo}{fp.banco ? ` · ${fp.banco}` : ""}{fp.fecha ? ` · ${fp.fecha}` : ""}</span>
                <span style={{ fontWeight: 700 }}>{fmtPeso(parseMonto(fp.monto))}</span>
              </div>
            ))}
            {ordenGenerada.transferencia > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span>Transferencia</span>
                <span style={{ fontWeight: 700 }}>{fmtPeso(ordenGenerada.transferencia)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, borderTop: `2px solid ${C.border}`, paddingTop: 10, marginTop: 8 }}>
              <span>TOTAL PAGADO</span>
              <span style={{ color: C.accent }}>{fmtPeso(ordenGenerada.total)}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => { setPaso(1); setProveedor(null); setFacturasSelec(new Set()); setSolucionSolver(null); setChequesManual([]); setFormasManuales([]); setOrdenGenerada(null); setDiasMaximos(null); setPreguntarDias(false); setTcFacturas({}); setTransferencia(0); }}
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
