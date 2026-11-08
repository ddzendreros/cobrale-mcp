# 💸 Cóbrale — pagos CoDi para agentes

**pey le dio una API a CoDi. Cóbrale le da manos a los agentes.**

Un servidor **MCP sobre [pey](https://docs.pey.mx)** para que cualquier agente de IA (Codex, ChatGPT, Claude o el agente propio de una empresa) cobre en México con **CoDi**, la red de Banxico gratuita e instantánea: QR, solicitud al celular, link de pago y, lo más importante, **`esperar_pago`**, que convierte los webhooks de pey en algo que un agente sí puede usar.

Y como prueba en el mundo real, la primera app construida encima: **📒 Libreta**, la libreta del fiado de la tiendita, que se cobra sola.

```
pey (CoDi)  →  Cóbrale (un servidor: webhook + núcleo de cobros)
                   ├── /mcp      → Codex · ChatGPT · agente de cualquier empresa
                   └── /         → Libreta (tiendita: foto/voz → cobro → pagado)
```

## Cóbrale MCP en 30 segundos

```bash
npm install && npm start
codex mcp add cobrale --url http://localhost:3000/mcp
```
> "Cóbrale $0.01 al 55XXXXXXXX por la factura FAC-001 y avísame cuando pague."

Herramientas: `cobrar_con_qr`, `cobrar_a_celular`, `crear_link_de_pago`, `esperar_pago`, `estado_del_cobro`, `pagos_recibidos`. Detalles y otros clientes: [docs/codex.md](docs/codex.md). Agente de empresa con la Responses API: [examples/agente-empresa](examples/agente-empresa/agente.js).

---

## 📒 Libreta — el fiado de la tiendita, ahora se cobra solo
**Libreta** convierte la libreta de papel del fiado en una cuenta viva que **se cobra con CoDi** (vía la API abierta de [pey](https://docs.pey.mx)) y que **se maneja hablando** (OpenAI).

- 📷 **Foto a la libreta de papel** → la IA lee la letra a mano y pasa cada cuenta pendiente a limpio (ignora lo tachado).
- 🎙️ **Dictado natural**: *"Apúntale 85 a Doña Mary de 2 cocas y un pan"*, *"Lupita me abonó 20"*, *"Mándale el cobro a Don Chuy a su cel"*.
- ▦ **Cobro CoDi con QR** en el mostrador, 📲 **solicitud push** directo a la app del banco del cliente, o 💬 **recordatorio por WhatsApp** redactado con tacto + link de pago.
- ⚡ **Webhook de pey** → la cuenta se marca pagada en tiempo real, con celebración incluida. Sin comisiones, el dinero llega directo a la cuenta del tendero.

> Problema: el fiado es crédito informal que sostiene a millones de familias, pero vive en papel, se pierde, cobrarlo da pena y casi todo se paga en efectivo. Libreta lo digitaliza sin pedirle al tendero que aprenda nada nuevo: le habla o le toma foto a lo que ya usa.

---

## Correr en 1 minuto

```bash
npm install
cp .env.example .env      # opcional: sin keys corre en modo demo
npm start                 # http://localhost:3000
```

Sin `PEY_API_KEY` y sin `OPENAI_API_KEY` todo funciona en **modo demo**: CoDi simulado (botón *Simular pago*) y parser local de frases. Con las keys, todo es real.

Antes de presentar corre el diagnóstico:

```bash
npm run check
```

Prueba la IA con un comando real, crea un QR de $0.01 en pey (no se cobra si nadie lo paga) y valida la config del webhook.

## Pasar a modo EN VIVO

1. **pey**: entra a [portal.mipey.mx](https://portal.mipey.mx), agrega una cuenta de pago (mientras se activa, pey te da una de prueba) y crea una **API key** → `PEY_API_KEY`.
2. **OpenAI**: `OPENAI_API_KEY`. El modelo se elige solo según lo que tu key tenga disponible (o fíjalo con `OPENAI_MODEL`).
3. **URL pública para el webhook** (otra terminal):
   ```bash
   npx cloudflared tunnel --url http://localhost:3000
   # o: ngrok http 3000
   ```
   Copia la URL `https://….trycloudflare.com` → `PUBLIC_URL`.
4. En el portal: **Developers → ⚙️ de tu API key → URL del webhook** = `PUBLIC_URL/webhooks/pey` → *Crear Webhook*. Copia el secreto (`whsec_…`) → `PEY_WEBHOOK_SECRET`.
5. Reinicia `npm start`. Arriba debe decir **CoDi en vivo · pey**.

Tip: `PEY_TEST_AMOUNT=0.01` hace que cada cobro real sea de un centavo (la app lo indica en pantalla) para probar sin gastar.

Si el webhook no llega (túnel caído), la app **concilia sola** cada 12 s consultando `GET /transaction/api-key` mientras haya cobros pendientes.

## Deploy con URL fija (para el envío del domingo)

Cualquier host de Node con proceso persistente sirve (Render, Railway, Fly). En Render: *New Web Service* → repo → Build `npm install` → Start `npm start` → variables del `.env` (con `PUBLIC_URL` = la URL que te dé Render). Luego actualiza el webhook en el portal de pey.

## Cómo usamos la API de pey

| Acción en Libreta | Endpoint pey |
|---|---|
| Cobrar con QR (mostrador o cuenta) | `POST /codi/qr` → `qrString` se dibuja como QR CoDi |
| "A su cel" | `POST /codi/pn` (10 dígitos) → llega a la app de su banco |
| Recordatorio WhatsApp | `POST /payment-link/create` → checkout con CoDi/tarjeta |
| Pago recibido | Webhooks `codi.qr.payment_received`, `codi.pn.payment_received`, `payment_link.status_updated` |
| Respaldo si no llega el webhook | `GET /transaction/api-key` |

Cada cobro manda `metadata.chargeId` para asociar el pago aunque cambie el `numRef`. También se asocia por `codiQrId`, `transactionId`, `paymentLinkId`/`clientReferenceId`. Los pagos que no se pueden asociar aparecen en *Actividad* como "sin asignar" (nunca se pierden).

**Seguridad**: firma verificada con Standard Webhooks (`webhook-id`, `webhook-timestamp`, `webhook-signature`), idempotencia por `webhook-id`, y un pago no se asocia a un cobro creado después de él.

## Cómo usa OpenAI

- **Comandos** → Structured Outputs (JSON Schema estricto) con acciones `add_debt`, `cash_payment`, `charge`, `set_phone`, `sale`. Conoce a los clientes existentes, así que "doña mari" cae en "Doña Mary".
- **Foto de la libreta** → visión con el mismo esquema estricto: cliente, productos, monto y nivel de confianza por línea; el tendero revisa antes de guardar.
- **Recordatorios** → mensaje cálido y respetuoso, sin presión, con el monto exacto y el link.
- Si la IA falla o no hay internet, un parser local entiende frases simples. El demo no se cae.

## Estructura

Ver [AGENTS.md](AGENTS.md): arquitectura, contrato del núcleo, dueños de cada carpeta y prompts para Codex.

Licencia MIT.
