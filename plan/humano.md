# Lo que solo Diego puede hacer (H1–H8)

Mientras el ejecutor trabaja en los carriles, esto es lo tuyo. **H1 va primero porque puede tardar en activarse.**

---

## H1 · pey desde cero (arranca YA)

**P0 · 30–60 min (más lo que tarde la activación).**

1. Entra a **portal.mipey.mx** y crea la cuenta.
2. **Cuenta de pago**: agrega tu cuenta para recibir CoDi. Mientras se activa, pey da una de prueba (README, "Pasar a modo en vivo"). Anota si queda `ACTIVE`.
3. **Developers → crear API key.** Cópiala en `AlanCobra/.env` como `PEY_API_KEY=` (solo en el checkout principal, **no** en los carriles). Si el portal la muestra una sola vez, guárdala también en tu gestor de contraseñas.
4. Prueba:
   ```bash
   npm run check
   ```
   Debe decir `✅ QR creado (id …)`.
   - **401/403** → key mal copiada.
   - **400** → la cuenta de pago aún no está activa: usa la de prueba o espera.
5. Si te atoras, escríbele a los mentores de pey **esta noche** (Discord o WhatsApp del evento), para que lo vean temprano. Borrador:
   > Hola, soy Diego de Cóbrale (DevDay Exchange). Ya tengo cuenta y API key en pey, pero `POST /codi/qr` responde `<código y mensaje>`. ¿Qué me falta para activar la cuenta de cobro o usar la de prueba? Necesito hacer un pago real de $0.01 antes del pitch. ¡Gracias!
6. **Decisión a las 08:00:** si no hay QR real funcionando, el demo va en modo demo ("Simular pago") y el pitch lo dice con honestidad. Lo demás no cambia.

> Con la key en `AlanCobra/.env`, un `npm start` local cobra **de verdad** pero nunca recibe webhooks: pey manda el único webhook de la key a Railway. Para desarrollar, usa los carriles (modo demo). Las pruebas en vivo se hacen contra Railway.

---

## H2 · Railway

**P0 · 30 min · Hazlo apenas tengas la key: main ya funciona tal cual, no esperes a las tareas.**

1. **railway.com → New Project → Deploy from GitHub repo → `cobrale-mcp`.** Railway necesita acceso al repo `ddzendreros/cobrale-mcp`: conéctalo con la cuenta de GitHub que lo administra.
2. Servicio → **Settings → Networking → Generate Domain.** Copia `https://<algo>.up.railway.app`: es tu `PUBLIC_URL`.
3. Asegúrate de que sea **una sola réplica**: los eventos y `esperar_pago` viven en memoria.
4. **Variables** (Raw Editor):

   | Variable | Valor | Nota |
   |---|---|---|
   | `PEY_API_KEY` | tu key | |
   | `PEY_WEBHOOK_SECRET` | `whsec_…` | se llena en H3 |
   | `PUBLIC_URL` | `https://<algo>.up.railway.app` | sin `/` al final |
   | `PEY_TEST_AMOUNT` | `0.01` | todos los cobros reales de un centavo |
   | `OPENAI_API_KEY` | tu key | |
   | `OPENAI_MODEL` | el que validó B3 | fijo, para no depender de `pickModel` |
   | `TZ` | `America/Mexico_City` | "hoy" en hora de CDMX |
   | `PEY_MCP_TOKEN` | aleatorio, 32+ caracteres | lo usa Codex (H5) |
   | `ADMIN_TOKEN` | aleatorio, distinto | sirve cuando B5 esté en main |
   | `ALLOW_SIMULATE` | `1` | plan B en escena; **solo después de B5** |
   | `PEY_DEBUG` | `1` | quítalo después del ensayo final, si quieres |
   | `STORE_NAME` / `STORE_OWNER` | `Abarrotes La Esperanza` / `Don Pepe` | |
   | `DATA_DIR` | `/data` | solo si agregas el volumen |

   Para generar los tokens:
   ```bash
   node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
   ```
5. Opcional, para que un redeploy no borre la libreta: **Add Volume**, montado en `/data`, más `DATA_DIR=/data`.
6. En **Deploy Logs** debe aparecer `💸 Cóbrale lista` y `pey: EN VIVO`. Abre `PUBLIC_URL` y `PUBLIC_URL/api/state`.

---

## H3 · Webhook de pey → Railway

**P0 · 10 min · Depende de: H2.**

1. Portal → **Developers → ⚙️ de tu API key → URL del webhook** = `PUBLIC_URL/webhooks/pey` → **Crear Webhook**.
2. Copia el secreto `whsec_…` en Railway como `PEY_WEBHOOK_SECRET`. Railway redeploya solo.
3. En los logs debe salir `Webhook: https://…/webhooks/pey · firma verificada`.

---

## H4 · Primer pago real de punta a punta

**P0 · 30 min · Depende de: H3 y, de preferencia, A2 en main (por `PEY_DEBUG` y la idempotencia).**
Ten abiertos los **logs de Railway** todo el tiempo.

1. **QR:** abre `PUBLIC_URL`, ve a Mostrador, escribe $1 y genera el QR (cobrará $0.01). Escanéalo con la app de tu banco y paga.
   - ✅ En segundos: "¡Pagado!", confeti, y en los logs `[webhook] codi.qr.payment_received $0.01 -> pagado cob_…`.
   - ❌ `-> sin asignar`: copia la línea `[webhook:raw]` y la `[cobro]` de ese cobro → **A2b**.
   - ❌ `firma inválida`: el secreto en Railway no coincide → H3 de nuevo.
   - ❌ Nada en 30 s: revisa la URL del webhook en el portal. La conciliación debería marcarlo en unos 12 s (`[reconcile]`); si tampoco, corre `npm run pey:tx` en `AlanCobra` y pásale la salida a A2b.
2. **Push a tu celular:** antes, confirma que tu número está dado de alta en CoDi en la app de tu banco (registro CoDi/DiMo en la configuración). En Libreta, carga el ejemplo, ponle **tu** celular a Doña Mary y pica "📲 A su cel". Acepta la solicitud en tu banco → pagado.
3. **Link (opcional):** "💬 Recordar" a alguien con saldo → abre el link → paga con CoDi.
4. **Limpieza:** Actividad → "Borrar todo". No dejes cobros pendientes: con `PEY_TEST_AMOUNT` todos valen $0.01.

**Meta: el primer pago QR real antes de las 03:00.**

---

## H5 · Codex conectado al MCP de Railway

**P0 · 20 min · Depende de: H2 (y A4 para ver 7 herramientas).**

1. En la laptop del demo, `~/.codex/config.toml`:
   ```toml
   [mcp_servers.cobrale]
   url = "https://<algo>.up.railway.app/mcp"
   bearer_token_env_var = "PEY_MCP_TOKEN"
   tool_timeout_sec = 300
   ```
   (o `codex mcp add cobrale --url https://<algo>.up.railway.app/mcp`, y luego agrega las dos líneas). Si tu Codex no acepta `url`, usa el puente `mcp-remote` de `docs/codex.md`.
2. Define `PEY_MCP_TOKEN` en la terminal donde abres Codex:
   ```powershell
   $env:PEY_MCP_TOKEN = "<el mismo de Railway>"
   ```
3. En Codex, `/mcp` debe mostrar las herramientas de Cóbrale.
4. **Para el escenario, abre la sesión de Codex del demo con esfuerzo bajo o medio**, no max. En max la respuesta tarda y en el pitch se nota.
5. Prueba el prompt exacto del demo con **tu** celular:
   > Cóbrale $0.01 al 55XXXXXXXX por la factura FAC-001 y avísame en cuanto pague.
   Acepta en tu banco → Codex debe responder "✅ pagado", y el cobro aparece en la pestaña Agentes de Libreta (B2).

---

## H6 · Libreta de papel

**P0 · 15 min · Hazla temprano: B3 la necesita.**

Escribe a mano, en una hoja de cuaderno real, con pluma, algo así:

```
Doña Mary    2 cocas 600 ........ 36
             pan bimbo .......... 48
             abonó -30
Don Chuy     cigarros + encendedor 74.50
Pedro        refrescos .......... 40      ← táchalo completo
Lupita       leche y galletas ... 52  ✓   ← palomeado (ya pagó)
El Güero     refrescos comida ... 1?0     ← que el número quede medio ilegible
Rosy         huevo 1 kg ......... 42
```

Lo que debe salir: Doña Mary 54 · Don Chuy 74.50 · El Güero `null` (baja) · Rosy 42. Pedro y Lupita, ignorados.

Toma la foto con tu celular, con luz parecida a la del lugar, y guárdala como `data/libreta-real.jpg` en `../cobrale-b` (`data/` no se sube). **Guarda la hoja física para el escenario.**

---

## H7 · Ensayos y video de respaldo

**P0 · 08:30–10:00.**

1. Dos ensayos completos con cronómetro, siguiendo `plan/demo.md`, contra Railway y con pagos reales. Anota dónde te pasas de tiempo.
2. **Video de respaldo** del flujo real completo, 2–3 min: foto → cobro QR → pago → ¡Pagado! → Codex → push → pagado → pestaña Agentes.
   - Win+Alt+R (Xbox Game Bar) graba la ventana activa; si quieres toda la pantalla, usa OBS.
   - Sube el video a YouTube como no listado (o a Drive con link) y déjalo abierto en una pestaña para el escenario.

---

## H8 · Freeze y envío

**10:00 freeze · 11:30 envío.**

1. **10:00:** el último merge ya entró. Crea el tag:
   ```bash
   git tag v1.0 && git push origin v1.0
   ```
   Desde ese momento, **no hay push a main**: cada push redeploya Railway y, sin volumen, borra la libreta.
2. Verifica que el repo se pueda ver desde fuera (público, o compártelo con los jueces).
3. Envío antes de las 11:30:
   - repo;
   - `PUBLIC_URL` (Libreta) y `PUBLIC_URL/agentes` (si entró B6);
   - link del video;
   - el texto "Texto para el envío" de `PITCH.md`;
   - las capturas de `docs/img/`.
4. Después del envío, deja Railway prendido y sin tocar hasta el pitch.
