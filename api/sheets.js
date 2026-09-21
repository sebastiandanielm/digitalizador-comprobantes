export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sheetId = process.env.GOOGLE_SHEET_ID;
  const sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  const { action, data, rowIndex } = req.body || {};

  try {
    const token = await getToken(sa);

    // ── Comprobantes ──────────────────────────────────────────────────────────

    if (action === 'get') {
      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Comprobantes`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.status(200).json(await r.json());
    }

    if (action === 'append') {
      const d = data;
      const row = [
        d.nombre||'',
        d.tipo||'',
        d.numero_comprobante||'',
        d.punto_venta||'',
        d.fecha_emision||'',
        d.fecha_vencimiento||'',
        d.emisor_razon_social||'',
        d.emisor_cuit||'',
        d.receptor_razon_social||'',
        d.receptor_cuit||'',
        d.neto_gravado??'',
        d.iva_105??'',
        d.iva_21??'',
        d.iva_27??'',
        d.percepciones??'',
        d.otros_tributos??'',
        d.total??'',
        d.moneda||'ARS',
        d.periodo||'',
        d.empleado_nombre||'',
        d.empleado_cuil||'',
        d.estado||'',
        d.observaciones||'',
        d.condicion_venta||'',
        d.cae||'',
        d.contribuciones_ss??'',
        d.aportes_ss??'',
        d.lrt??'',
        d.seguro_vida??'',
        d.jurisdiccion||'',
        d.anticipo_imp_determinado??'',
        d.valores_restan??'',
        d.valores_suman??'',
        d.a_favor_contribuyente??'',
        d.a_favor_fisco??'',
        d.a_pagar??'',
        d.comisiones_bancarias??'',
        d.impuestos_debito_credito??'',
        d.percepcion_sircreb??'',
        d.seguros_bancarios??'',
        d.debito_fiscal??'',
        d.credito_fiscal??'',
        d.saldo_tecnico_anterior??'',
        d.saldo_tecnico??'',
        d.retenciones_pagos_cuenta??'',
        d.saldo_libre_disponibilidad??'',
        d.contacto_clasificado != null ? String(d.contacto_clasificado) : '',
        d.contacto_tipo||'',
        d.contacto_categoria||'',
      ];
      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Comprobantes!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [row] }),
        }
      );
      return res.status(200).json(await r.json());
    }

    if (action === 'delete') {
      const metaR = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const meta = await metaR.json();
      const sheet = meta.sheets?.find(s => s.properties.title === 'Comprobantes');
      if (!sheet) return res.status(404).json({ error: 'Pestaña Comprobantes no encontrada' });
      const sheetTabId = sheet.properties.sheetId;
      const startRowIndex = rowIndex + 1;
      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              deleteDimension: {
                range: { sheetId: sheetTabId, dimension: 'ROWS', startIndex: startRowIndex, endIndex: startRowIndex + 1 }
              }
            }]
          }),
        }
      );
      return res.status(200).json(await r.json());
    }

    // ── Configuración ─────────────────────────────────────────────────────────

    if (action === 'get_tipos') {
      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Configuracion`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.status(200).json(await r.json());
    }

    if (action === 'save_tipos') {
      const tipos = data.tipos || [];
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Configuracion:clear`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      const values = [['key', 'label'], ...tipos.map(t => [t.key, t.label])];
      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Configuracion!A1?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values }),
        }
      );
      return res.status(200).json(await r.json());
    }

    // ── Contactos ─────────────────────────────────────────────────────────────

    if (action === 'get_contactos') {
      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Contactos`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.status(200).json(await r.json());
    }

    if (action === 'append_contacto') {
      const c = data;
      const row = [
        c.id||'', c.cuit||'', c.razon_social||'', c.tipo||'',
        c.subtipo||'', c.categoria_costo||'', c.condicion_pago||'',
        c.contacto||'', c.telefono||'', c.mail||'',
        c.direccion||'', c.localidad||'', c.provincia||'', c.cp||'',
        c.condicion_iva||'', c.cbu||'', c.banco||'', c.alias||'',
        c.preferencia_cheque||'', c.notas||''
      ];
      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Contactos!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [row] }),
        }
      );
      return res.status(200).json(await r.json());
    }

    if (action === 'update_contacto') {
      const c = data;
      const row = [
        c.id||'', c.cuit||'', c.razon_social||'', c.tipo||'',
        c.subtipo||'', c.categoria_costo||'', c.condicion_pago||'',
        c.contacto||'', c.telefono||'', c.mail||'',
        c.direccion||'', c.localidad||'', c.provincia||'', c.cp||'',
        c.condicion_iva||'', c.cbu||'', c.banco||'', c.alias||'',
        c.preferencia_cheque||'', c.notas||''
      ];
      const sheetRow = rowIndex + 2;
      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Contactos!A${sheetRow}:T${sheetRow}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [row] }),
        }
      );
      return res.status(200).json(await r.json());
    }

    if (action === 'delete_contacto') {
      const metaR = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const meta = await metaR.json();
      const sheet = meta.sheets?.find(s => s.properties.title === 'Contactos');
      if (!sheet) return res.status(404).json({ error: 'Pestaña Contactos no encontrada' });
      const sheetTabId = sheet.properties.sheetId;
      const startRowIndex = rowIndex + 1;
      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              deleteDimension: {
                range: { sheetId: sheetTabId, dimension: 'ROWS', startIndex: startRowIndex, endIndex: startRowIndex + 1 }
              }
            }]
          }),
        }
      );
      return res.status(200).json(await r.json());
    }

    if (action === 'buscar_contacto') {
      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Contactos`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const sheetData = await r.json();
      const rows = sheetData.values || [];
      if (rows.length <= 1) return res.status(200).json({ encontrado: false });
      const { cuit, nombre } = data;
      const dataRows = rows.slice(1);
      if (cuit) {
        const cuitLimpio = cuit.replace(/[-\s]/g, '');
        const match = dataRows.find(row => (row[1]||'').replace(/[-\s]/g,'') === cuitLimpio);
        if (match) return res.status(200).json({ encontrado: true, contacto: rowToContacto(match) });
      }
      if (nombre) {
        const match = dataRows.find(row => (row[2]||'').toLowerCase().includes(nombre.toLowerCase()));
        if (match) return res.status(200).json({ encontrado: true, contacto: rowToContacto(match), matchPorNombre: true });
      }
      return res.status(200).json({ encontrado: false });
    }

    // ── Cartera Cheques ───────────────────────────────────────────────────────

    if (action === 'get_cartera') {
      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Cartera_Cheques`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.status(200).json(await r.json());
    }

    if (action === 'append_cheque') {
      const c = data;
      const row = [
        c.id||'', c.nro_cheque||'', c.banco||'', c.cuit||'',
        c.titular||'', c.monto||'', c.fecha_pago||'',
        c.estado||'Disponible', c.cliente||'', c.origen||'', c.notas||''
      ];
      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Cartera_Cheques!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [row] }),
        }
      );
      return res.status(200).json(await r.json());
    }

    if (action === 'update_cheque') {
      const c = data;
      const row = [
        c.id||'', c.nro_cheque||'', c.banco||'', c.cuit||'',
        c.titular||'', c.monto||'', c.fecha_pago||'',
        c.estado||'Disponible', c.cliente||'', c.origen||'', c.notas||''
      ];
      const sheetRow = rowIndex + 2;
      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Cartera_Cheques!A${sheetRow}:K${sheetRow}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [row] }),
        }
      );
      return res.status(200).json(await r.json());
    }

    if (action === 'delete_cheque') {
      const metaR = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const meta = await metaR.json();
      const sheet = meta.sheets?.find(s => s.properties.title === 'Cartera_Cheques');
      if (!sheet) return res.status(404).json({ error: 'Pestaña Cartera_Cheques no encontrada' });
      const sheetTabId = sheet.properties.sheetId;
      const startRowIndex = rowIndex + 1;
      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              deleteDimension: {
                range: { sheetId: sheetTabId, dimension: 'ROWS', startIndex: startRowIndex, endIndex: startRowIndex + 1 }
              }
            }]
          }),
        }
      );
      return res.status(200).json(await r.json());
    }

    // ── Compras Items ─────────────────────────────────────────────────────────

    if (action === 'append_items') {
      const items = data.items || [];
      if (items.length === 0) return res.status(200).json({ ok: true });
      const values = items.map(it => [
        data.id_comprobante || '',
        data.fecha || '',
        data.proveedor || '',
        data.cuit_proveedor || '',
        it.descripcion || '',
        it.cantidad ?? '',
        it.unidad || '',
        it.precio_unitario ?? '',
        it.subtotal ?? '',
        data.categoria_costo || '',
      ]);
      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Compras_Items!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values }),
        }
      );
      return res.status(200).json(await r.json());
    }

    // ── Órdenes de Pago ───────────────────────────────────────────────────────

    if (action === 'get_ordenes') {
      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Ordenes_Pago`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.status(200).json(await r.json());
    }

    if (action === 'append_orden') {
      const o = data;

      // Hasta 5 facturas (7 columnas cada una)
      const docCols = [];
      for (let i = 0; i < 5; i++) {
        const f = (o.facturas || [])[i] || {};
        docCols.push(
          f.numero   || '',
          f.fecha    || '',
          f.cantidad || '',
          f.detalle  || '',
          f.precio   || '',
          f.tc       || '1',
          f.total    || ''
        );
      }

      // Impuestos (6 columnas)
      const impCols = [
        o.subtotal       || '',
        o.iva            || '',
        o.percepcion_iva || '',
        o.iibb_caba      || '',
        o.iibb_bsas      || '',
        o.total          || '',
      ];

      // Hasta 17 formas de pago (5 columnas cada una)
      const pagoCols = [];
      for (let i = 0; i < 17; i++) {
        const p = (o.formas_pago || [])[i] || {};
        pagoCols.push(
          p.tipo       || '',
          p.nro_cheque || '',
          p.banco      || '',
          p.fecha      || '',
          p.monto      || ''
        );
      }

      const row = [
        o.nro_orden,
        o.fecha,
        o.proveedor,
        o.cuit,
        o.datos_bancarios || '',
        ...docCols,
        ...impCols,
        ...pagoCols,
      ];

      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Ordenes_Pago!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [row] }),
        }
      );
      return res.status(200).json(await r.json());
    }

    if (action === 'get_formas_pago') {
      const r = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Configuracion!C1:C20`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data2 = await r.json();
      const valores = (data2.values || []).flat().filter(v => v && v.trim());
      return res.status(200).json({ formas: valores });
    }

    return res.status(400).json({ error: 'Acción no válida' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

function rowToContacto(row) {
  return {
    id: row[0]||'', cuit: row[1]||'', razon_social: row[2]||'',
    tipo: row[3]||'', subtipo: row[4]||'', categoria_costo: row[5]||'',
    condicion_pago: row[6]||'', contacto: row[7]||'', telefono: row[8]||'',
    mail: row[9]||'', direccion: row[10]||'', localidad: row[11]||'',
    provincia: row[12]||'', cp: row[13]||'', condicion_iva: row[14]||'',
    cbu: row[15]||'', banco: row[16]||'', alias: row[17]||'',
    preferencia_cheque: row[18]||'', notas: row[19]||''
  };
}

async function getToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, iat: now,
  }));
  const signingInput = `${header}.${payload}`;
  const pemContents = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8', binaryDer.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const jwt = `${signingInput}.${sig}`;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const result = await r.json();
  if (!result.access_token) throw new Error(JSON.stringify(result));
  return result.access_token;
}

export const config = { api: { bodyParser: { sizeLimit: '5mb' } } };
