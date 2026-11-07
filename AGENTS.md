# AGENTS.md — AlanCobra

Contexto para Codex (y para el equipo). Léelo antes de tocar código.

## Qué es
**AlanCobra = CoDi para agentes.** Un servidor MCP sobre la API de [pey](https://docs.pey.mx) para que cualquier agente de IA cobre con CoDi (Banxico: gratis, instantáneo). Su primera app es **Libreta**: la libreta del fiado de la tiendita, que se cobra sola (foto/voz con OpenAI → cobro CoDi → webhook → pagado).

Hackathon DevDay Exchange Community, CDMX. Entrega: domingo 8 nov, 13:00.

## Arquitectura (un solo proceso)
pey permite **un webhook por API key**, por eso un solo servidor recibe los pagos y los reparte:

```
src/server.js          monta todo (webhook, /mcp, Libreta, páginas). NO tocar sin avisar al equipo.
src/store.js           persistencia en data/db.json (compartido)
src/pey/client.js      llamadas HTTP a api.pey.mx (+ simulador si no hay PEY_API_KEY)     [Persona 1]
src/pey/payments.js    NÚCLEO: cobros, webhooks, conciliación, eventos                     [Persona 1]
src/mcp/server.js      herramientas MCP en /mcp                                            [Persona 1]
src/libreta/*          rutas /api/*, ledger del fiado, IA (comandos, foto, recordatorios)  [Persona 2]
public/*               UI de Libreta (vanilla JS, sin build, sin CDNs)                     [Persona 2]
examples/agente-empresa/  demo B2B con Responses API + MCP remoto                          [Persona 3]
docs/                  cómo conectar agentes, landing                                     [Persona 3]
scripts/               check (diagnóstico real), test-mcp (e2e demo)
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
npm run test:mcp        # e2e del MCP (en modo demo, sin PEY_API_KEY)
npm run agente -- "…"   # agente de empresa (requiere PUBLIC_URL https + OPENAI_API_KEY)
```
Antes de cada PR: `npm start` levanta sin errores y `npm run test:mcp` pasa (con el server en modo demo).

## Reglas
- ESM (`import`), Node ≥ 18, sin TypeScript, sin build. UI en español de México.
- **Nunca** subir `.env`, keys ni `data/`. Las keys se comparten por DM.
- No agregar dependencias sin avisar en el chat del equipo (todos hacen `npm install` de nuevo).
- Cada quien trabaja en SU carpeta y SU rama: `feat/mcp`, `feat/libreta`, `feat/infra`. PRs chicos a `main`, merge cada ~45 min.
- Si necesitas algo del núcleo que no está en el contrato, agrégalo como función NUEVA; no cambies firmas existentes.
- Todo debe funcionar en modo demo (sin keys): el demo no se puede caer por el wifi.

## Prompts iniciales para Codex
**Persona 1 (MCP + núcleo):**
> Lee AGENTS.md y docs/codex.md. Conecta este MCP a Codex (`codex mcp add pey --url http://localhost:3000/mcp`) y verifica las 6 herramientas. Luego mejora src/mcp/server.js: agrega `cancelar_cobro` (marca superseded) y un resource `pey://pagos/hoy`. Corre `npm run test:mcp` al final.

**Persona 2 (Libreta):**
> Lee AGENTS.md. Trabaja solo en src/libreta y public/. Agrega en la UI una pestaña "Agentes" que muestre en vivo los cobros con `source: 'mcp'` (llegan por el SSE de /api/events) y un bloque "Conecta tu agente" con la URL de /mcp copiable. No cambies src/pey.

**Persona 3 (infra + B2B + entrega):**
> Lee AGENTS.md. Haz que examples/agente-empresa/agente.js sea un chat en terminal (readline) que mantenga contexto con `previous_response_id`. Luego crea docs/index.html: landing de una página "CoDi para agentes" con el snippet de conexión y las 6 herramientas.
