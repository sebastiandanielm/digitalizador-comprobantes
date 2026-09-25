import { useState, useRef, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";
import ContactosScreen from "./ContactosScreen.jsx";
import CarteraChequesScreen from "./CarteraChequesScreen.jsx";
import PagosScreen from "./PagosScreen.jsx";
import HomeScreen from "./HomeScreen.jsx";
import InsumosScreen from "./InsumosScreen.jsx";
import CostosScreen from "./CostosScreen.jsx";

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

const TIPOS_DEFAULT = [
  { key: "factura_a",        label: "Factura A" },
  { key: "factura_b",        label: "Factura B" },
  { key: "factura_c",        label: "Factura C" },
  { key: "ticket",           label: "Ticket Fiscal" },
  { key: "servicio_publico", label: "Servicio Público" },
  { key: "recibo_sueldo",    label: "Recibo de Sueldo" },
  { key: "ddjj",             label: "Declaración Jurada" },
  { key: "impuesto",         label: "Impuesto" },
  { key: "otro",             label: "Otro" },
];

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
  return <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}44`, borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>{c.label}</span>;
};

const TipoBadge = ({ tipo, tipos }) => {
  const found = tipos.find((t) => t.key === tipo);
  return (
    <span style={{ background: C.accentBg, color: C.accentDark, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
      {found?.label || tipo || "—"}
    </span>
  );
};

function ConfigScreen({ tipos, buscadorConfig, onGuardar, onVolver, guardando }) {
  const [lista, setLista]           = useState(tipos.map((t) => ({ ...t })));
  const [nuevoLabel, setNuevoLabel] = useState("");
  const [guardado, setGuardado]     = useState(false);
  const [busConfig, setBusConfig]   = useState(buscadorConfig.map(c => ({ ...c, keywords: c.keywords.join(', ') })));

  const MODULOS_BUSCADOR = [
    { key: "digitalizador", label: "Digitalizador" },
    { key: "pagos",         label: "Pagos" },
    { key: "cheques",       label: "Cheques" },
    { key: "contactos",     label: "Contactos" },
    { key: "costos",        label: "Costos" },
    { key: "cc_proveedores",label: "Cta. Cte. Proveedores" },
    { key: "cc_clientes",   label: "Cta. Cte. Clientes" },
    { key: "compras",       label: "Listado de Compras" },
    { key: "ventas",        label: "Listado de Ventas" },
    { key: "presupuestos",  label: "Presupuestos" },
  ];

  const getKeywords = (key) => busConfig.find(c => c.key === key)?.keywords || '';
  const setKeywords = (key, val) => {
    setBusConfig(prev => {
      const existe = prev.find(c => c.key === key);
      if (existe) return prev.map(c => c.key === key ? { ...c, keywords: val } : c);
      return [...prev, { key, keywords: val }];
    });
  };

  const actualizar = (i, label) => setLista((p) => p.map((t, idx) => idx === i ? { ...t, label } : t));
  const eliminar   = (i) => setLista((p) => p.filter((_, idx) => idx !== i));

  const agregar = () => {
    if (!nuevoLabel.trim()) return;
    const key = "tipo_" + Date.now();
    setLista((p) => [...p, { key, label: nuevoLabel.trim() }]);
    setNuevoLabel("");
  };

  const guardar = async () => {
    const configFinal = busConfig
      .filter(c => c.keywords.trim())
      .map(c => ({ key: c.key, keywords: c.keywords.split(',').map(k => k.trim()).filter(Boolean) }));
    await onGuardar(lista, configFinal);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 3000);
  };

  return (
    <div style={{ padding: "28px 24px", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={onVolver}
          style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          ← Volver
        </button>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20, color: C.navy }}>⚙ Configuración</div>
          <div style={{ color: C.textMuted, fontSize: 13 }}>Los cambios se guardan en Google Sheets y aplican a todas las PCs</div>
        </div>
      </div>

      {/* Tipos de comprobantes */}
      <div style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Tipos de comprobantes</span>
          <button onClick={() => setLista(TIPOS_DEFAULT.map((t) => ({ ...t })))}
            style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.textSec, borderRadius: 7, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            Restaurar originales
          </button>
        </div>
        <div style={{ padding: "8px 0" }}>
          {lista.map((t, i) => (
            <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace", minWidth: 160, background: C.bg, padding: "4px 8px", borderRadius: 4 }}>{t.key}</span>
              <input value={t.label} onChange={(e) => actualizar(i, e.target.value)}
                style={{ flex: 1, padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 14, color: C.text, background: C.bg, fontWeight: 600 }} />
              <button onClick={() => eliminar(i)}
                style={{ background: C.dangerBg, color: C.danger, border: `1px solid ${C.danger}33`, borderRadius: 7, padding: "7px 12px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                🗑
              </button>
            </div>
          ))}
        </div>
        <div style={{ padding: "16px 20px", borderTop: `2px solid ${C.border}`, background: C.bg }}>
          <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Agregar nuevo tipo</div>
          <div style={{ display: "flex", gap: 10 }}>
            <input value={nuevoLabel} onChange={(e) => setNuevoLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && agregar()}
              placeholder="Ej: Flete, Materia Prima, Mantenimiento..."
              style={{ flex: 1, padding: "9px 14px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, color: C.text, background: C.white }} />
            <button onClick={agregar}
              style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
              + Agregar
            </button>
          </div>
        </div>
      </div>

      {/* Palabras clave del buscador */}
      <div style={{ background: C.white, borderRadius: 14, boxShadow: C.shadow, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>🔍 Palabras clave del buscador</div>
          <div style={{ fontSize: 13, color: C.textSec, marginTop: 4 }}>
            Agregá términos separados por coma para que cada módulo sea más fácil de encontrar.
          </div>
        </div>
        <div style={{ padding: "8px 0" }}>
          {MODULOS_BUSCADOR.map((m, i) => (
            <div key={m.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: i < MODULOS_BUSCADOR.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ minWidth: 180, fontWeight: 600, fontSize: 13, color: C.navy }}>{m.label}</div>
              <input
                value={getKeywords(m.key)}
                onChange={e => setKeywords(m.key, e.target.value)}
                placeholder="ej: pago, orden, proveedor..."
                style={{ flex: 1, padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, color: C.text, background: C.bg }}
              />
            </div>
          ))}
        </div>
      </div>

      <button onClick={guardar} disabled={guardando}
        style={{ width: "100%", background: guardado ? C.success : C.accent, color: "#fff", border: "none", borderRadius: 10, padding: "13px 0", fontWeight: 800, fontSize: 15, cursor: "pointer", transition: "background .3s" }}>
        {guardando ? "⏳ Guardando en Google Sheets…" : guardado ? "✓ Guardado — visible en todas las PCs" : "💾 Guardar cambios"}
      </button>

      <div style={{ marginTop: 14, background: C.accentBg, border: `1px solid ${C.accent}44`, borderRadius: 10, padding: "12px 16px", fontSize: 13, color: C.accentDark }}>
        <strong>💡</strong> Los cambios se guardan en Google Sheets y se aplican en todas las PCs la próxima vez que abran MICOFY.
      </div>
    </div>
  );
}

// ─── API calls ────────────────────────────────────────────────────────────────
async function procesarConClaude(file, tipos) {
  const base64 = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const isPdf = file.type === "application/pdf";
  const tiposKeys = tipos.map((t) => `"${t.key}"`).join("|");
  const tiposDesc = tipos.map((t) => `  - "${t.key}" = ${t.label}`).join("\n");

  const prompt = `Sos un sistema experto en comprobantes fiscales argentinos.
Analizá el documento exhaustivamente y extraé TODA la información relevante.

TIPOS DE COMPROBANTES DISPONIBLES:
${tiposDesc}

INSTRUCCIONES ESPECÍFICAS POR TIPO:

FACTURAS DE SERVICIOS PÚBLICOS (Edenor, Edesur, AySA, gas, etc.):
- Extraé TODOS los conceptos como ítems
- "neto_gravado" es la suma de conceptos de servicio ANTES de impuestos
- En "otros_tributos" sumá todos los impuestos adicionales
- El "total" es el importe total a pagar
- Extraé fecha de vencimiento y período en "periodo"

FACTURAS A/B/C DE PROVEEDORES:
- Extraé TODOS los ítems con cantidad, unidad, precio unitario y subtotal
- "iva_105" = importe IVA al 10.5% si existe
- "iva_21" = importe IVA al 21% si existe
- "iva_27" = importe IVA al 27% si existe
- "condicion_venta" = condición de pago (contado, cuenta corriente, etc.)
- "cae" = número de CAE y fecha de vencimiento
- Extraé percepciones de IIBB y otros tributos por separado
- "total" = campo "Importe Total" o "Total a Pagar" — SIEMPRE extraé este campo, es OBLIGATORIO
- Si no encontrás el total explícito, calculalo: neto_gravado + iva_21 + iva_105 + iva_27 + percepciones + otros_tributos

RECIBOS DE SUELDO:
- "emisor_razon_social" es la empresa empleadora
- "empleado_nombre" es el trabajador
- "total" es el neto a cobrar

DDJJ FORMULARIO 931 (SUSS/ARCA):
- "emisor_razon_social" = "ARCA - S.U.S.S." (el organismo recaudador, NUNCA el contribuyente)
- "emisor_cuit" = "33-69345023-9" (CUIT de ARCA)
- "receptor_razon_social" = nombre del contribuyente
- "receptor_cuit" = CUIT del contribuyente
- "total" = suma de la sección VIII únicamente
- "contribuciones_ss" = Contribuciones de Seguridad Social (ítem 351)
- "aportes_ss" = Aportes de Seguridad Social (ítem 301)
- "lrt" = L.R.T. a pagar (ítem 312)
- "seguro_vida" = Seguro Colectivo de Vida Obligatorio (ítem 028)
- "neto_gravado" = Suma de remuneraciones
- "periodo" = Mes-Año del formulario (ej: "04/2026")

CERTIFICADO DE RETENCIÓN GANANCIAS:
- "tipo" = el tipo que corresponda a "Retención Ganancias" de la lista disponible
- "emisor_razon_social" = formato "ARCA - [razón social del agente de retención]"
- "emisor_cuit" = CUIT del agente de retención
- "receptor_razon_social" = el sujeto retenido
- "receptor_cuit" = CUIT del sujeto retenido
- "total" = monto retenido
- "neto_gravado" = monto sujeto a retención
- "observaciones" = impuesto, régimen, alícuota, comprobante que origina la retención

CERTIFICADO DE RETENCIÓN IIBB:
- "tipo" = el tipo que corresponda a "Retención IIBB" de la lista disponible
- "emisor_razon_social" = formato "ARBA - [razón social]" o "CM - [razón social]"
- "emisor_cuit" = CUIT del agente de retención
- "receptor_razon_social" = el sujeto retenido
- "receptor_cuit" = CUIT del sujeto retenido
- "total" = monto retenido
- "jurisdiccion" = provincia o "Convenio Multilateral"

IMPUESTOS:
- "emisor_razon_social" = "ARBA" o "Comisión Arbitral"
- "receptor_razon_social" = nombre del contribuyente
- "receptor_cuit" = CUIT del contribuyente
- "jurisdiccion" = provincia o "Convenio Multilateral"
- "anticipo_imp_determinado" = impuesto determinado del período
- "a_pagar" = monto final a ingresar
- "total" = monto final a pagar

DDJJ IVA:
- "emisor_razon_social" = "ARCA - Agencia de Recaudación y Control Aduanero"
- "emisor_cuit" = "33-69345023-9"
- "receptor_razon_social" = nombre del contribuyente
- "debito_fiscal" = total débito fiscal
- "credito_fiscal" = total crédito fiscal
- "saldo_tecnico_anterior" = saldo técnico anterior
- "saldo_tecnico" = saldo técnico resultante
- "retenciones_pagos_cuenta" = retenciones y pagos a cuenta
- "saldo_libre_disponibilidad" = saldo a favor
- "total" = monto a pagar (0 si hay saldo a favor)

EXTRACTO BANCARIO:
- "emisor_razon_social" = nombre del banco
- "emisor_cuit" = CUIT del banco (Credicoop: 30-57142763-9)
- "receptor_razon_social" = nombre del titular
- "comisiones_bancarias" = suma comisiones
- "impuestos_debito_credito" = Ley 25.413 (SIEMPRE POSITIVO)
- "percepcion_sircreb" = SIRCREB + Percepción IVA RG 2408
- "seguros_bancarios" = seguros exigidos por el banco
- "iva_21" = IVA sobre comisiones
- "total" = suma de todos los conceptos bancarios
- EXCLUIR débitos de servicios externos con factura propia

REGLAS GENERALES:
- Si un campo no existe, usá null
- Los montos siempre como números sin símbolos
- "periodo" = período de facturación — NUNCA la moneda
- "moneda" = ARS, USD, EUR u otro
- "total" es OBLIGATORIO — calculalo si no está explícito

Respondé ÚNICAMENTE con JSON válido, sin texto adicional ni backticks:
{
  "tipo": ${tiposKeys},
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
  "iva_105": number|null,
  "iva_21": number|null,
  "iva_27": number|null,
  "percepciones": number|null,
  "otros_tributos": number|null,
  "total": number|null,
  "moneda": "ARS"|"USD"|"EUR"|"otro",
  "periodo": "string|null",
  "empleado_nombre": "string|null",
  "empleado_cuil": "string|null",
  "observaciones": "string|null",
  "condicion_venta": "string|null",
  "cae": "string|null",
  "contribuciones_ss": number|null,
  "aportes_ss": number|null,
  "lrt": number|null,
  "seguro_vida": number|null,
  "jurisdiccion": "string|null",
  "anticipo_imp_determinado": number|null,
  "valores_restan": number|null,
  "valores_suman": number|null,
  "a_favor_contribuyente": number|null,
  "a_favor_fisco": number|null,
  "a_pagar": number|null,
  "comisiones_bancarias": number|null,
  "impuestos_debito_credito": number|null,
  "percepcion_sircreb": number|null,
  "seguros_bancarios": number|null,
  "debito_fiscal": number|null,
  "credito_fiscal": number|null,
  "saldo_tecnico_anterior": number|null,
  "saldo_tecnico": number|null,
  "retenciones_pagos_cuenta": number|null,
  "saldo_libre_disponibilidad": number|null,
  "items": [{"descripcion":"string","cantidad":number|null,"unidad":"string|null","precio_unitario":number|null,"subtotal":number|null}],
  "texto_original": "resumen del texto clave en max 500 caracteres",
  "confianza": "alta"|"media"|"baja"
}`;

  const block = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: file.type, data: base64 } };

  const resp = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 2000, messages: [{ role: "user", content: [block, { type: "text", text: prompt }] }] }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error?.message || "Error en el servidor");
  return JSON.parse(data.content.map((b) => b.text || "").join("").replace(/```json|```/g, "").trim());
}

async function guardarEnSheets(comp) {
  try {
    await fetch("/api/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "append", data: { nombre: comp.nombre, estado: comp.estado, ...comp.datos } }),
    });
  } catch (e) { console.error("Error guardando:", e); }
}

async function guardarItemsEnSheets(datos, contactoCategoria) {
  try {
    if (!datos.items || datos.items.length === 0) return;
    if (!["factura_a", "factura_b", "factura_c", "ticket"].includes(datos.tipo)) return;
    await fetch("/api/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "append_items",
        data: {
          id_comprobante: datos.numero_comprobante || "",
          fecha: datos.fecha_emision || "",
          proveedor: datos.emisor_razon_social || "",
          cuit_proveedor: datos.emisor_cuit || "",
          categoria_costo: contactoCategoria || "",
          items: datos.items,
        }
      }),
    });
  } catch (e) { console.error("Error guardando ítems:", e); }
}

async function cargarContactosCache() {
  try {
    const resp = await fetch("/api/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_contactos" }),
    });
    const data = await resp.json();
    const rows = data.values || [];
    if (rows.length <= 1) return [];
    return rows.slice(1).map(row => ({
      id: row[0]||'', cuit: row[1]||'', razon_social: row[2]||'',
      tipo: row[3]||'', subtipo: row[4]||'', categoria_costo: row[5]||'',
      condicion_pago: row[6]||'', contacto: row[7]||'', telefono: row[8]||'',
      mail: row[9]||'', direccion: row[10]||'', localidad: row[11]||'',
      provincia: row[12]||'', cp: row[13]||'', condicion_iva: row[14]||'',
      cbu: row[15]||'', banco: row[16]||'', alias: row[17]||'',
      preferencia_cheque: row[18]||'', notas: row[19]||''
    }));
  } catch (e) { return []; }
}

function buscarEnCache(contactos, cuit, nombre) {
  if (!contactos || contactos.length === 0) return null;
  if (cuit) {
    const cuitLimpio = cuit.replace(/[-\s]/g, '');
    const match = contactos.find(c => c.cuit.replace(/[-\s]/g, '') === cuitLimpio);
    if (match) return match;
  }
  if (nombre) {
    const nombreLower = nombre.toLowerCase();
    const match = contactos.find(c => c.razon_social.toLowerCase().includes(nombreLower));
    if (match) return match;
  }
  return null;
}

async function eliminarDeSheets(rowIndex) {
  try {
    const resp = await fetch("/api/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", rowIndex }),
    });
    return resp.ok;
  } catch (e) { return false; }
}

async function cargarDeSheets() {
  try {
    const resp = await fetch("/api/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get" }),
    });
    const data = await resp.json();
    const rows = data.values || [];
    if (rows.length <= 1) return [];
    return rows.slice(1).map((row, i) => ({
      id: `sheet-${i}`, sheetRowIndex: i,
      nombre: row[0] || "", estado: row[21] || "procesado", fileUrl: null,
      datos: {
        tipo: row[1] || "otro",
        numero_comprobante: row[2] || null, punto_venta: row[3] || null,
        fecha_emision: row[4] || null, fecha_vencimiento: row[5] || null,
        emisor_razon_social: row[6] || null, emisor_cuit: row[7] || null,
        receptor_razon_social: row[8] || null, receptor_cuit: row[9] || null,
        neto_gravado: row[10] ? parseFloat(row[10]) : null,
        iva_105: row[11] ? parseFloat(row[11]) : null,
        iva_21: row[12] ? parseFloat(row[12]) : null,
        iva_27: row[13] ? parseFloat(row[13]) : null,
        percepciones: row[14] ? parseFloat(row[14]) : null,
        otros_tributos: row[15] ? parseFloat(row[15]) : null,
        total: row[16] ? parseFloat(row[16]) : null,
        moneda: row[17] || "ARS", periodo: row[18] || null,
        empleado_nombre: row[19] || null, empleado_cuil: row[20] || null,
        observaciones: row[22] || null, items: [], confianza: "alta",
        contacto_clasificado: row[46] === "true" ? true : row[46] === "false" ? false : null,
        contacto_tipo: row[47] || null,
        contacto_categoria: row[48] || null,
      },
    }));
  } catch (e) { return []; }
}

async function cargarTiposDeSheets() {
  try {
    const resp = await fetch("/api/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_tipos" }),
    });
    const data = await resp.json();
    const rows = data.values || [];
    if (rows.length <= 1) return null;
    return rows.slice(1).map((row) => ({ key: row[0], label: row[1] })).filter((t) => t.key && t.label);
  } catch (e) { return null; }
}

async function cargarBuscadorConfig() {
  try {
    const resp = await fetch("/api/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_buscador_config" }),
    });
    const data = await resp.json();
    return data.config || [];
  } catch (e) { return []; }
}

async function guardarConfigEnSheets(tipos, buscadorConfig) {
  await fetch("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "save_tipos", data: { tipos } }),
  });
  await fetch("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "save_buscador_config", data: { config: buscadorConfig } }),
  });
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
    <F l={a.l} v={a.v} /><F l={b.l} v={b.v} />
  </div>
);

// ─── App principal ────────────────────────────────────────────────────────────
export default function App() {
  const [tipos, setTipos]                 = useState(TIPOS_DEFAULT);
  const [buscadorConfig, setBuscadorConfig] = useState([]);
  const [comp, setComp]                   = useState([]);
  const [drag, setDrag]                   = useState(false);
  const [selId, setSelId]                 = useState(null);
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [eliminandoMasivo, setEliminandoMasivo] = useState(false);
  const [fTipo, setFTipo]                 = useState("todos");
  const [fEst, setFEst]                   = useState("todos");
  const [q, setQ]                         = useState("");
  const [editing, setEditing]             = useState(false);
  const [editD, setEditD]                 = useState({});
  const [cargando, setCargando]           = useState(true);
  const [eliminando, setEliminando]       = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [pantalla, setPantalla]           = useState("home"); // "home"|"digitalizador"|"pagos"|"cheques"|"contactos"|"config"|"insumos"
  const [guardandoTipos, setGuardandoTipos] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    Promise.all([cargarTiposDeSheets(), cargarDeSheets(), cargarBuscadorConfig()]).then(([tiposGuardados, datos, busConfig]) => {
      if (tiposGuardados && tiposGuardados.length > 0) setTipos(tiposGuardados);
      setComp(datos);
      setBuscadorConfig(busConfig);
      setCargando(false);
    });
  }, []);

  const handleGuardarConfig = async (nuevosTipos, nuevaBusConfig) => {
    setGuardandoTipos(true);
    await guardarConfigEnSheets(nuevosTipos, nuevaBusConfig);
    setTipos(nuevosTipos);
    setBuscadorConfig(nuevaBusConfig);
    setGuardandoTipos(false);
  };

  const procesar = useCallback(async (files) => {
    const items = Array.from(files).map((f) => ({
      id: crypto.randomUUID(), sheetRowIndex: null,
      nombre: f.name, estado: "procesando",
      datos: null, error: null,
      file: f, fileUrl: URL.createObjectURL(f),
    }));
    setComp((p) => [...items, ...p]);

    const contactosCache = await cargarContactosCache();

    for (const item of items) {
      try {
        const datos = await procesarConClaude(item.file, tipos);
        const contactoEmisor = buscarEnCache(contactosCache, datos.emisor_cuit, datos.emisor_razon_social);

        if (contactoEmisor) {
          datos.contacto_tipo        = contactoEmisor.tipo;
          datos.contacto_subtipo     = contactoEmisor.subtipo;
          datos.contacto_categoria   = contactoEmisor.categoria_costo;
          datos.contacto_clasificado = true;
          if (contactoEmisor.razon_social && !datos.emisor_razon_social) {
            datos.emisor_razon_social = contactoEmisor.razon_social;
          }
        } else {
          datos.contacto_clasificado = false;
          datos.observaciones = (datos.observaciones || "") +
            (datos.observaciones ? " | " : "") +
            "⚠ CUIT no encontrado en Contactos — verificar";
        }

        const estado = (datos.confianza === "baja" || !datos.contacto_clasificado) ? "revisar" : "procesado";
        setComp((p) => p.map((c) => c.id === item.id ? { ...c, estado, datos } : c));
        await guardarEnSheets({ ...item, estado, datos });
        await guardarItemsEnSheets(datos, contactoEmisor?.categoria_costo || "");
      } catch (e) {
        setComp((p) => p.map((c) => c.id === item.id ? { ...c, estado: "error", error: e.message } : c));
      }
    }
    const refreshed = await cargarDeSheets();
    setComp(refreshed);
  }, [tipos]);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files.length) procesar(e.dataTransfer.files);
  }, [procesar]);

  const eliminarComprobante = async () => {
    if (!sel) return;
    setEliminando(true);
    try {
      if (sel.sheetRowIndex !== null) await eliminarDeSheets(sel.sheetRowIndex);
      setComp((p) => p.filter((c) => c.id !== selId));
      setSelId(null); setConfirmarEliminar(false);
      const refreshed = await cargarDeSheets();
      setComp(refreshed);
    } catch (e) { console.error(e); }
    setEliminando(false);
  };

  const filtrados = comp.filter((c) => {
    if (fTipo !== "todos" && c.datos?.tipo !== fTipo) return false;
    if (fEst === "clasificado") {
      if (c.datos?.contacto_clasificado !== true) return false;
    } else if (fEst === "sin_clasificar") {
      if (c.datos?.contacto_clasificado !== false) return false;
    } else if (fEst !== "todos" && c.estado !== fEst) return false;
    if (q.trim()) {
      const s = q.toLowerCase();
      return c.nombre.toLowerCase().includes(s) || c.datos?.emisor_razon_social?.toLowerCase().includes(s) || c.datos?.emisor_cuit?.includes(s) || c.datos?.numero_comprobante?.includes(s);
    }
    return true;
  });

  const withData   = comp.filter((c) => c.datos);
  const totalFact  = withData.reduce((s, c) => s + (c.datos.total || 0), 0);
  const creditoIVA = withData.reduce((s, c) => s + (((c.datos.iva_105||0) + (c.datos.iva_21||0) + (c.datos.iva_27||0)) || null || 0), 0);
  const pendientes = comp.filter((c) => c.estado === "revisar").length;
  const enCurso    = comp.filter((c) => c.estado === "procesando").length;
  const sel        = selId ? comp.find((c) => c.id === selId) : null;

  const exportExcel = () => {
    const rows = withData.map((c) => ({
      Archivo: c.nombre,
      Tipo: tipos.find((t) => t.key === c.datos.tipo)?.label || c.datos.tipo,
      "N° Comprobante": c.datos.numero_comprobante || "",
      "Punto de Venta": c.datos.punto_venta || "",
      "Fecha Emisión": c.datos.fecha_emision || "",
      "Fecha Venc.": c.datos.fecha_vencimiento || "",
      Emisor: c.datos.emisor_razon_social || "",
      "CUIT Emisor": c.datos.emisor_cuit || "",
      Receptor: c.datos.receptor_razon_social || "",
      "CUIT Receptor": c.datos.receptor_cuit || "",
      "Neto Gravado": c.datos.neto_gravado ?? "",
      "IVA 10.5%": c.datos.iva_105 ?? "", "IVA 21%": c.datos.iva_21 ?? "", "IVA 27%": c.datos.iva_27 ?? "",
      "IVA $": ((c.datos.iva_105||0) + (c.datos.iva_21||0) + (c.datos.iva_27||0)) || "",
      Percepciones: c.datos.percepciones ?? "",
      "Otros Tributos": c.datos.otros_tributos ?? "",
      Total: c.datos.total ?? "",
      Moneda: c.datos.moneda || "ARS",
      Período: c.datos.periodo || "",
      Empleado: c.datos.empleado_nombre || "",
      CUIL: c.datos.empleado_cuil || "",
      Estado: c.estado,
      Observaciones: c.datos.observaciones || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Object.keys(rows[0] || {}).map((k) => ({ wch: Math.max(k.length, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comprobantes");
    XLSX.writeFile(wb, `comprobantes_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const aprobar     = (id) => setComp((p) => p.map((c) => c.id === id ? { ...c, estado: "procesado" } : c));
  const guardarEdit = () => {
    setComp((p) => p.map((c) => c.id === selId ? { ...c, datos: { ...c.datos, ...editD } } : c));
    setEditing(false);
  };

  const toggleSeleccion = (id) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleTodos = () => {
    if (seleccionados.size === filtrados.length) setSeleccionados(new Set());
    else setSeleccionados(new Set(filtrados.map(c => c.id)));
  };

  const eliminarMasivo = async () => {
    if (seleccionados.size === 0) return;
    const confirmar = window.confirm(`¿Eliminás los ${seleccionados.size} documentos seleccionados? Esta acción no se puede deshacer.`);
    if (!confirmar) return;
    setEliminandoMasivo(true);
    const aEliminar = comp
      .filter(c => seleccionados.has(c.id) && c.sheetRowIndex !== null)
      .sort((a, b) => b.sheetRowIndex - a.sheetRowIndex);
    for (const c of aEliminar) { await eliminarDeSheets(c.sheetRowIndex); }
    setSeleccionados(new Set());
    setSelId(null);
    const refreshed = await cargarDeSheets();
    setComp(refreshed);
    setEliminandoMasivo(false);
  };

  const ss   = { background: C.bg, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" };
  const tdS  = { padding: "11px 14px", fontSize: 13, verticalAlign: "middle" };
  const btnS = (bg) => ({ flex: 1, background: bg, color: "#fff", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 700, fontSize: 13, cursor: "pointer" });

  // ─── Header ───────────────────────────────────────────────────────────────
  const Header = () => (
    <div style={{ background: C.navy, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 58, position: "sticky", top: 0, zIndex: 200, boxShadow: "0 2px 10px rgba(0,0,0,0.3)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => setPantalla("home")}>
        <div style={{ width: 36, height: 36, background: C.accent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18, color: "#fff" }}>M</div>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>MICOFY</div>
          <div style={{ color: "#7a9cc8", fontSize: 11 }}>Sistema de gestión · Sermetales</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {cargando && <span style={{ background: C.accentBg, color: C.accent, border: `1px solid ${C.accent}55`, borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 700 }}>⏳ Cargando…</span>}
        {enCurso > 0 && <span style={{ background: C.accentBg, color: C.accent, border: `1px solid ${C.accent}55`, borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 700 }}>⚡ Procesando {enCurso}…</span>}
        {["home","digitalizador","pagos","cheques","contactos","insumos","costos","config"].map(p => {
          const labels = { home: "🏠 Inicio", digitalizador: "📄 Digitalizador", pagos: "💳 Pagos", cheques: "🏦 Cheques", contactos: "👥 Contactos", insumos: "📦 Insumos", costos: "📊 Costos", config: "⚙ Config" };
          return (
            <button key={p} onClick={() => setPantalla(p === pantalla ? "home" : p)}
              style={{ background: pantalla === p ? C.accent : "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
              {labels[p]}
            </button>
          );
        })}
        <button onClick={() => window.open("https://docs.google.com/spreadsheets/d/1o7jI-MoDJ4m-b9EDy5ClZoEMRYhWCphcn5iORJu6gIw/edit", "_blank")}
          style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
          📊 Sheets
        </button>
        <div style={{ width: 34, height: 34, background: C.navyLight, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13, border: `2px solid ${C.accent}` }}>HM</div>
      </div>
    </div>
  );

  // ─── Pantallas ─────────────────────────────────────────────────────────────
  if (pantalla === "home") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Segoe UI',system-ui,sans-serif", fontSize: 14, color: C.text }}>
        <Header />
        <HomeScreen onNavegar={(key) => setPantalla(key)} buscadorConfig={buscadorConfig} />
      </div>
    );
  }

  if (pantalla === "pagos") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Segoe UI',system-ui,sans-serif", fontSize: 14, color: C.text }}>
        <Header />
        <PagosScreen onVolver={() => setPantalla("home")} />
      </div>
    );
  }

  if (pantalla === "cheques") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Segoe UI',system-ui,sans-serif", fontSize: 14, color: C.text }}>
        <Header />
        <CarteraChequesScreen onVolver={() => setPantalla("home")} />
      </div>
    );
  }

  if (pantalla === "contactos") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Segoe UI',system-ui,sans-serif", fontSize: 14, color: C.text }}>
        <Header />
        <ContactosScreen onVolver={() => setPantalla("home")} />
      </div>
    );
  }

  if (pantalla === "config") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Segoe UI',system-ui,sans-serif", fontSize: 14, color: C.text }}>
        <Header />
        <ConfigScreen tipos={tipos} buscadorConfig={buscadorConfig} onGuardar={handleGuardarConfig} onVolver={() => setPantalla("home")} guardando={guardandoTipos} />
      </div>
    );
  }

  if (pantalla === "insumos") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Segoe UI',system-ui,sans-serif", fontSize: 14, color: C.text }}>
        <Header />
        <InsumosScreen onVolver={() => setPantalla("home")} />
      </div>
    );
  }

  if (pantalla === "costos") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Segoe UI',system-ui,sans-serif", fontSize: 14, color: C.text }}>
        <Header />
        <CostosScreen onVolver={() => setPantalla("home")} />
      </div>
    );
  }

  // ─── Digitalizador ─────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Segoe UI',system-ui,sans-serif", fontSize: 14, color: C.text }}>
      <Header />

      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "14px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20, maxWidth: 900 }}>
          {[
            { label: "Total comprobantes", val: comp.length,         icon: "📄", color: C.text   },
            { label: "Total facturado",    val: fmtPeso(totalFact),  icon: "💰", color: C.success },
            { label: "Crédito IVA",        val: fmtPeso(creditoIVA), icon: "🧾", color: C.accent  },
            { label: "Pend. revisión",     val: pendientes,          icon: "⚠", color: C.warning },
          ].map((s) => (
            <div key={s.label}>
              <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>{s.icon} {s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 24px", maxWidth: 1320, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: sel ? "1fr 440px" : "1fr", gap: 20, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop} onClick={() => fileRef.current.click()}
              style={{ background: drag ? C.accentBg : C.white, border: `2px dashed ${drag ? C.accent : "#b8c4d8"}`, borderRadius: 14, padding: "16px 20px", textAlign: "center", cursor: "pointer", transition: "all .2s", boxShadow: C.shadow }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>⬆️</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>Arrastrá tus PDFs o imágenes acá</div>
              <div style={{ color: C.textSec, fontSize: 12 }}>Facturas A/B/C · Tickets · Servicios · Recibos de sueldo · DDJJ</div>
              <button onClick={(e) => { e.stopPropagation(); fileRef.current.click(); }}
                style={{ marginTop: 14, background: C.accent, color: "#fff", border: "none", borderRadius: 8, padding: "9px 22px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                + Cargar archivos
              </button>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple style={{ display: "none" }} onChange={(e) => procesar(e.target.files)} />
            </div>

            <div style={{ background: C.white, borderRadius: 12, padding: 16, boxShadow: C.shadow, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: C.textMuted }}>🔍</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por proveedor, CUIT o número de comprobante"
                  style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 34px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, color: C.text, background: C.bg, outline: "none" }} />
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} style={ss}>
                  <option value="todos">Todos los tipos</option>
                  {tipos.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <select value={fEst} onChange={(e) => setFEst(e.target.value)} style={ss}>
                  <option value="todos">Todos los estados</option>
                  <option value="procesado">Procesado</option>
                  <option value="revisar">Revisar</option>
                  <option value="procesando">En curso</option>
                  <option value="error">Error</option>
                  <option value="clasificado">✓ Clasificado</option>
                  <option value="sin_clasificar">⚠ Sin clasificar</option>
                </select>
                <div style={{ flex: 1 }} />
                <button onClick={exportExcel} disabled={!withData.length}
                  style={{ background: withData.length ? C.accent : "#ccc", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 700, fontSize: 13, cursor: withData.length ? "pointer" : "not-allowed" }}>
                  ⬇ Exportar a Excel
                </button>
              </div>
            </div>

            {seleccionados.size > 0 && (
              <div style={{ background: C.navy, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{seleccionados.size} documento{seleccionados.size > 1 ? "s" : ""} seleccionado{seleccionados.size > 1 ? "s" : ""}</span>
                <div style={{ flex: 1 }} />
                <button onClick={() => setSeleccionados(new Set())}
                  style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", borderRadius: 7, padding: "7px 16px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                  Cancelar selección
                </button>
                <button onClick={eliminarMasivo} disabled={eliminandoMasivo}
                  style={{ background: C.danger, color: "#fff", border: "none", borderRadius: 7, padding: "7px 18px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                  {eliminandoMasivo ? "Eliminando..." : `🗑 Eliminar ${seleccionados.size} documento${seleccionados.size > 1 ? "s" : ""}`}
                </button>
              </div>
            )}

            <div style={{ background: C.white, borderRadius: 12, boxShadow: C.shadow, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                    <th style={{ padding: "11px 14px", width: 36 }}>
                      <input type="checkbox" checked={filtrados.length > 0 && seleccionados.size === filtrados.length} onChange={toggleTodos} style={{ cursor: "pointer", width: 16, height: 16 }} />
                    </th>
                    {["Proveedor", "Tipo", "Comprobante", "Fecha", "Neto", "IVA", "Total", "Estado"].map((h) => (
                      <th key={h} style={{ padding: "11px 14px", textAlign: "left", color: C.textMuted, fontWeight: 700, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cargando ? (
                    <tr><td colSpan={9} style={{ padding: "48px 20px", textAlign: "center", color: C.textMuted }}>⏳ Cargando historial…</td></tr>
                  ) : filtrados.length === 0 ? (
                    <tr><td colSpan={9} style={{ padding: "48px 20px", textAlign: "center", color: C.textMuted }}>{comp.length === 0 ? "Cargá comprobantes para comenzar" : "Sin resultados"}</td></tr>
                  ) : filtrados.map((c) => (
                    <tr key={c.id}
                      style={{ borderBottom: `1px solid ${C.border}`, background: seleccionados.has(c.id) ? "#fff8e6" : c.id === selId ? C.accentBg : "transparent", cursor: "pointer", transition: "background .1s" }}
                      onMouseEnter={(e) => { if (!seleccionados.has(c.id) && c.id !== selId) e.currentTarget.style.background = "#f5f7ff"; }}
                      onMouseLeave={(e) => { if (!seleccionados.has(c.id) && c.id !== selId) e.currentTarget.style.background = "transparent"; }}>
                      <td style={{ padding: "11px 14px", width: 36 }} onClick={e => { e.stopPropagation(); toggleSeleccion(c.id); }}>
                        <input type="checkbox" checked={seleccionados.has(c.id)} onChange={() => toggleSeleccion(c.id)} style={{ cursor: "pointer", width: 16, height: 16 }} />
                      </td>
                      <td style={tdS} onClick={() => { setSelId(c.id === selId ? null : c.id); setEditing(false); setConfirmarEliminar(false); }}>
                        {c.estado === "procesando"
                          ? <span style={{ color: C.textMuted }}>⏳ {c.nombre}</span>
                          : <><div style={{ fontWeight: 600 }}>{c.datos?.emisor_razon_social || c.nombre}</div>
                             {c.datos?.emisor_cuit && <div style={{ fontSize: 11, color: C.textMuted }}>CUIT {c.datos.emisor_cuit}</div>}</>}
                      </td>
                      <td style={tdS} onClick={() => { setSelId(c.id === selId ? null : c.id); setEditing(false); setConfirmarEliminar(false); }}>{c.datos ? <TipoBadge tipo={c.datos.tipo} tipos={tipos} /> : "—"}</td>
                      <td style={{ ...tdS, fontFamily: "monospace", color: C.textSec, fontSize: 12 }} onClick={() => { setSelId(c.id === selId ? null : c.id); setEditing(false); setConfirmarEliminar(false); }}>{c.datos?.numero_comprobante || "—"}</td>
                      <td style={{ ...tdS, color: C.textSec }} onClick={() => { setSelId(c.id === selId ? null : c.id); setEditing(false); setConfirmarEliminar(false); }}>{fmtFecha(c.datos?.fecha_emision)}</td>
                      <td style={tdS} onClick={() => { setSelId(c.id === selId ? null : c.id); setEditing(false); setConfirmarEliminar(false); }}>{fmtPeso(c.datos?.neto_gravado)}</td>
                      <td style={{ ...tdS, color: C.textSec }} onClick={() => { setSelId(c.id === selId ? null : c.id); setEditing(false); setConfirmarEliminar(false); }}>{fmtPeso(((c.datos?.iva_105||0) + (c.datos?.iva_21||0) + (c.datos?.iva_27||0)) || null)}</td>
                      <td style={{ ...tdS, fontWeight: 700 }} onClick={() => { setSelId(c.id === selId ? null : c.id); setEditing(false); setConfirmarEliminar(false); }}>{fmtPeso(c.datos?.total)}</td>
                      <td style={tdS} onClick={() => { setSelId(c.id === selId ? null : c.id); setEditing(false); setConfirmarEliminar(false); }}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          <Badge estado={c.estado} />
                          {c.datos?.contacto_clasificado === true && (
                            <span style={{ background: C.successBg, color: C.success, border: `1px solid ${C.success}33`, borderRadius: 20, padding: "3px 8px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>✓ Clasif.</span>
                          )}
                          {c.datos?.contacto_clasificado === false && (
                            <span style={{ background: C.warningBg, color: C.warning, border: `1px solid ${C.warning}33`, borderRadius: 20, padding: "3px 8px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>⚠ S/Clasif.</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {sel && (
            <div style={{ position: "sticky", top: 76, borderRadius: 14, overflow: "hidden", boxShadow: C.shadowLg, maxHeight: "calc(100vh - 96px)", overflowY: "auto" }}>
              <div style={{ background: C.navy, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, marginRight: 10 }}>
                  <div style={{ color: C.accent, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>Detalle del comprobante</div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, lineHeight: 1.4 }}>
                    {sel.datos ? `${tipos.find((t) => t.key === sel.datos.tipo)?.label || sel.datos.tipo}${sel.datos.numero_comprobante ? " · " + sel.datos.numero_comprobante : ""} · ${sel.datos.emisor_razon_social || sel.nombre}` : sel.nombre}
                  </div>
                </div>
                <button onClick={() => { setSelId(null); setEditing(false); setConfirmarEliminar(false); }}
                  style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 16, flexShrink: 0 }}>✕</button>
              </div>

              {sel.datos?.texto_original && (
                <div style={{ background: "#f8fafc", borderBottom: `1px solid ${C.border}`, padding: "14px 20px" }}>
                  <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>Documento original</div>
                  <pre style={{ fontFamily: "monospace", fontSize: 12, color: C.textSec, margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6, background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
                    {sel.datos.texto_original}
                  </pre>
                </div>
              )}

              {sel.fileUrl && !sel.datos?.texto_original && (
                <div style={{ background: "#f8fafc", borderBottom: `1px solid ${C.border}` }}>
                  {sel.nombre.toLowerCase().endsWith(".pdf")
                    ? <iframe src={sel.fileUrl} style={{ width: "100%", height: 220, border: "none", display: "block" }} title="preview" />
                    : <img src={sel.fileUrl} alt="comprobante" style={{ width: "100%", maxHeight: 220, objectFit: "contain", display: "block", background: "#fff" }} />}
                </div>
              )}

              {sel.datos && !editing && (
                <div style={{ background: C.white, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Datos extraídos</span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {sel.datos.contacto_clasificado === true && <span style={{ background: C.successBg, color: C.success, border: `1px solid ${C.success}44`, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>✓ Clasificado</span>}
                      {sel.datos.contacto_clasificado === false && <span style={{ background: C.warningBg, color: C.warning, border: `1px solid ${C.warning}44`, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>⚠ Sin clasificar</span>}
                      <span style={{ background: sel.datos.confianza === "alta" ? C.successBg : sel.datos.confianza === "media" ? C.warningBg : C.dangerBg, color: sel.datos.confianza === "alta" ? C.success : sel.datos.confianza === "media" ? C.warning : C.danger, border: "1px solid currentColor", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
                        Confianza {sel.datos.confianza}
                      </span>
                    </div>
                  </div>

                  {sel.datos.contacto_clasificado === true && (
                    <div style={{ background: C.successBg, border: `1px solid ${C.success}33`, borderRadius: 8, padding: "10px 14px", display: "flex", gap: 16 }}>
                      <div><div style={{ fontSize: 10, color: C.success, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Tipo</div><div style={{ fontSize: 13, fontWeight: 600 }}>{sel.datos.contacto_tipo || "—"}</div></div>
                      {sel.datos.contacto_subtipo && <div><div style={{ fontSize: 10, color: C.success, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Subtipo</div><div style={{ fontSize: 13, fontWeight: 600 }}>{sel.datos.contacto_subtipo}</div></div>}
                      {sel.datos.contacto_categoria && <div><div style={{ fontSize: 10, color: C.success, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Categoría Costo</div><div style={{ fontSize: 13, fontWeight: 600 }}>{sel.datos.contacto_categoria}</div></div>}
                    </div>
                  )}
                  {sel.datos.contacto_clasificado === false && (
                    <div style={{ background: C.warningBg, border: `1px solid ${C.warning}33`, borderRadius: 8, padding: "10px 14px" }}>
                      <div style={{ fontSize: 13, color: C.warning, fontWeight: 600 }}>⚠ CUIT {sel.datos.emisor_cuit || "desconocido"} no está en Contactos</div>
                      <div style={{ fontSize: 12, color: C.textSec, marginTop: 4 }}>Agregalo en 👥 Contactos para clasificarlo automáticamente en el futuro</div>
                    </div>
                  )}

                  <Grid2 a={{ l: "Tipo", v: tipos.find((t) => t.key === sel.datos.tipo)?.label || sel.datos.tipo }} b={{ l: "N° Comprobante", v: sel.datos.numero_comprobante }} />
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
                        <thead><tr>{["Descripción", "Cant.", "P. Unit.", "Total"].map((h) => <th key={h} style={{ textAlign: "left", color: C.textMuted, fontWeight: 700, padding: "4px 6px", borderBottom: `1px solid ${C.border}`, fontSize: 10, textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
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
                    {[["Neto gravado", sel.datos.neto_gravado], ["IVA 10.5%", sel.datos.iva_105], ["IVA 21%", sel.datos.iva_21], ["IVA 27%", sel.datos.iva_27], ["Percepciones", sel.datos.percepciones], ["Otros tributos", sel.datos.otros_tributos]]
                      .filter(([, v]) => v != null && v !== 0).map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                          <span style={{ color: C.textSec }}>{k}</span><span>{fmtPeso(v)}</span>
                        </div>
                      ))}
                    <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4, fontWeight: 800, fontSize: 16 }}>
                      <span>TOTAL</span><span style={{ color: C.accent }}>{fmtPeso(sel.datos.total)}</span>
                    </div>
                  </div>

                  {sel.datos.observaciones && <F l="Observaciones" v={sel.datos.observaciones} />}

                  <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                    {sel.estado === "revisar" && <button onClick={() => aprobar(sel.id)} style={btnS(C.accent)}>✓ Aprobar</button>}
                    <button onClick={() => { setEditing(true); setEditD({ ...sel.datos }); }} style={btnS("#6c757d")}>✎ Editar</button>
                  </div>

                  {!confirmarEliminar ? (
                    <button onClick={() => setConfirmarEliminar(true)}
                      style={{ width: "100%", background: "transparent", color: C.danger, border: `1px solid ${C.danger}44`, borderRadius: 8, padding: "9px 0", fontWeight: 700, fontSize: 13, cursor: "pointer", marginTop: 4 }}>
                      🗑 Eliminar comprobante
                    </button>
                  ) : (
                    <div style={{ background: C.dangerBg, border: `1px solid ${C.danger}44`, borderRadius: 8, padding: "14px", textAlign: "center" }}>
                      <div style={{ color: C.danger, fontWeight: 700, marginBottom: 10, fontSize: 13 }}>¿Confirmás que querés eliminar este comprobante?</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={eliminarComprobante} disabled={eliminando}
                          style={{ flex: 1, background: C.danger, color: "#fff", border: "none", borderRadius: 7, padding: "9px 0", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                          {eliminando ? "Eliminando…" : "Sí, eliminar"}
                        </button>
                        <button onClick={() => setConfirmarEliminar(false)}
                          style={{ flex: 1, background: "#6c757d", color: "#fff", border: "none", borderRadius: 7, padding: "9px 0", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {sel.datos && editing && (
                <div style={{ background: C.white, padding: "16px 20px" }}>
                  <div style={{ fontWeight: 700, marginBottom: 14, color: C.navy }}>✎ Editar campos</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>Tipo de comprobante</div>
                      <select value={editD.tipo || ""} onChange={(e) => setEditD((p) => ({ ...p, tipo: e.target.value }))}
                        style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, color: C.text, background: C.bg }}>
                        {tipos.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                      </select>
                    </div>
                    {[["emisor_razon_social","Emisor razón social"],["emisor_cuit","CUIT Emisor"],["receptor_razon_social","Receptor / Nombre"],["receptor_cuit","CUIT Receptor"],["fecha_emision","Fecha emisión (YYYY-MM-DD)"],["fecha_vencimiento","Fecha vencimiento"],["numero_comprobante","N° Comprobante"],["neto_gravado","Neto gravado"],["iva_21","IVA 21%"],["percepciones","Percepciones"],["otros_tributos","Otros tributos"],["total","Total"]].map(([k, label]) => (
                      <div key={k}>
                        <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>{label}</div>
                        <input value={editD[k] ?? ""} onChange={(e) => setEditD((p) => ({ ...p, [k]: e.target.value }))}
                          style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, color: C.text, background: C.bg }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                    <button onClick={guardarEdit} style={btnS(C.accent)}>💾 Guardar</button>
                    <button onClick={() => setEditing(false)} style={btnS("#6c757d")}>Cancelar</button>
                  </div>
                </div>
              )}

              {sel.estado === "error" && <div style={{ background: C.dangerBg, padding: "14px 20px", color: C.danger, fontWeight: 600, fontSize: 13 }}>⚠ Error: {sel.error}</div>}
              {sel.estado === "procesando" && <div style={{ background: C.blueBg, padding: "24px", textAlign: "center", color: C.blue, fontWeight: 600 }}>⚡ Analizando con IA…</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
