export default async function handler(req, res) {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  const sheetId = process.env.GOOGLE_SHEET_ID;

  const { action, data } = req.body || {};

  const token = await getAccessToken(credentials);

  if (action === "get") {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Comprobantes`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const result = await response.json();
    return res.status(200).json(result);
  }

  if (action === "append") {
    const row = dataToRow(data);
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Comprobantes:append?valueInputOption=RAW`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [row] }),
      }
    );
    const result = await response.json();
    return res.status(200).json(result);
  }

  return res.status(400).json({ error: "Acción no válida" });
}

async function getAccessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const header = { alg: "RS256", typ: "JWT" };
  const toSign =
    btoa(JSON.stringify(header)) + "." + btoa(JSON.stringify(payload));

  const privateKey = credentials.private_key;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(toSign)
  );

  const jwt = toSign + "." + btoa(String.fromCharCode(...new Uint8Array(signature)));

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const result = await response.json();
  return result.access_token;
}

function pemToArrayBuffer(pem) {
  const base64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buffer;
}

function dataToRow(d) {
  return [
    d.nombre || "",
    d.tipo || "",
    d.numero_comprobante || "",
    d.punto_venta || "",
    d.fecha_emision || "",
    d.fecha_vencimiento || "",
    d.emisor_razon_social || "",
    d.emisor_cuit || "",
    d.receptor_razon_social || "",
    d.receptor_cuit || "",
    d.neto_gravado ?? "",
    d.iva_alicuota ?? "",
    d.iva_importe ?? "",
    d.percepciones ?? "",
    d.otros_tributos ?? "",
    d.total ?? "",
    d.moneda || "ARS",
    d.periodo || "",
    d.empleado_nombre || "",
    d.empleado_cuil || "",
    d.estado || "",
    d.observaciones || "",
  ];
}

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};
