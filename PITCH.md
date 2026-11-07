# Pitch AlanCobra (3 min, 3 personas)

**Frase:** *"pey le dio una API a CoDi. Nosotros le damos manos a los agentes."*

## Reparto en el escenario
- **Persona 1 (ZR):** gancho + giro a Codex + cierre.
- **Persona 2:** demo de Libreta (opera la laptop).
- **Persona 3:** la que paga con su celular + el demo del agente de empresa.

## Guion
**0:00 · Gancho (P1, 20 s)**
"CoDi existe desde 2019: es gratis, instantáneo y de Banxico. ¿Por qué seguimos pagando en efectivo? Porque integrarlo es chamba de programador, y ni la tiendita ni la mayoría de las empresas van a integrar una API. Pero a un agente sí le hablan."

**0:20 · Qué es (P1, 15 s)**
"AlanCobra es un servidor MCP sobre pey: cualquier agente de IA puede cobrar con CoDi. Para probarlo en el mundo real, construimos la primera app encima, para el usuario más difícil: la tiendita."

**0:35 · Libreta (P2, 75 s)**
1. 📷 Foto a una libreta de fiado escrita a mano → la IA la pasa a limpio (ignora lo tachado).
2. 🎙️ "Cóbrale a Doña Mary" → QR CoDi.
3. **P3 escanea y paga de verdad** ($0.01 con PEY_TEST_AMOUNT) → webhook → ✓ ¡Pagado!, confeti, la cuenta queda en cero.
"Pago real, banco a banco, en segundos, sin comisión y sin terminal."

**1:50 · El giro (P1 + P3, 50 s)**
"Esto no es solo para tienditas." Abrir Codex con el MCP conectado:
> "Cóbrale $0.01 al (cel de P3) por la factura FAC-001 y avísame cuando pague."
Codex llama `cobrar_a_celular` → a P3 le llega la solicitud en su banco → acepta → Codex, que estaba en `esperar_pago`, responde "✅ pagado". El pago también aparece en Libreta, en Actividad, como "🤖 Agente".
"Mismo servidor, otro agente. Un webhook de pey, todos los agentes enterados."

**2:40 · Cierre (P1, 20 s)**
"Cualquier agente en México ya puede cobrar sin efectivo y sin comisión: la tiendita por voz y las empresas en 5 líneas. Open source, sobre pey y CoDi. Esto es AlanCobra."

## Checklist antes de subir
- [ ] `npm run check` con todo en ✅ y `PEY_TEST_AMOUNT=0.01`.
- [ ] Webhook registrado en pey apuntando a `PUBLIC_URL/webhooks/pey`; probado con un pago real.
- [ ] Codex con `/mcp` mostrando las 6 herramientas; `tool_timeout_sec = 300`.
- [ ] Libreta vacía (Actividad → Borrar todo) y una hoja de fiado escrita a mano.
- [ ] Celular de P3 con CoDi activo y su número ya probado con `cobrar_a_celular`.
- [ ] Plan B: si el wifi falla, quitar PEY_API_KEY → modo demo con "Simular pago".
- [ ] Video grabado del flujo completo, por si acaso.

## Preguntas probables
- **¿Por qué MCP y no un SDK?** Un SDK es para programadores. Con MCP, el agente que una empresa ya tiene (o Codex/ChatGPT) cobra sin escribir integración.
- **¿Cómo se entera el agente del pago?** pey solo permite un webhook por key; nuestro servidor lo recibe, verifica la firma y despierta a `esperar_pago`. Si el webhook falla, concilia contra `GET /transaction/api-key`.
- **¿Seguridad?** Firma Standard Webhooks, idempotencia, token opcional para /mcp, y las herramientas solo pueden *cobrar*, nunca mover dinero hacia fuera.
- **¿Qué sigue?** Bot de WhatsApp para el tendero, `cancelar_cobro`, multi-negocio (una key de pey por comercio), historial de pagos como evidencia para microcrédito.

## Texto para el envío
**AlanCobra — CoDi para agentes.** Servidor MCP open source sobre pey: cualquier agente de IA (Codex, ChatGPT o el de tu empresa) puede cobrar con CoDi por QR, solicitud al celular o link, y *esperar* el pago gracias a que convertimos los webhooks de pey en una herramienta. Lo probamos con Libreta: la libreta del fiado de la tiendita se digitaliza con una foto o por voz (OpenAI) y cada cuenta se cobra con CoDi y se marca pagada en tiempo real. Cero comisiones, cero efectivo.
