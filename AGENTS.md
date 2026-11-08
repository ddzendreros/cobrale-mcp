# AGENTS.md — Cóbrale

Contexto para Codex (y para el equipo). Léelo antes de tocar código.

## Qué es
**Cóbrale = pagos CoDi para agentes.** Un servidor MCP sobre la API de [pey](https://docs.pey.mx) para que cualquier agente de IA cobre con CoDi (Banxico: gratis, instantáneo). Su primera app es **Libreta**: la libreta del fiado de la tiendita, que se cobra sola (foto/voz con OpenAI → cobro CoDi → webhook → pagado).

Hackathon DevDay Exchange Community, CDMX. Entrega: domingo 8 nov, 13:00.

## Plan hasta la entrega (modo solo)
Diego desarrolla solo; el código lo escribe el ejecutor. **El plan completo está en [`plan/`](plan/README.md): léelo antes de cualquier tarea.**

- Dos carriles en paralelo, cada uno en su worktree y rama, sobre archivos que no se cruzan:
  - **Carril A** (`carril-a`): núcleo de pagos, MCP, scripts e infra → tareas en `plan/carril-a.md`.
  - **Carril B** (`carril-b`): Libreta, UI, landing y pitch → tareas en `plan/carril-b.md`.
- Lo que no es código (pey, Railway, pagos reales, Codex, video, envío) está en `plan/humano.md`. El guion del demo, en `plan/demo.md`.
- Al ejecutor se le pide así: *"Ejecuta la tarea A2 de plan/carril-a.md."* Cada tarea dice qué archivos puede tocar.
- Freeze dom 10:00 · envío 11:30 · cierre 13:00.

### Deploy
**Railway**, proceso Node normal y **una sola réplica**. **No serverless/Vercel**: el server guarda en `data/db.json` (o en `DATA_DIR`), mantiene abiertas las esperas de `esperar_pago` y el SSE de `/api/events`. Variables: las de `.env.example`, con `PUBLIC_URL` = URL del deploy y `TZ=America/Mexico_City`. El webhook de pey apunta a `PUBLIC_URL/webhooks/pey`. Cada push a `main` redeploya.

## Arquitectura (un solo proceso)
pey permite **un webhook por API key**, por eso un solo servidor recibe los pagos y los reparte:

```
src/server.js          monta todo (webhook, /mcp, Libreta, páginas). NO tocar salvo que la tarea lo diga.
src/store.js           persistencia en data/db.json (compartido). NO tocar salvo que la tarea lo diga.
src/pey/client.js      llamadas HTTP a api.pey.mx (+ simulador si no hay PEY_API_KEY)     [Carril A]
src/pey/payments.js    NÚCLEO: cobros, webhooks, conciliación, eventos                     [Carril A]
src/mcp/server.js      herramientas MCP en /mcp                                            [Carril A]
src/libreta/*          rutas /api/*, ledger del fiado, IA (comandos, foto, recordatorios)  [Carril B]
public/*               UI de Libreta (vanilla JS, sin build, sin CDNs)                     [Carril B]
examples/agente-empresa/  demo B2B con Responses API + MCP remoto                          [Carril A]
docs/                  cómo conectar agentes                                              [Carril A]
scripts/               check (diagnóstico real), test-mcp (e2e demo), smoke (npm test)     [Carril A]
```

## CONTRATO del núcleo (`src/pey/payments.js`) — no romper sin avisar
```js
createCharge({ kind: 'qr'|'push'|'link', amount, concept?, phone?, reference?, source?: 'libreta'|'mcp'|'api', customerId?, customerName? }) -> Promise<Charge>
getCharge(id) -> Charge|null
listCharges({ status?, sinceMs?, source?, limit? }) -> Charge[]
waitForPayment(id, timeoutMs) -> Promise<Charge>        // resuelve al pagarse o al timeout
simulatePayment(id) -> string                            // solo demo / ALLOW_SIMULATE=1
handleWebhook(rawBody, headers) -> { status, body }      // verifica firma Standard Webhooks
reconcile() -> Promise<number>                           // respaldo vía GET /transaction/api-key
supersede(id), toPublic(charge), mode(), linksEnabled()
events: 'charge' (Charge) | 'paid' (Charge) | 'orphan' ({amount,...})
Charge = { id, kind, status: 'pending'|'paid'|'superseded', amount, chargedAmount, concept, reference, source,
           customerId, customerName, phone, url, qrString, qrSvg, peyId, peyTx, numRef, createdAt, paidAt }
```
Libreta escucha `events.on('paid')` para descontar del fiado. El MCP usa `waitForPayment`.

## Herramientas MCP (nombres fijos, el pitch las menciona)
`cobrar_con_qr`, `cobrar_a_celular`, `crear_link_de_pago`, `esperar_pago`, `estado_del_cobro`, `pagos_recibidos`.
Si agregas una nueva, documéntala en `docs/codex.md`.

## API de pey usada
- `POST /codi/qr` {amount, concept, numRef(1-7 dígitos), expiration(0 o ≥360), metadata} → {id, qrString}
- `POST /codi/pn` {amount, phoneNumber(10), concept, numRef, expiration(≥360), metadata} → {transactionId, codiId}
- `POST /payment-link/create` {amount, successUrl(https), backUrl(https), clientReferenceId, metadata} → {id, url}
- `GET /transaction/api-key` → transacciones (conciliación)
- Webhooks: `codi.qr.payment_received`, `codi.pn.payment_received`, `payment_link.status_updated`. Header `Authorization: Bearer <key>`.
- No hay sandbox: probar con `PEY_TEST_AMOUNT=0.01`.

## Comandos
```bash
npm install
npm start               # http://localhost:3000 (Libreta) y /mcp
npm run dev             # con --watch
npm run check           # diagnóstico REAL: OpenAI + QR de $0.01 en pey + webhook
npm run test:mcp -- <url>  # e2e del MCP contra un server en modo demo (default http://localhost:3000/mcp)
npm test                # gate: server aislado en puerto libre + Libreta + webhooks + MCP (desde la tarea A1)
npm run agente -- "…"   # agente de empresa (requiere PUBLIC_URL https + OPENAI_API_KEY)
```
Antes de cada merge a `main`: `npm start` levanta sin errores y `npm test` pasa. Antes de A1: `npm run test:mcp -- <url>` con el server en modo demo.

## Reglas
- ESM (`import`), Node ≥ 18, sin TypeScript, sin build. UI en español de México.
- **Nunca** subir `.env`, keys ni `data/`.
- No agregar dependencias.
- Cada carril toca solo los archivos que su tarea permite (ver `plan/README.md`). El ejecutor hace commits en su rama; los merges a `main` los hace Diego.
- Si necesitas algo del núcleo que no está en el contrato, agrégalo como función NUEVA; no cambies firmas existentes.
- Todo debe funcionar en modo demo (sin keys): el demo no se puede caer por el wifi.
