# Pitch Cóbrale (3 min, una persona)

**Frase:** *"pey le dio una API a CoDi. Nosotros le damos manos a los agentes."*

**En el escenario:** una persona, la laptop proyectando Libreta (Chrome) y Codex en otra ventana, su celular con la app del banco y la hoja de la libreta de papel.

## Guion
**0:00 · Gancho (20 s)**
"CoDi existe desde 2019: es de Banxico, es gratis y el dinero llega en segundos. ¿Por qué seguimos pagando en efectivo? Porque integrarlo es chamba de programador, y ni la tiendita ni la mayoría de las empresas van a integrar una API. Pero a un agente sí le hablan."

**0:20 · Qué es (15 s)**
"Cóbrale es un servidor MCP sobre pey: cualquier agente de IA puede cobrar con CoDi. Para probarlo en el mundo real construí la primera app encima, para el usuario más difícil: la tiendita."

**0:35 · Libreta (70 s)**
1. 📷 Foto a la libreta de fiado escrita a mano → la IA la pasa a limpio: ignora lo tachado, resta el abono y marca el monto que no se lee en lugar de inventarlo. Lo lleno y **Pasar a la libreta**.
2. 🎙️ "Cóbrale a Doña Mary" → QR CoDi.
3. Escaneo con la app de mi banco y pago → **¡Pagado!**, confeti, la cuenta queda en cero.
"Pago real, banco a banco, en segundos y sin comisión. Por ser demo cobré un centavo; la libreta registra la cuenta completa."

**1:45 · El giro (55 s)**
"Esto no es solo para tienditas." En Codex, con el MCP de Cóbrale conectado:
> "Cóbrale $0.01 al (mi cel) por la factura FAC-001 y avísame en cuanto pague."

Codex llama `cobrar_a_celular` → me llega la solicitud en el banco → la acepto → Codex, que estaba en `esperar_pago`, responde "✅ pagado". En Libreta, la pestaña **Agentes 🤖** muestra el cobro del agente, pagado.
"Mismo servidor, otro agente. Un webhook de pey, todos los agentes enterados."

**2:40 · Cierre (20 s)**
"Cualquier agente en México ya puede cobrar sin efectivo y sin comisión: la tiendita por voz y las empresas en cinco líneas de configuración. Open source, sobre pey y CoDi. Esto es Cóbrale."

## Checklist 30 min antes
- [ ] Railway arriba: logs con `pey: EN VIVO`, `firma verificada` y `PEY_TEST_AMOUNT=0.01`.
- [ ] Un pago QR real de prueba salió ✅ hace menos de 30 min.
- [ ] En la laptop, `PUBLIC_URL/?admin=<ADMIN_TOKEN>` abierto una vez (sin el chip "Solo lectura").
- [ ] Actividad → **Borrar todo**. Pestaña Agentes sin cobros pendientes: **un solo cobro pendiente a la vez** durante el demo.
- [ ] No pulsar "💬 Recordar" antes del demo (crea 2 cobros pendientes).
- [ ] Codex con esfuerzo bajo o medio, `/mcp` muestra las 7 herramientas, prompt listo con mi número.
- [ ] Celular: batería > 50 %, sesión del banco abierta, CoDi activo, notificaciones encendidas.
- [ ] Hotspot listo, hoja de la libreta en la mano, volumen arriba y zoom de Chrome al 125 %.
- [ ] Respaldo: Libreta en modo demo local (sin keys) y el video del flujo real abiertos en pestañas.

## Plan B
| Si pasa esto | Haz esto |
|---|---|
| El QR se pagó y no sale "Pagado" en 15 s | Sigue hablando: la conciliación revisa cada 12 s. A los 30 s, pasa al giro de Codex |
| pey no responde | Pestaña en modo demo + "Simular pago": "aquí en modo demo; el pago real está en el video" |
| Se cae el wifi | Hotspot. Sin internet: modo demo local + video |
| La foto falla | "Cargar ejemplo" y sigue con el comando |
| El micrófono no entiende | Escribe el comando |
| Codex tarda o falla | Fragmento del video |
| No llega el push | Pide a Codex `cobrar_con_qr` y escanéalo |

## Preguntas probables
- **¿Por qué MCP y no un SDK?** Un SDK es para programadores. Con MCP, el agente que una empresa ya tiene (o Codex/ChatGPT) cobra sin escribir integración.
- **¿Cómo se entera el agente del pago?** pey solo permite un webhook por key; el servidor lo recibe, verifica la firma y despierta a `esperar_pago`. Si el webhook falla, concilia contra `GET /transaction/api-key`.
- **¿Seguridad?** Firma Standard Webhooks, idempotencia por transacción, token para `/mcp`, la Libreta pública en solo lectura sin token de admin, y las herramientas solo pueden *cobrar*, nunca mover dinero hacia fuera.
- **¿El pago fue real?** Sí, de un centavo (`PEY_TEST_AMOUNT`), banco a banco por CoDi. La libreta registra el monto de la cuenta para mostrar el flujo completo.
- **¿Qué sigue?** Bot de WhatsApp para el tendero, multi-negocio (una key de pey por comercio) e historial de pagos como evidencia para microcrédito.

## Texto para el envío
**Cóbrale — pagos CoDi para agentes.** Servidor MCP open source sobre pey: cualquier agente de IA (Codex, ChatGPT o el de tu empresa) puede cobrar con CoDi por QR, solicitud al celular o link, cancelar un cobro y *esperar* el pago, porque convertimos los webhooks de pey en una herramienta. Lo probamos con Libreta: la libreta del fiado de la tiendita se digitaliza con una foto o por voz (Claude) y cada cuenta se cobra con CoDi y se marca pagada en tiempo real; los cobros de los agentes aparecen en vivo en la misma pantalla. Está en vivo y cobra de verdad: escanea el QR con tu app bancaria y paga $0.01. Cero comisiones, cero efectivo.
