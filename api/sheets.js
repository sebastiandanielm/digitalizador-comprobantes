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
      const row = [
        data.nombre||'', data.tipo||'', data.numero_comprobante||'',
        data.punto_venta||'', data.fecha_emision||'', data.fecha_vencimiento||'',
        data.emisor_razon_social||'', data.emisor_cuit||'',
        data.receptor_razon_social||'', data.receptor_cuit||'',
        data.neto_gravado??'', data.iva_alicuota??'', data.iva_importe??'',
        data.percepciones??'', data.otros_tributos??'', data.total??'',
        data.moneda||'ARS', data.periodo||'', data.empleado_nombre||'',
        data.empleado_cuil||'', data.estado||'', data.observaciones||''
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

    // ── Configuración de tipos ────────────────────────────────────────────────

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
      // Actualiza una fila específica (rowIndex = índice en array, sin contar encabezado)
      const c = data;
      const row = [
        c.id||'', c.cuit||'', c.razon_social||'', c.tipo||'',
        c.subtipo||'', c.categoria_costo||'', c.condicion_pago||'',
        c.contacto||'', c.telefono||'', c.mail||'',
        c.direccion||'', c.localidad||'', c.provincia||'', c.cp||'',
        c.condicion_iva||'', c.cbu||'', c.banco||'', c.alias||'',
        c.preferencia_cheque||'', c.notas||''
      ];
      const sheetRow = rowIndex + 2; // +1 encabezado, +1 base 1
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

    // Buscar contacto por CUIT o nombre (para el clasificador)
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

      // Buscar por CUIT primero
      if (cuit) {
        const cuitLimpio = cuit.replace(/[-\s]/g, '');
        const match = dataRows.find(row => {
          const rowCuit = (row[1] || '').replace(/[-\s]/g, '');
          return rowCuit === cuitLimpio;
        });
        if (match) {
          return res.status(200).json({
            encontrado: true,
            contacto: rowToContacto(match)
          });
        }
      }

      // Buscar por nombre si no encontró por CUIT
      if (nombre) {
        const nombreLower = nombre.toLowerCase();
        const match = dataRows.find(row =>
          (row[2] || '').toLowerCase().includes(nombreLower)
        );
        if (match) {
          return res.status(200).json({
            encontrado: true,
            contacto: rowToContacto(match),
            matchPorNombre: true
          });
        }
      }

      return res.status(200).json({ encontrado: false });
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
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
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
