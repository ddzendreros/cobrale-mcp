<div align="center">

# 💸 Cóbrale

### Pagos CoDi para agentes de IA

Cualquier agente cobra en México por QR, al celular o con link,<br/>
y se entera en segundos cuando le pagan. Sin comisión y sin efectivo.

![Node](https://img.shields.io/badge/Node-%E2%89%A518-339933?logo=nodedotjs&logoColor=white)
![MCP](https://img.shields.io/badge/MCP-Streamable%20HTTP-111827)
![CoDi](https://img.shields.io/badge/CoDi-Banco%20de%20M%C3%A9xico-0B7A4B)
![pey](https://img.shields.io/badge/API-pey-F59E0B)
![Claude](https://img.shields.io/badge/IA-Claude%20Opus%205.5-D97757)
![OpenAI](https://img.shields.io/badge/OpenAI-Responses%20API-412991)
![Licencia](https://img.shields.io/badge/licencia-propietaria-6B7280)

<br/>

[![Probar en vivo](https://img.shields.io/badge/%E2%96%B6%20Probar%20en%20vivo-cobra%20%240.01%20real-0B7A4B?style=for-the-badge)](https://cobrale-mcp-production.up.railway.app)
[![Landing para agentes](https://img.shields.io/badge/%F0%9F%A4%96%20Para%20agentes-conecta%20tu%20MCP-111827?style=for-the-badge)](https://cobrale-mcp-production.up.railway.app/agentes)
[![Conectar Codex](https://img.shields.io/badge/Codex-1%20comando-412991?style=for-the-badge)](#conecta-tu-agente-en-30-segundos)

[Pruébalo](#pruébalo-en-vivo) · [Cómo funciona](#cómo-funciona) · [Para empresas](#para-empresas-cóbrale-mcp) · [Para tienditas](#para-tienditas-libreta) · [Correr en 1 minuto](#correr-en-1-minuto) · [Equipo](#equipo)

<br/>

<table>
  <tr>
    <td align="center" width="36%"><img src="docs/img/demo-cobro.gif" alt="Demo: se dicta 'Cóbrale a Doña Mary', sale el QR CoDi y en segundos dice ¡Pagado!" width="280"/><br/><sub><i>"Cóbrale a Doña Mary" → QR CoDi → ¡Pagado!</i></sub></td>
    <td align="center"><img src="docs/img/libreta.png" alt="Libreta: cuentas del fiado con botones para cobrar con CoDi" width="560"/><br/><sub>La Libreta: el fiado de la tiendita, cobrable con CoDi</sub></td>
  </tr>
</table>

</div>

---

## Pruébalo en vivo

> [!TIP]
> **Ruta de 2 minutos para evaluar.** El deploy cobra **con CoDi de verdad**: no es una maqueta.

- [ ] Abre **[cobrale-mcp-production.up.railway.app](https://cobrale-mcp-production.up.railway.app)** en la compu.
- [ ] Escribe o dicta *"Cóbrame 5 de prueba"* (o dale **Cobrar** a un cliente). Aparece un **QR CoDi**.
- [ ] Escanéalo con la app de tu banco (CoDi → *Escanear QR*) y paga.
- [ ] Mira la pantalla: en segundos cambia a **¡Pagado!** sin tocar nada.
- [ ] Abre la pestaña **Agentes**: ahí aparecen en vivo los cobros que crean los agentes por MCP.

> [!IMPORTANT]
> Cualquier monto se cobra como **$0.01 MXN** (`PEY_TEST_AMOUNT`). El centavo cae en una CLABE de prueba que pey habilitó para el hackathon, porque dar de alta una cuenta propia ante Banxico tarda unos cinco días. Con la cuenta del tendero activa, el mismo código cobra el monto real.

<details>
<summary><b>¿Qué pasó por dentro cuando pagaste?</b></summary>

1. La Libreta llamó a `POST /codi/qr` de pey con `metadata.chargeId`.
2. Tu banco liquidó el pago por CoDi (Banxico).
3. pey mandó el webhook `codi.qr.payment_received` a `/webhooks/pey`, firmado con Standard Webhooks.
4. Cóbrale verificó la firma, asoció el pago al cobro y emitió `paid`.
5. La Libreta lo recibió por SSE (`/api/events`) y descontó la cuenta. Si el webhook no llega, una conciliación con `GET /transaction/api-key` lo encuentra en ≤12 s.

Probado el 8 de noviembre de 2026: un pago QR CoDi de $0.01 desde una app bancaria se marcó como pagado en el mismo segundo, con firma verificada.

</details>

<details>
<summary><b>¿Y si el wifi del evento falla?</b></summary>

El botón *Simular pago* sigue disponible como plan B y todo corre en modo demo sin keys. Los pagos reales nunca lo necesitan.

</details>

### Conecta tu agente en 30 segundos

```bash
# local, en modo demo (sin keys ni token)
npm install && npm start
codex mcp add cobrale --url http://localhost:3000/mcp
```

Luego, en Codex: *"Cóbrale $5 al 55XXXXXXXX por la factura FAC-001 y avísame cuando pague."* El agente crea el cobro, llama `esperar_pago` y te responde en cuanto entra el dinero.

<details>
<summary><b>Contra el deploy en vivo (cobros reales, pide token)</b></summary>

```bash
codex mcp add cobrale --url https://cobrale-mcp-production.up.railway.app/mcp --bearer-token-env-var PEY_MCP_TOKEN
```

El token protege `/mcp` porque crea cobros reales. Más clientes en [docs/codex.md](docs/codex.md).

</details>

## El problema

CoDi existe desde 2019: es de Banxico, es gratis y el dinero llega en segundos. Aun así casi todo se sigue cobrando en efectivo, porque integrarlo es trabajo de programador. Ni la tiendita ni la mayoría de las empresas van a integrar una API de pagos.

Pero cada vez más negocios ya tienen un agente de IA. **Cóbrale le da a ese agente las herramientas para cobrar con CoDi**, encima de la API abierta de [pey](https://docs.pey.mx).

|  | 🏢 **Empresas y developers** | 🏪 **Tienditas** |
|---|---|---|
| **Producto** | Cóbrale MCP | Libreta |
| **Cómo se usa** | Su agente (Codex, ChatGPT o el propio) llama las herramientas | Hablando o con una foto de la libreta de papel |
| **Ejemplo** | *"Cóbrale $1,250 al 55… por la factura FAC-001 y avísame cuando pague"* | *"Apúntale 85 a Doña Mary de 2 cocas y un pan"* |
| **Integración** | 5 líneas de configuración | Ninguna |

## Cómo funciona

Un solo servidor recibe el webhook de pey (solo se permite uno por API key) y avisa a todos: al agente que está esperando y a la pantalla de la tiendita.

```mermaid
flowchart LR
  A["🤖 Agente<br/>Codex · ChatGPT · el de tu empresa"] -- MCP --> S
  L["📒 Libreta<br/>la tiendita"] -- "/api" --> S
  S["💸 Cóbrale<br/>núcleo de cobros"] -- "QR · push · link" --> P["pey API"]
  P --> C["CoDi · Banxico"]
  C -- pago --> P
  P -- "webhook firmado" --> S
  S -- "esperar_pago ✅" --> A
  S -- "¡Pagado! en vivo" --> L
```

La pieza clave es **`esperar_pago`**: convierte el webhook en algo que un agente sí puede usar. El agente crea el cobro, se queda esperando y recibe la respuesta en cuanto el cliente paga.

```mermaid
sequenceDiagram
  participant Ag as Agente
  participant C as Cóbrale MCP
  participant P as pey
  participant B as Banco del cliente
  Ag->>C: cobrar_a_celular(monto, celular)
  C->>P: POST /codi/pn
  P->>B: Solicitud de pago CoDi
  Ag->>C: esperar_pago(cobro_id)
  Note over C: espera abierta, hasta 280 s
  B-->>P: El cliente acepta en su app
  P-->>C: webhook codi.pn.payment_received
  C-->>Ag: ✅ Pagado
```

## Para empresas: Cóbrale MCP

```bash
npm install && npm start
codex mcp add cobrale --url http://localhost:3000/mcp
```

> *"Cóbrale $0.01 al 55XXXXXXXX por la factura FAC-001 y avísame cuando pague."*

El MCP del deploy está en `https://cobrale-mcp-production.up.railway.app/mcp` y pide `Authorization: Bearer <PEY_MCP_TOKEN>`, porque crea cobros reales. Para probarlo sin token, córrelo local en modo demo con los dos comandos de arriba.

| Herramienta | Qué hace |
|---|---|
| `cobrar_con_qr` | QR CoDi para cobro presencial. Regresa la imagen y una página `/cobro/:id` con el estado en vivo |
| `cobrar_a_celular` | Solicitud de pago directo a la app del banco del cliente (celular de 10 dígitos) |
| `crear_link_de_pago` | Link de pago de pey para mandar por WhatsApp o correo |
| `esperar_pago` | Espera a que llegue el pago (hasta 280 s por llamada) |
| `estado_del_cobro` | `pending`, `paid` o `superseded` |
| `pagos_recibidos` | Pagos de una ventana de tiempo, para conciliar |
| `cancelar_cobro` | Cancela el cobro en Cóbrale; si aun así lo pagan antes de que expire, el pago se registra |

El resource MCP `cobrale://pagos/hoy` comparte `{ fecha, total, pagos }` con los pagos recibidos desde la medianoche local.

Con la Responses API de OpenAI, el agente de cobranza de cualquier empresa se conecta así ([ejemplo completo](examples/agente-empresa/agente.js)):

```js
tools: [{
  type: "mcp",
  server_label: "cobrale",
  server_url: `${PUBLIC_URL}/mcp`,
  require_approval: "never",
}]
```

Otros clientes y configuración de Codex en [docs/codex.md](docs/codex.md).

## Para tienditas: Libreta

La libreta de papel del fiado convertida en una cuenta viva que se cobra con CoDi y se maneja hablando.

- 📷 **Foto a la libreta**: lee la letra a mano y pasa cada cuenta pendiente a limpio, ignorando lo tachado.
- 🎙️ **Dictado natural**: *"Lupita me abonó 20"*, *"Mándale el cobro a Don Chuy a su cel"*.
- ▦ **Tres formas de cobrar**: QR en el mostrador, solicitud al celular o recordatorio por WhatsApp con link de pago.
- ⚡ **Pagado en tiempo real**: llega el webhook, la cuenta queda en cero y el dinero cae directo a la cuenta del tendero.

> El fiado es crédito informal que sostiene a millones de familias, pero vive en papel, se pierde, cobrarlo da pena y casi todo se paga en efectivo. Libreta lo digitaliza sin pedirle al tendero que aprenda nada nuevo.

## Correr en 1 minuto

```bash
npm install
cp .env.example .env      # opcional: sin keys corre en modo demo
npm start                 # http://localhost:3000
```

Sin `PEY_API_KEY` ni key de IA (`ANTHROPIC_API_KEY` u `OPENAI_API_KEY`) todo funciona en **modo demo**: CoDi simulado (botón *Simular pago*) y un parser local de frases. Con las keys, todo es real.

| Comando | Para qué |
|---|---|
| `npm run dev` | Servidor con recarga automática |
| `npm run check` | Diagnóstico real: IA (Claude u OpenAI), QR de $0.01 en pey y webhook |
| `npm run test:mcp` | Prueba de punta a punta del MCP en modo demo |
| `npm run agente -- "…"` | Agente de empresa: con texto o `--once "…"` responde una vez; sin texto abre chat interactivo (requiere `PUBLIC_URL` https y `OPENAI_API_KEY`) |

<details>
<summary><b>Pasar a modo en vivo</b></summary>

1. **pey**: entra a [portal.mipey.mx](https://portal.mipey.mx) → *Herramientas de desarrollador*, da de alta una cuenta CoDi (mientras Banxico activa la tuya, pey da CLABEs de prueba) y crea una **API key** ligada a esa cuenta → `PEY_API_KEY`.
2. **IA**: `ANTHROPIC_API_KEY` (Claude, recomendado; modelo con `ANTHROPIC_MODEL`, default `claude-opus-5-5`) u `OPENAI_API_KEY` como alternativa. Si están las dos, se usa Claude.
3. **URL pública para el webhook**, en otra terminal:
   ```bash
   npx cloudflared tunnel --url http://localhost:3000
   ```
   Copia la URL `https://….trycloudflare.com` → `PUBLIC_URL`.
4. En el portal: **Developers → ⚙️ de tu API key → URL del webhook** = `PUBLIC_URL/webhooks/pey` → *Crear Webhook*. Copia el secreto (`whsec_…`) → `PEY_WEBHOOK_SECRET`.
5. Reinicia `npm start`. Arriba debe decir **CoDi en vivo · pey**.

`PEY_TEST_AMOUNT=0.01` hace que cada cobro real sea de un centavo, para probar sin gastar. Si el webhook no llega, la app concilia sola cada 12 s con `GET /transaction/api-key` mientras haya cobros pendientes.

**Deploy en Railway** (proceso Node persistente; `railway.json` ya trae el arranque y el health check en `/api/state`):

1. *New Project → Deploy from GitHub repo*, y luego *Settings → Networking → Generate Domain*.
2. Deja **una sola réplica**: los eventos y las esperas de `esperar_pago` viven en memoria.
3. Carga las variables y apunta el webhook de pey a `PUBLIC_URL/webhooks/pey`.
4. Opcional: un volumen montado en `/data` con `DATA_DIR=/data`, para que un redeploy no borre la libreta. Cada push a `main` redeploya.

| Variable | Valor |
|---|---|
| `PEY_API_KEY`, `PEY_WEBHOOK_SECRET` | key y secreto `whsec_…` del portal de pey |
| `PUBLIC_URL` | `https://<tu-app>.up.railway.app` |
| `PEY_TEST_AMOUNT` | `0.01` para probar con un centavo |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | IA de la Libreta con Claude (default `claude-opus-5-5`) |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | alternativa a Claude; también la usa el agente de empresa |
| `TZ` | `America/Mexico_City` ("hoy" en hora de CDMX) |
| `PEY_MCP_TOKEN` | token para `/mcp` |
| `ADMIN_TOKEN` | deja la Libreta pública en solo lectura; se abre una vez con `/?admin=<token>` |
| `ALLOW_SIMULATE` | `1` para dejar "Simular pago" como plan B |
| `PEY_DEBUG` | `1` registra los webhooks crudos en los logs |
| `DATA_DIR` | `/data` si usas volumen |
| `STORE_NAME`, `STORE_OWNER` | nombre de la tienda y del tendero |

</details>

<details>
<summary><b>Cómo usamos la API de pey</b></summary>

| Acción | Endpoint de pey |
|---|---|
| Cobrar con QR | `POST /codi/qr` → `qrString` se dibuja como QR CoDi |
| Cobrar al celular | `POST /codi/pn` (10 dígitos) → llega a la app de su banco |
| Link de pago | `POST /payment-link/create` → checkout con CoDi o tarjeta |
| Pago recibido | Webhooks `codi.qr.payment_received`, `codi.pn.payment_received`, `payment_link.status_updated` |
| Respaldo si no llega el webhook | `GET /transaction/api-key` |

Cada cobro manda `metadata.chargeId` para asociar el pago aunque cambie el `numRef`; también se asocia por `codiQrId`, `transactionId` y `paymentLinkId`/`clientReferenceId`. Los pagos que no se pueden asociar aparecen en *Actividad* como "sin asignar" y nunca se pierden.

**Seguridad**: firma verificada con Standard Webhooks (`webhook-id`, `webhook-timestamp`, `webhook-signature`), idempotencia por `webhook-id`, token opcional para `/mcp` y un pago nunca se asocia a un cobro creado después de él. Las herramientas solo pueden *cobrar*; no hay forma de mover dinero hacia fuera.

</details>

<details>
<summary><b>Cómo usamos la IA (Claude)</b></summary>

La Libreta usa **Claude Opus 5.5** por la Messages API con salida estructurada (`json_schema`). OpenAI queda como proveedor alterno con el mismo esquema, y el [agente de empresa](examples/agente-empresa/agente.js) usa la Responses API de OpenAI con Cóbrale como MCP remoto: el MCP funciona con cualquier agente.

- **Comandos** → salida estructurada con JSON Schema estricto y acciones `add_debt`, `cash_payment`, `charge`, `set_phone`, `sale`. Conoce a los clientes existentes, así que "doña mari" cae en "Doña Mary".
- **Foto de la libreta** → visión con el mismo esquema estricto: cliente, productos, monto y nivel de confianza por línea. El tendero revisa antes de guardar.
- **Recordatorios** → mensaje cálido y respetuoso, con el monto exacto y el link de pago.
- Si no hay internet, un parser local entiende frases simples y el demo no se cae.

</details>

## Estructura

```
src/server.js        un solo proceso: webhook, /mcp, Libreta y páginas públicas
src/pey/             cliente de pey y núcleo de cobros (webhooks, conciliación, eventos)
src/mcp/             servidor MCP con las 7 herramientas y el resource de pagos de hoy
src/libreta/         rutas, ledger del fiado y comandos en lenguaje natural
public/              interfaz de Libreta (JavaScript sin build)
examples/            agente de cobranza para empresas
docs/                conexión con clientes MCP
```

El contrato del núcleo y las convenciones del equipo están en [AGENTS.md](AGENTS.md).

## Equipo

Hecho en la Ciudad de México para el **DevDay Exchange Community Hackathon 2026** por **Diego**, **Aldo** y **Alan**.

Construido sobre [pey](https://docs.pey.mx), CoDi de Banco de México, Claude de Anthropic, la API de OpenAI y el [SDK de Model Context Protocol](https://github.com/modelcontextprotocol/typescript-sdk).

© 2026 Diego Zendreros. Todos los derechos reservados. El código se publica solo para su evaluación en el hackathon; no se concede licencia de uso, copia, modificación ni distribución. Ver [LICENSE](LICENSE).
