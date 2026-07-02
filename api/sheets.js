export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sheetId = process.env.GOOGLE_SHEET_ID;
  const sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  const { action, data } = req.body || {};

  try {
    const token = await getToken(sa);

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

    return res.status(400).json({ error: 'Acción no válida' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

async function getToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }));

  const signingInput = `${header}.${payload}`;
  const pemContents = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    'pkcs8', binaryDer.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', key,
    new TextEncoder().encode(signingInput)
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

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

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };
