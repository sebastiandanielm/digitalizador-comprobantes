# INSTRUCCIONES DE INSTALACIÓN
## Digitalizador de Comprobantes con IA
### Guía para usuarios sin conocimientos de programación

---

## RESUMEN DEL PROCESO

Vas a hacer 4 cosas, una sola vez, que toman unos 20 minutos:

1. Crear cuenta en GitHub (repositorio de archivos)
2. Subir los archivos del proyecto
3. Crear cuenta en Vercel (hosting gratuito)
4. Conectar y configurar tu API key de Anthropic

Una vez hecho esto, la app queda online para siempre en una URL propia,
accesible desde cualquier PC, celular o tablet, sin instalar nada.

---

## PASO 1 — Conseguir tu API Key de Anthropic

1. Abrí el navegador y entrá a: https://console.anthropic.com
2. Hacé clic en "Sign Up" y creá una cuenta con tu email
3. Una vez dentro, hacé clic en "API Keys" en el menú de la izquierda
4. Hacé clic en "+ Create Key"
5. Poné un nombre (ej: "mi-digitalizador") y hacé clic en "Create Key"
6. ⚠️ IMPORTANTE: Copiá la clave que aparece (empieza con "sk-ant-...")
   y guardála en un bloc de notas. Solo se muestra UNA vez.
7. Para cargar crédito: andá a "Billing" > "Add Credits"
   Con USD 5 tenés para procesar miles de comprobantes.

---

## PASO 2 — Crear cuenta en GitHub y subir los archivos

1. Abrí: https://github.com
2. Hacé clic en "Sign Up" y creá una cuenta gratuita
3. Una vez dentro, hacé clic en el botón verde "New" (arriba a la izquierda)
4. En "Repository name" escribí: digitalizador-comprobantes
5. Asegurate que esté seleccionado "Public"
6. Hacé clic en "Create repository"
7. En la página que aparece, hacé clic en "uploading an existing file"
8. Arrastrá TODOS los archivos y carpetas del proyecto que descargaste:
   - package.json
   - vite.config.js
   - index.html
   - carpeta "src" (con App.jsx y main.jsx adentro)
   - carpeta "api" (con claude.js adentro)
9. Abajo escribí "Primera versión" y hacé clic en "Commit changes"

---

## PASO 3 — Desplegar en Vercel (hosting gratuito)

1. Abrí: https://vercel.com
2. Hacé clic en "Sign Up" y elegí "Continue with GitHub"
   (esto conecta automáticamente tu cuenta de GitHub)
3. Una vez dentro, hacé clic en "Add New Project"
4. Vas a ver tu repositorio "digitalizador-comprobantes" en la lista
5. Hacé clic en "Import"
6. En la pantalla de configuración NO cambies nada, hacé clic en "Deploy"
7. Esperá unos 2 minutos mientras se construye
8. ¡Listo! Vercel te da una URL como: digitalizador-comprobantes.vercel.app

---

## PASO 4 — Configurar la API Key en Vercel

Este paso es clave: acá es donde ponés tu clave de Anthropic de forma segura,
sin que aparezca en el código.

1. En Vercel, entrá a tu proyecto
2. Hacé clic en "Settings" (arriba)
3. En el menú izquierdo hacé clic en "Environment Variables"
4. En el campo "Key" escribí exactamente: ANTHROPIC_API_KEY
5. En el campo "Value" pegá tu clave (la que empieza con "sk-ant-...")
6. Hacé clic en "Save"
7. Ahora hacé clic en "Deployments" > "..." del último deployment > "Redeploy"
8. Esperá 1 minuto y listo

---

## USO DE LA APP

- Entrá a tu URL (ej: digitalizador-comprobantes.vercel.app)
- Arrastrá o seleccioná PDFs, fotos de tickets, facturas escaneadas
- La IA procesa cada uno y extrae todos los datos automáticamente
- Revisá los datos, corregí si algo está mal
- Exportá a Excel cuando quieras

---

## COSTOS

- GitHub: GRATIS
- Vercel hosting: GRATIS (hasta 100GB de tráfico/mes)
- Anthropic API: se paga por uso
  · Procesar 1 comprobante: menos de $0.01 USD (menos de 1 centavo)
  · 100 comprobantes/mes ≈ $0.50 a $1 USD
  · Con USD 5 de crédito tenés para más de 6 meses de uso normal

---

## SOPORTE

Si algo no funciona en algún paso, copiá el mensaje de error exacto
y consultalo. Los errores más comunes son:

- "API key not found": el nombre de la variable debe ser exactamente
  ANTHROPIC_API_KEY (mayúsculas, sin espacios)
- "Insufficient credits": cargá crédito en console.anthropic.com > Billing
- La app no carga: verificá que todos los archivos estén subidos a GitHub

---
