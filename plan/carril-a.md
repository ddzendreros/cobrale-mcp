# Carril A · núcleo de pagos, MCP, scripts e infra

Worktree `../cobrale-a`, rama `carril-a`. Antes de cualquier tarea: preámbulo de `plan/README.md`.
Archivos del carril: `src/pey/*`, `src/mcp/*`, `scripts/*`, `examples/*`, `package.json`, `railway.json`, `.env.example`, `docs/codex.md`, `README.md`, `AGENTS.md`.

Orden: **A1 → A2 → A3 → (A2b cuando llegue) → A4 → A5.**

---

## A1 · Gate de pruebas: `npm test`

**P0 · 30 min · Depende de: nada · Desbloquea: todo (es el gate de cada merge).**
**Archivos permitidos:** `scripts/test-mcp.js`, `scripts/smoke.js` (nuevo), `package.json` (solo `"scripts"`).

### Contexto
- `scripts/test-mcp.js` hace `fetch("http://localhost:3000/api/charges/<id>/simulate")` con el puerto fijo. Si el server corre en otro puerto, la promesa rechazada truena el proceso (ECONNREFUSED). Además solo imprime: nunca sale con código 1 aunque algo falle.
- `src/server.js` carga `dotenv/config`. **dotenv no sobrescribe variables que ya existen en el entorno, aunque estén vacías.** Por eso, si el test lanza el server con `PEY_API_KEY: ""`, el `.env` real (que puede tener la key de pey en vivo) no se filtra y el test nunca crea cobros reales.
- `src/store.js` respeta `DATA_DIR`, así que el server de prueba puede escribir en una carpeta temporal y no tocar `data/db.json`.
- El webhook se verifica con la librería `standardwebhooks` (ya instalada): `new Webhook(secret).sign(msgId, date, rawBody)` produce el header `webhook-signature`; hacen falta también `webhook-id` y `webhook-timestamp` (segundos).

### Qué hacer
1. **`scripts/test-mcp.js`**
   - La URL del MCP sale de `process.argv[2] || process.env.MCP_URL || "http://localhost:3000/mcp"`; simulate va a `${new URL(mcpUrl).origin}/api/charges/<id>/simulate`, con `.catch()` para que nunca truene suelto.
   - Exporta `export async function runMcpChecks(mcpUrl, { token } = {})` que hace todas las verificaciones con `node:assert/strict` y lanza error si algo falla. Si el archivo se corre directo (compara `import.meta.url` con `pathToFileURL(process.argv[1]).href`), llama a `runMcpChecks`, imprime cada paso con ✅ y sale con código 1 si algo falla.
   - Verificaciones mínimas:
     - `listTools` incluye exactamente estas 6: `cobrar_con_qr`, `cobrar_a_celular`, `crear_link_de_pago`, `esperar_pago`, `estado_del_cobro`, `pagos_recibidos` (puede haber más).
     - `cobrar_con_qr` regresa un contenido `image` y `structuredContent.cobro_id`.
     - `esperar_pago` (tras simular) regresa `structuredContent.estado === "paid"` en menos de 5 s.
     - `cobrar_a_celular` válido funciona; con `celular: "123"` regresa `isError: true`.
     - `crear_link_de_pago` regresa `link_de_pago`.
     - `esperar_pago` de 1 s sobre el push regresa `pending`.
     - `pagos_recibidos` regresa `total >= 149.5`.
2. **`scripts/smoke.js`** (nuevo, sin dependencias):
   - Puerto libre con `net.createServer().listen(0)`. Carpeta temporal con `fs.mkdtempSync(path.join(os.tmpdir(), "cobrale-"))`. Secreto `"whsec_" + crypto.randomBytes(24).toString("base64")`.
   - Lanza `process.execPath src/server.js` con `env: { ...process.env, PORT, DATA_DIR, PEY_API_KEY: "", OPENAI_API_KEY: "", PUBLIC_URL: "", PEY_WEBHOOK_SECRET: secreto, PEY_MCP_TOKEN: "", PEY_TEST_AMOUNT: "", ALLOW_SIMULATE: "", ADMIN_TOKEN: "", PEY_DEBUG: "" }`. Guarda su stdout/stderr y solo lo imprime si algo falla.
   - Espera a que `GET /api/state` responda (cada 100 ms, máximo 10 s).
   - **Libreta** (con `fetch`):
     - `POST /api/demo/reset`, luego `POST /api/demo/seed` → 4 clientes y Doña Mary con saldo 128.
     - `POST /api/command {text:"Cóbrale a Doña Mary"}` → `charge.kind === "qr"` y `amount === 128`.
     - `POST /api/charges/<id>/simulate` → `result` empieza con `"pagado"`. Después Doña Mary queda con saldo 0 y `totals.cobradoHoyCodi === 128`.
     - `POST /api/customers/<Don Chuy>/cash {amount:20}` → Don Chuy queda en 54.5.
     - `POST /api/customers/<Lupita>/reminder` → `message` incluye `52.00` y `pushSent === true`.
     - `POST /api/command {text:"Cóbrame 45 de tortillas"}` → cobro QR por 45 sin cliente.
     - `POST /api/photo` con `data:image/jpeg;base64,AAAA` → 4 `entries` (modo demo).
     - `GET /cobro/<id>` → 200, y `GET /cobro/nope` → 404.
   - **Webhooks** (cobro nuevo de mostrador por 33):
     - Sin firma → 401.
     - Firmado `{type:"codi.qr.payment_received", amount:33, transactionId:"tx_smoke_1", datePaid:<ahora en s>}` → 200 y `result` empieza con `"pagado"`.
     - Mismo `webhook-id` otra vez → `"duplicado"`.
     - Monto 999 con otro id → `"sin asignar"`.
   - **MCP:** `await runMcpChecks(\`http://localhost:${port}/mcp\`)` importado de `./test-mcp.js`.
   - **Pruebas unitarias:** busca recursivamente `src/**/*.test.js`. Si hay, corre `spawnSync(process.execPath, ["--test", ...archivos], { stdio: "inherit", env: { mismo env del server, con DATA_DIR temporal } })` y falla si `status !== 0`.
   - En `finally`: mata el server y borra la carpeta temporal. Tiempo máximo total de 90 s. Al final imprime `✅ smoke OK (X s)`, o el error y sale con 1.
3. **`package.json`**: agrega `"test": "node scripts/smoke.js"`. No cambies los otros scripts.

### Criterios de aceptación
- [ ] `npm test` pasa **sin ningún server corriendo**, sin red, en menos de 60 s.
- [ ] No crea ni modifica `./data/`. Compara `git status` y la fecha de `data/db.json` antes y después.
- [ ] Si cambias a mano el nombre de una herramienta en `src/mcp/server.js`, `npm test` falla con un mensaje claro. Revierte después.
- [ ] Con un server en `PORT=3101`, `npm run test:mcp -- http://localhost:3101/mcp` pasa.

**Commit:** `Gate de pruebas: npm test levanta un server aislado y prueba Libreta, webhooks y MCP`

---

## A2 · Conciliación con la forma real de pey + idempotencia + `PEY_DEBUG`

**P0 · 45 min · Depende de: A1 · Desbloquea: H4 (primer pago real).**
**Archivos permitidos:** `src/pey/payments.js`, `src/pey/client.js`, `scripts/pey-tx.js` (nuevo), `scripts/smoke.js`, `package.json` (solo `"scripts"`), `.env.example`.

### Datos reales de pey (de docs.pey.mx y su openapi.json, 7 nov)
- `POST /codi/qr` → `201 { id, qrString, qrImage? }`. `id` es el IDC de Banxico; lo guardamos como `charge.peyId`.
- Webhook **`codi.qr.payment_received`**: `{ type, amount, apiKeyId, codiQrId, concept, datePaid (unix s), numRef, transactionId }`. **Sin metadata.** Casa por `codiQrId === charge.peyId` (supuesto; se verifica en H4).
- `POST /codi/pn` → `{ transactionId (ULID), codiId (folio de 20 dígitos) }`. Guardamos `peyTx = transactionId` y `peyId = codiId`.
- Webhook **`codi.pn.payment_received`**: `{ type, amount, apiKeyId, bankAccountId?, concept, datePaid, numRef (lo asigna Banxico, puede no ser el nuestro), transactionId, metadata: { clabe, bankCode, accountType, description, trackingKey, externalMetadata: { …lo que mandamos en metadata } } }`.
- `POST /payment-link/create` → `{ id, url }`. Webhook **`payment_link.status_updated`**: `{ type, apiKeyId, paymentLinkId, status: "paid"|"pending"|"processing", clientReferenceId, transactions: [{ transactionId, paymentMethod, datePaid, amount, amountBreakdown: { base, tip, fee }, applicationFee, metadata: { externalMetadata } }] }`.
- **`GET /transaction/api-key?nextToken=`** → `{ items (hasta 80, más nuevas primero), nextToken | null }`. Cada item: `{ id, status: "PENDING"|"PAID", amount, amountBreakdown, currency, paymentMethod: "CARD"|"CODI", payableType: "PAYMENT_LINK"|"API_CODI_QR"|"API_CODI_PN", payableId, description, applicationFee, dateCreated, datePaid?, metadata }`.
- `metadata` que mandamos: máximo 50 pares, llaves de hasta 40 caracteres, valores de hasta 500, de tipo string/number/bool/null.

### Problemas en el código actual (`src/pey/payments.js`)
1. `reconcile()` pasa cada `tx` tal cual a `findChargeFor`/`processEvent`, que buscan `transactionId`, `codiQrId` y `numRef`. Esos campos **no existen** en los items de `/transaction/api-key`, así que casi nunca casa.
2. **Doble conteo:** `findChargeFor` ignora los cobros ya pagados. Si la conciliación paga el cobro X y luego llega el webhook de X (con otro `webhook-id`), el webhook no encuentra X y cae a `uniquePendingByAmount`. Con `PEY_TEST_AMOUNT=0.01` todos valen 0.01, así que **puede marcar pagado otro cobro Y**. Si no hay otro, lo registra como huérfano duplicado.

### Qué hacer
1. **`export function txToEvent(tx)`** (pura, nueva) convierte un item de `/transaction/api-key` en un evento con la forma de webhook:
   - `type`: `PAYMENT_LINK` → `"payment_link.status_updated"`; `API_CODI_PN` → `"codi.pn.payment_received"`; si no, `"codi.qr.payment_received"`.
   - `status`: `"paid"` si `tx.status === "PAID"` o hay `datePaid`.
   - `amount`: `tx.amountBreakdown?.base ?? tx.amount`.
   - `transactionId`: `tx.transactionId || tx.id`.
   - `datePaid`, `metadata` y `concept: tx.description`.
   - `payableId`.
   - Según `payableType`: `codiQrId = payableId` (QR) o `paymentLinkId = payableId` (link).
2. **`findChargeFor`**: además de lo que ya hace (en este orden: chargeId de metadata → clientReferenceId → paymentLinkId → codiQrId → transactionId → numRef+monto → monto único):
   - chargeId también desde `evt.transactions?.[0]?.metadata?.externalMetadata?.chargeId`.
   - `evt.payableId` contra `c.peyId` o `c.peyTx` (para PN no sabemos cuál de los dos manda pey; prueba ambos).
   - Se mantiene la regla de "nunca asociar un pago anterior al cobro" (`paidAt >= createdAt - 120 s`).
3. **Idempotencia por transacción** en `processEvent`, antes de buscar cobro: si ya hay un cobro `paid` con el mismo `transactionId`, o (QR) el mismo `peyId === codiQrId`, o (link) el mismo `peyId === paymentLinkId`, regresa `"ya pagado <id>"` sin tocar nada y sin crear huérfano.
4. **`reconcile()`** usa `txToEvent`. Solo considera `status === "PAID"`, nunca casa por monto solo, y la llave de deduplicación es `"tx_" + id`.
5. **`PEY_DEBUG=1`** (si no está, no cambia nada):
   - En `handleWebhook`, después de verificar la firma: `console.log("[webhook:raw]", headers["webhook-id"], raw.slice(0, 4000))`. Guarda `{ at, id, body }` en `store.getDb().webhookLog` (créalo con `||= []` al primer uso, **sin tocar store.js**), dejando solo los últimos 30.
   - En `createCharge`: `console.log("[cobro]", id, kind, chargedAmount, "peyId=", peyId, "peyTx=", peyTx, "numRef=", numRef)`.
   - En `reconcile`: cuántos items llegaron, cuántos `PAID` y cuántos casaron.
   - Nunca imprimas headers de firma ni secretos.
6. **`scripts/pey-tx.js`** (nuevo) + `"pey:tx": "node scripts/pey-tx.js"` en package.json. Requiere `PEY_API_KEY`; si no está, explica y sale. Imprime con `console.table` las últimas 10: `id, status, payableType, payableId, amount, datePaid (ISO), chargeId (metadata.externalMetadata?.chargeId ?? metadata?.chargeId)`. Usa `listTransactions` de `src/pey/client.js`.
7. **`.env.example`**: agrega, con un comentario de una línea cada una, `TZ=America/Mexico_City`, `DATA_DIR=` (carpeta de datos; en Railway con volumen, `/data`) y `PEY_DEBUG=` (`1` registra los webhooks crudos).
8. **`scripts/smoke.js`**: agrega casos. Para conocer el `peyId` de un cobro, lee `<DATA_DIR>/db.json` unos 150 ms después de crearlo (el guardado tarda 50 ms).
   - Webhook QR **sin metadata**, solo `codiQrId = peyId` → pagado.
   - Webhook PN con `metadata.externalMetadata.chargeId` → pagado (crea el push con `POST /api/customers/<Lupita>/charge {method:"push"}`).
   - Webhook de link con `clientReferenceId` y `transactions[0].amountBreakdown.base` → pagado.
   - **Doble conteo:** crea dos cobros de mostrador por 10. Paga el primero por webhook. Manda otro webhook (con otro `webhook-id`) con el mismo `transactionId` → `"ya pagado"`, y el segundo cobro sigue `pending`.
   - Prueba unitaria `src/pey/payments.test.js` (node:test) de `txToEvent` con un item de cada `payableType`.

### Criterios de aceptación
- [ ] `npm test` pasa con todos los casos nuevos.
- [ ] Sin `PEY_DEBUG`, la salida del server es igual que antes.
- [ ] Ninguna firma del contrato cambió. Lo nuevo (`txToEvent`, `webhookLog`) se documenta en el bloque CONTRATO de `AGENTS.md`. Esta tarea puede tocar `AGENTS.md` solo para eso.

**Commit:** `Conciliación con la forma real de pey, idempotencia por transacción y PEY_DEBUG`

---

## A2b · Casar el pago real (bajo demanda, va antes que todo)

**P0 · 20–40 min · Depende de: H4 con un pago "sin asignar" o que no llegó.**
**Archivos permitidos:** los de A2.

Diego te pasa esto en el prompt:

```text
Ejecuta la tarea A2b de plan/carril-a.md.
Webhook crudo que llegó (de los logs de Railway, línea [webhook:raw]):
<pegar>
Línea [cobro] del cobro que debió casar:
<pegar>
Salida de `npm run pey:tx` (si la hay):
<pegar>
```

### Qué hacer
1. Agrega el payload real como fixture en `scripts/smoke.js`. Antes, cambia `clabe`, `trackingKey`, `apiKeyId` y nombres por valores falsos.
2. Explica en el reporte **por qué no casó**: qué campo del webhook corresponde a qué campo del cobro.
3. Arregla `findChargeFor` y/o `txToEvent` con el mínimo cambio. No relajes la regla de fecha ni actives el match por monto en la conciliación.
4. `npm test` pasa con el fixture nuevo.

**Commit:** `Casar pagos reales de pey: <campo> ↔ <campo>`

---

## A3 · Railway: `railway.json` + README

**P1 · 15 min · Depende de: nada.**
**Archivos permitidos:** `railway.json` (nuevo), `README.md`.

1. `railway.json` mínimo:
   ```json
   {
     "$schema": "https://railway.com/railway.schema.json",
     "deploy": {
       "startCommand": "npm start",
       "healthcheckPath": "/api/state",
       "healthcheckTimeout": 60,
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 5
     }
   }
   ```
   No pongas `builder` (que Railway detecte Node solo). Si tu conocimiento del esquema dice que algún campo no existe, quítalo y dilo en el reporte.
2. En `README.md`, dentro de "Pasar a modo en vivo", cambia el párrafo de "Deploy con URL fija" por una sección **Deploy en Railway** con:
   - Pasos: proyecto desde GitHub, generar dominio, variables y **una sola réplica**, porque los eventos y las esperas de `esperar_pago` viven en memoria.
   - Tabla de variables: `PEY_API_KEY`, `PEY_WEBHOOK_SECRET`, `PUBLIC_URL`, `PEY_TEST_AMOUNT`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `TZ=America/Mexico_City`, `PEY_MCP_TOKEN`, `ADMIN_TOKEN`, `ALLOW_SIMULATE`, `PEY_DEBUG`, `DATA_DIR`, `STORE_NAME`, `STORE_OWNER`.
   - Volumen opcional en `/data` con `DATA_DIR=/data`.
   - Recordatorio: cada push a main redeploya, y sin volumen se borran los datos.

**Commit:** `Deploy en Railway: railway.json y guía de variables`

---

## A4 · `cancelar_cobro` + evento `superseded` + resource `cobrale://pagos/hoy`

**P1 · 45 min · Depende de: A1.**
**Archivos permitidos:** `src/pey/payments.js`, `src/mcp/server.js`, `scripts/test-mcp.js`, `scripts/smoke.js`, `docs/codex.md`, `README.md`, `AGENTS.md`.

### Contexto
- `supersede(id)` hoy solo cambia `status` a `"superseded"`. Si un agente está en `esperar_pago` sobre ese cobro, se queda esperando hasta el timeout.
- pey **no tiene API para anular** un QR o push ya emitido. Cancelar es solo en Cóbrale. Si aun así lo pagan antes de que expire (3600 s), el webhook casa con el cobro (`findChargeFor` sí acepta `superseded`) y se registra pagado. Así debe quedarse.
- MCP SDK 1.32.2: `server.registerResource(name, uri, { title, description, mimeType }, async (uri) => ({ contents: [{ uri: uri.href, mimeType, text }] }))`.

### Qué hacer
1. `payments.js`:
   - `supersede` emite `events.emit("superseded", c)` (evento nuevo) **solo** si de verdad cambió de pending a superseded.
   - `waitForPayment` se resuelve también con `"superseded"` de ese id, y de inmediato si al entrar ya está `superseded`. La firma no cambia.
2. Herramienta **`cancelar_cobro`** `{ cobro_id }`:
   - Si no existe → error.
   - Si ya está `paid` → `isError` con "Ese cobro ya está pagado; no se puede cancelar".
   - Si ya estaba `superseded` → ok sin cambios (idempotente).
   - Si está `pending` → `supersede` y regresa el `summary`.
   - Descripción en español que diga que el cobro se cancela en Cóbrale y que, si aun así lo pagan, el pago se registra.
3. `esperar_pago`: si el estado final es `superseded`, el texto dice "El cobro fue cancelado".
4. Resource **`cobrale://pagos/hoy`** (nombre `pagos-hoy`, `application/json`): `{ fecha: "YYYY-MM-DD", total, pagos: [summary…] }`, con los pagados desde la medianoche local. Usa `listCharges({ status: "paid", sinceMs })` y `summary()`.
5. Pruebas (en `runMcpChecks` y en el smoke):
   - QR → `cancelar_cobro` → estado `superseded`.
   - `esperar_pago` de 30 s sobre ese cobro regresa en menos de 1 s.
   - Cancelar uno pagado → `isError`.
   - `listResources` incluye `cobrale://pagos/hoy`, y `readResource` regresa JSON con `total`.
   - `listTools` ahora tiene 7.
6. Docs:
   - `docs/codex.md`: tabla con 7 herramientas, sección del resource y "Verifica con `/mcp`: deben aparecer 7 herramientas".
   - `README.md`: tabla de herramientas.
   - `AGENTS.md`: lista de herramientas MCP, y en el bloque CONTRATO el evento `'superseded' (Charge)`.

**Commit:** `MCP: cancelar_cobro, evento superseded que despierta esperar_pago y resource cobrale://pagos/hoy`

---

## A5 · Agente de empresa conversacional (opcional)

**P2 · 40 min · Depende de: H2 (URL https de Railway) para probarlo de verdad.**
**Archivos permitidos:** `examples/agente-empresa/agente.js`, `README.md` (una línea).

1. Si hay texto en `argv` (o `--once "texto"`), se comporta como hoy: una sola respuesta.
2. Si no hay texto, chat en terminal con `node:readline/promises`:
   - Prompt `tú › `.
   - Mantiene contexto con `previous_response_id`.
   - Imprime cada `mcp_call` como `🔧 nombre(args)` y el resultado resumido.
   - Sale con `salir` o Ctrl+C.
3. Instrucciones del agente: además de las actuales, "llama `esperar_pago` con `segundos: 45` y repítelo hasta 4 veces si sigue pending; nunca inventes montos; confirma el celular antes de cobrar".
4. Errores de red o de OpenAI: muestra el mensaje y sigue en el loop.
5. No se puede probar sin `PUBLIC_URL` https y `OPENAI_API_KEY`. Dilo en el reporte y deja el comando exacto para que Diego lo pruebe.

**Commit:** `Agente de empresa: chat en terminal con contexto y espera de pago`
