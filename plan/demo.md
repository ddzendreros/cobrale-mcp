# Demo y pitch · una persona, una laptop, un celular

**Frase:** *"pey le dio una API a CoDi. Nosotros le damos manos a los agentes."*

Setup en el escenario:
- Laptop proyectando **Chrome con `PUBLIC_URL`** (Libreta, con el admin ya abierto) y, en otra ventana, **Codex** ya conectado.
- Tu celular con la app del banco abierta.
- La hoja de la libreta de papel.

## Guion (3:00)

**0:00 · Gancho (20 s)**
"CoDi existe desde 2019: es de Banxico, es gratis y el dinero llega en segundos. ¿Por qué seguimos pagando en efectivo? Porque integrarlo es chamba de programador, y ni la tiendita ni la mayoría de las empresas van a integrar una API. Pero a un agente sí le hablan."

**0:20 · Qué es (15 s)**
"Cóbrale es un servidor MCP sobre pey: cualquier agente de IA puede cobrar con CoDi. Para probarlo en el mundo real construí la primera app encima, para el usuario más difícil: la tiendita."

**0:35 · Libreta (70 s)**
1. 📷 Le tomo foto a la hoja (o subo `libreta-real.jpg`) → la IA la pasa a limpio. "Ignoró lo tachado, restó el abono, y el monto que no se lee me lo deja marcado en lugar de inventarlo." Lleno ese monto y pico **Pasar a la libreta**.
2. 🎙️ "Cóbrale a Doña Mary" → aparece el QR CoDi.
3. Saco mi celular, escaneo con la app de mi banco y pago → **¡Pagado!**, confeti, la cuenta queda en cero.
   "Pago real, banco a banco, en segundos y sin comisión. Por ser demo cobré un centavo; la libreta registra la cuenta completa."

**1:45 · El giro (55 s)**
"Esto no es solo para tienditas." Cambio a Codex, que ya tiene el MCP conectado, y pego:
> Cóbrale $0.01 al (mi cel) por la factura FAC-001 y avísame en cuanto pague.

Codex llama `cobrar_a_celular` y me llega la solicitud al banco. La enseño y la acepto. Codex, que estaba en `esperar_pago`, responde **"✅ pagado"**.
Regreso a Libreta → pestaña **Agentes 🤖**: ahí está el cobro del agente, pagado.
"Mismo servidor, otro agente. Un webhook de pey, todos los agentes enterados."

**2:40 · Cierre (20 s)**
"Cualquier agente en México ya puede cobrar sin efectivo y sin comisión: la tiendita por voz y las empresas en cinco líneas de configuración. Open source, sobre pey y CoDi. Esto es Cóbrale."

## Checklist 30 min antes

- [ ] Railway arriba: logs con `pey: EN VIVO` y `firma verificada`, y `PEY_TEST_AMOUNT=0.01`.
- [ ] Un pago QR real de prueba **hace menos de 30 min** que salió ✅.
- [ ] En la laptop, `PUBLIC_URL/?admin=<ADMIN_TOKEN>` abierto una vez: sin el chip "Solo lectura".
- [ ] Actividad → **Borrar todo**. Pestaña Agentes vacía: **ningún cobro pendiente**. Con $0.01 todos valen lo mismo; un pendiente de más puede confundir la asociación.
- [ ] **No** pulses "💬 Recordar" antes del demo: crea 2 cobros pendientes.
- [ ] Codex abierto en esfuerzo bajo o medio, `/mcp` muestra las herramientas, y el prompt listo para pegar con tu número.
- [ ] Celular: batería > 50 %, app del banco con sesión iniciada, CoDi activo, notificaciones del banco encendidas y "No molestar" apagado.
- [ ] Hotspot del celular listo por si falla el wifi.
- [ ] Hoja de la libreta en la mano y `libreta-real.jpg` a dos clics.
- [ ] Volumen de la laptop arriba (el "cha-ching") y zoom de Chrome al 125 %.
- [ ] Pestaña de respaldo en **modo demo**: `npm start` en `../cobrale-a`, que no tiene keys (antes haz `git merge main` ahí) → `localhost:3101`. Además, el video de respaldo abierto.

## Plan B (decide en 10 s y sigue hablando)

| Si pasa esto | Haz esto |
|---|---|
| Pagaste el QR y no sale "Pagado" en 15 s | Sigue hablando: la conciliación revisa cada 12 s. Si a los 30 s no llega, pasa al giro de Codex; normalmente aparece mientras tanto |
| pey no responde o el cobro truena | Cambia a la pestaña `localhost:3101` en modo demo y usa "Simular pago". Dilo: "aquí en modo demo; el pago real está en el video" |
| Se cae el wifi | Hotspot del celular. Sin internet: modo demo local + video |
| La foto falla o tarda | "Cargar ejemplo" y sigue con el comando |
| El micrófono no entiende | Escribe el comando |
| Codex tarda o falla | Pon el fragmento del video de esa parte |
| No llega el push al celular | Pide a Codex `cobrar_con_qr` y escanéalo |

## Preguntas probables

- **¿Por qué MCP y no un SDK?** Un SDK es para programadores. Con MCP, el agente que una empresa ya tiene (o Codex, o ChatGPT) cobra sin escribir integración.
- **¿Cómo se entera el agente del pago?** pey solo permite un webhook por key. El servidor lo recibe, verifica la firma y despierta a `esperar_pago`. Si el webhook falla, concilia contra `GET /transaction/api-key`.
- **¿Seguridad?** Firma Standard Webhooks, idempotencia por transacción, token para `/mcp`, deploy en solo lectura sin token de admin, y las herramientas solo pueden *cobrar*, nunca mandar dinero hacia fuera.
- **¿El pago fue real?** Sí, de un centavo (`PEY_TEST_AMOUNT`), banco a banco por CoDi. La libreta registra el monto de la cuenta para que se vea el flujo completo.
- **¿Qué sigue?** Bot de WhatsApp para el tendero, multi-negocio (una key de pey por comercio) y el historial de pagos como evidencia para microcrédito.
