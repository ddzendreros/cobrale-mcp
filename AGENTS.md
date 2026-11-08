# AGENTS.md — Cóbrale

Contexto para Codex (y para el equipo). Léelo antes de tocar código.

## Qué es
**Cóbrale = pagos CoDi para agentes.** Un servidor MCP sobre la API de [pey](https://docs.pey.mx) para que cualquier agente de IA cobre con CoDi (Banxico: gratis, instantáneo). Su primera app es **Libreta**: la libreta del fiado de la tiendita, que se cobra sola (foto/voz con OpenAI → cobro CoDi → webhook → pagado).

Hackathon DevDay Exchange Community, CDMX. Entrega: domingo 8 nov, 13:00.

## Plan hasta la entrega
La base ya funciona en modo demo; no se reescribe. Lo único que puede tumbar el demo es el **pago real con pey**, así que eso va primero.

| Quién | Rama | Qué le toca |
|---|---|---|
| **Diego** · MCP + núcleo + repo | `feat/mcp` | Único que hace merge a `main`. Conectar Codex al MCP, `cancelar_cobro`, resource `cobrale://pagos/hoy`, arreglar `scripts/test-mcp.js` (tiene fijo el puerto 3000). Con la key real: `cobrar_a_celular` al cel de Alan → `esperar_pago` responde pagado. |
| **Aldo** · Libreta | `feat/libreta` | Pestaña "Agentes" en vivo + bloque "Conecta tu agente". Probar foto de una libreta de fiado escrita a mano de verdad y ajustar el prompt. Pulir vista en celular. Preparar datos del demo. |
| **Alan** · infra + B2B + entrega | `feat/infra` | **Antes de las 16:00 del sábado:** cuenta en portal.mipey.mx, API key, cuenta de pago, túnel (cloudflared) y webhook a `PUBLIC_URL/webhooks/pey`. Después: deploy, agente de empresa conversacional, landing `docs/index.html`, video de respaldo y envío. |

### Hitos
| Cuándo | Qué tiene que estar |
|---|---|
| Sáb 15:00 | Repo arriba, los 3 con `npm start` corriendo. Alan con key de pey. |
| Sáb 15:45 | Primer pago real de $0.01 por el túnel, de punta a punta (aprovechar a los mentores si falla). |
| Sáb 22:00 | Merge de las 3 ramas + deploy con URL fija. |
| Dom 10:00 | Código congelado. Ensayo del pitch (`PITCH.md`) y video. |
| Dom 11:30 | Envío hecho (cierre a las 13:00). |

### Deploy
Render o Railway (proceso Node normal). **No serverless/Vercel**: el server guarda en `data/db.json`, mantiene abiertas las esperas de `esperar_pago` y el SSE de `/api/events`. Variables: las de `.env.example` con `PUBLIC_URL` = URL del deploy, y volver a apuntar el webhook de pey a ella.

### Cómo usamos Codex
- Abrir Codex en la **raíz del repo** (lee este archivo solo) y en el prompt decir en qué carpeta puede trabajar.
- Cada PR lleva en la descripción el prompt de Codex que se usó y qué se probó.
- Antes de pedir merge: `npm start` sin errores y `npm run test:mcp` pasa.

## Arquitectura (un solo proceso)
pey permite **un webhook por API key**, por eso un solo servidor recibe los pagos y los reparte:

```
src/server.js          monta todo (webhook, /mcp, Libreta, páginas). NO tocar sin avisar al equipo.
src/store.js           persistencia en data/db.json (compartido)
src/pey/client.js      llamadas HTTP a api.pey.mx (+ simulador si no hay PEY_API_KEY)     [Diego]
src/pey/payments.js    NÚCLEO: cobros, webhooks, conciliación, eventos                     [Diego]
src/mcp/server.js      herramientas MCP en /mcp                                            [Diego]
src/libreta/*          rutas /api/*, ledger del fiado, IA (comandos, foto, recordatorios)  [Aldo]
public/*               UI de Libreta (vanilla JS, sin build, sin CDNs)                     [Aldo]
examples/agente-empresa/  demo B2B con Responses API + MCP remoto                          [Alan]
docs/                  cómo conectar agentes, landing                                     [Alan]
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
- Cada quien trabaja en SU carpeta y SU rama: `feat/mcp`, `feat/libreta`, `feat/infra`. PRs chicos a `main`; solo Diego hace merge.
- Si necesitas algo del núcleo que no está en el contrato, agrégalo como función NUEVA; no cambies firmas existentes.
- Todo debe funcionar en modo demo (sin keys): el demo no se puede caer por el wifi.

## Prompts iniciales para Codex
**Diego (MCP + núcleo):**
> Lee AGENTS.md y docs/codex.md. Trabaja solo en src/mcp, src/pey y scripts/. Primero arregla scripts/test-mcp.js: el POST de simulate usa `http://localhost:3000` fijo; debe salir del mismo origen que la URL del MCP (argv[2]). Luego en src/mcp/server.js agrega `cancelar_cobro` (usa `supersede`, solo si está pending) y un resource `cobrale://pagos/hoy`; documenta ambos en docs/codex.md. No cambies firmas del contrato. Corre `npm run test:mcp` al final.

**Aldo (Libreta):**
> Lee AGENTS.md. Trabaja solo en src/libreta y public/. Agrega en la UI una pestaña "Agentes" que muestre en vivo los cobros con `source: 'mcp'` (llegan por el SSE de /api/events) y un bloque "Conecta tu agente" con la URL de /mcp copiable. Revisa que todo se vea bien a 375px de ancho. No cambies src/pey.
>
> Segundo prompt, con la foto real: "Esta es una foto de una libreta de fiado escrita a mano. Mejora el prompt de lectura en src/libreta/ai.js para que ignore lo tachado, junte abonos del mismo cliente y no invente montos ilegibles."

**Alan (infra + B2B + entrega):**
> Lee AGENTS.md. Trabaja solo en examples/, docs/ y archivos de deploy. Agrega un render.yaml para desplegar este servidor Node (`npm install` / `npm start`, health check en `/`). Haz que examples/agente-empresa/agente.js sea un chat en terminal (readline) que mantenga contexto con `previous_response_id`. Luego crea docs/index.html: landing de una página "CoDi para agentes" con el snippet de conexión y las 6 herramientas.
