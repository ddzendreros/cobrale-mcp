# Carril B · Libreta, UI, landing y pitch

Worktree `../cobrale-b`, rama `carril-b`. Antes de cualquier tarea: preámbulo de `plan/README.md`.
Archivos del carril: `src/libreta/*`, `public/*`, `PITCH.md`.
Las pruebas van en `src/libreta/*.test.js` (node:test). `npm test` las corre solas desde A1; mientras A1 no entre a main, córrelas con `node --test src/libreta/`.
Para probar a mano: `npm start` con `PORT=3102` en tu `.env` → http://localhost:3102.

Orden: **B1 → B2 → B3 → B5 → B4 → B6 → B7.** B3 se puede adelantar en cuanto Diego tenga la foto (H6) y `OPENAI_API_KEY`.

Helpers que ya existen y se reusan:
- En `public/app.js`: `$`, `$$`, `money`, `esc`, `ago`, `api()`, `toast()`, `showModal()`, `onPaid()`, `chaChing()`.
- En `src/libreta/ledger.js`: `normName()` (quita acentos y honoríficos), `findCustomer()`.
- En `src/pey/payments.js` (solo lectura, no se modifica): `listCharges`, `toPublic`, `baseUrl`, `mode`, `events`.

---

## B1 · Parser local que entiende minúsculas (plan B sin internet)

**P1 · 25 min · Depende de: nada.**
**Archivos permitidos:** `src/libreta/fallback.js`, `src/libreta/ai.js` (solo las llamadas a `localParseCommand`), `src/libreta/fallback.test.js` (nuevo).

### Contexto
Sin `OPENAI_API_KEY` (o si la IA falla) se usa `localParseCommand`. Funciona con mayúsculas, pero `"cobrale a doña mary"` regresa `customer: "cobrale"`, porque la segunda regex de `nameOf` es `/i` y agarra el verbo del inicio. El dictado de Chrome muchas veces llega en minúsculas.

### Qué hacer
1. `localParseCommand(text, knownCustomers = [])`. El parámetro nuevo es opcional; la firma vieja sigue funcionando.
2. Si hay `knownCustomers`, primero busca cuál aparece en el texto, comparando `" " + normName(texto) + " "` contra `" " + normName(cliente) + " "` (importa `normName` de `./ledger.js`). Si varios coinciden, gana el nombre normalizado más largo. Usa el nombre **tal como está registrado**.
3. Si no hay coincidencia, antes de extraer el nombre quita del inicio los verbos de comando y sus variantes sin acento: cóbrale/cobrale, mándale (el cobro), apúntale, fíale, anótale, anota, cóbrame, ponle. Nunca debe salir un verbo como nombre.
4. En `ai.js`, las dos llamadas a `localParseCommand(text)` pasan también `knownCustomers`.
5. `src/libreta/fallback.test.js` con `node:test` y `node:assert/strict`:
   - Los 7 `EXAMPLES` de `public/app.js` dan el tipo, cliente y monto esperados (cópialos al test).
   - Con `known = ["Doña Mary", "Don Chuy", "Lupita"]`:
     - `"cobrale a doña mary"` → charge, Doña Mary, qr.
     - `"apuntale 50 a lupita de leche"` → add_debt, Lupita, 50.
     - `"mandale el cobro a don chuy a su cel"` → charge, Don Chuy, push.
     - `"doña mary pagó todo"` → cash_payment, Doña Mary, amount null.
     - `"cóbrame 45 de tortillas"` → sale, 45.
   - Sin `known`: `"cobrale a doña mary"` → el cliente **no** es `"cobrale"`.

### Criterios de aceptación
- [ ] `node --test src/libreta/` pasa; `npm test` también, si ya existe.
- [ ] En la UI sin OpenAI, escribir "cobrale a doña mary" con el ejemplo cargado abre el QR de Doña Mary.

**Commit:** `Parser local: entiende comandos en minúsculas y usa los clientes conocidos`

---

## B2 · Pestaña "Agentes 🤖" + "Conecta tu agente"

**P1 · 70 min · Depende de: nada (si A4 ya entró a main, haz `git merge main` antes para mostrar cancelados).**
**Archivos permitidos:** `src/libreta/routes.js`, `public/index.html`, `public/app.js`, `public/styles.css`.

### Contexto
- Los cobros que crean los agentes vía MCP tienen `source: "mcp"`. El SSE `/api/events` ya manda `charge_created` (con `charge` = `toPublic`) al crearse cualquier cobro, y `paid` al pagarse. Hoy la UI solo muestra los MCP pagados, en Actividad.
- `toPublic(c)` incluye `qrSvg`, que es pesado: no lo mandes en listas.
- En el pitch esta pestaña es la prueba visible de "otro agente cobró y la tiendita se enteró".

### Qué hacer
1. **`routes.js`**
   - `GET /api/charges?source=mcp&limit=30` → `{ charges: payments.listCharges({ source, status?, limit }).map(toPublic sin qrSvg) }`. `limit` va de 1 a 100 y por defecto es 30. No choca con `/api/charges/:id`, que ya existe.
   - En `publicState().mode`, agrega `mcp: { url: payments.baseUrl() + "/mcp", auth: Boolean(process.env.PEY_MCP_TOKEN) }`. **Nunca el token.**
   - `payments.events.on("superseded", (c) => broadcast("charge_updated", { charge: payments.toPublic(c) }))`. Si el evento no existe todavía (sin A4), no pasa nada.
2. **`index.html`**: cuarta pestaña `Agentes` (`data-tab="agentes"`) con `<span class="tab-badge" hidden>`, y su panel `#panel-agentes`:
   - Lista `#agentCharges`.
   - Estado vacío: "Todavía ningún agente ha cobrado. Conecta uno 👇".
   - Bloque **"Conecta tu agente"** con:
     - la URL del MCP y botón Copiar;
     - el comando `codex mcp add cobrale --url <URL>` con Copiar;
     - el TOML `[mcp_servers.cobrale]` con `url`, `tool_timeout_sec = 300` y, si `mode.mcp.auth`, `bearer_token_env_var = "PEY_MCP_TOKEN"`, con Copiar;
     - el snippet de Responses API `tools: [{ type: "mcp", server_label: "cobrale", server_url: "<URL>", require_approval: "never" }]`;
     - si `auth`, la nota "Este servidor pide token: pídeselo al equipo".
3. **`app.js`**
   - Al cargar y en cada `hello` del SSE: `GET /api/charges?source=mcp` y renderiza.
   - Cada fila muestra:
     - monto (`money`);
     - concepto y referencia;
     - tipo (QR, celular •••• 1234, link);
     - estado: ⏳ Esperando pago (pending), ✅ Pagado (paid) o Cancelado (superseded);
     - "hace X" (`ago`);
     - link a `payPage`.
   - SSE: `charge_created` con `source === "mcp"` → inserta arriba con una animación corta y un toast "🤖 Un agente creó un cobro de $X". `paid` y `charge_updated` → actualiza la fila (pagada en verde con animación; `onPaid` ya pone sonido y confeti).
   - Si la pestaña no está activa, sube el contador del badge; al abrirla, se limpia.
   - La URL de los snippets sale de `state.mode.mcp?.url || location.origin + "/mcp"`.
   - Copiar con `navigator.clipboard.writeText`. Si falla (http sin permiso), selecciona el texto y avisa "Cópialo con Ctrl+C".
4. **`styles.css`**: estilos de las filas, los estados y los bloques de código, coherentes con el resto (variables de `:root`). Que se vea bien a 375 px.

### Criterios de aceptación
- [ ] Con el server en 3102 y la pestaña Agentes abierta, `npm run test:mcp -- http://localhost:3102/mcp` hace aparecer el cobro QR en vivo, y se pone ✅ sin recargar.
- [ ] Si estás en otra pestaña, el badge cuenta. La lista sobrevive a una recarga.
- [ ] El JSON de `/api/charges?source=mcp` no trae `qrSvg`, y `/api/state` no trae ningún token.
- [ ] `npm test` pasa.

**Commit:** `Libreta: pestaña Agentes en vivo y bloque Conecta tu agente`

---

## B3 · Foto real de la libreta + montos ilegibles + latencia de la IA

**P0 · 45 min · Depende de: `OPENAI_API_KEY` en el `.env` del carril y la foto real en `data/libreta-real.jpg` (H6; `data/` no se sube).**
**Archivos permitidos:** `src/libreta/ai.js`, `src/libreta/probar-ia.js` (nuevo), `public/app.js`, `public/styles.css`.

### Contexto
- `parseNotebookPhoto` usa Chat Completions con `response_format: json_schema` estricto. Hoy `amount` es `number` obligatorio, así que el modelo **tiene** que inventar un número si no lo lee.
- `pickModel()` elige el primero disponible de una lista; puede caer en uno sin visión o lento. Diego puede fijar `OPENAI_MODEL`.
- Los comandos ("Cóbrale a Doña Mary") pasan por la IA en escena: cada segundo de espera se nota.

### Qué hacer
1. **`src/libreta/probar-ia.js`** (nuevo, para iterar sin la UI; carga `dotenv/config` y llama a `pickModel()` primero):
   - `node src/libreta/probar-ia.js foto data/libreta-real.jpg` → lee la imagen y arma el data URL (mime por extensión), llama `parseNotebookPhoto`, e imprime el JSON y los ms.
   - `node src/libreta/probar-ia.js cmd "Cóbrale a Doña Mary"` → llama `parseCommand` y muestra las acciones, `ai` y los ms. Con `x5`, lo repite 5 veces y da el promedio.
2. **Esquema de la foto:** `amount: { type: ["number", "null"] }`, con la descripción "null si no se lee con seguridad; nunca adivines".
3. **Prompt de la foto** (español, conciso):
   - Una entrada por persona con deuda pendiente: suma sus líneas pendientes y **resta los abonos** ("abonó", "a cuenta", "dio", "-$").
   - Ignora renglones tachados, palomeados (✓) o marcados "pagado", "pagó", "liquidó".
   - Monto dudoso → `amount: null` y `confidence: "baja"`.
   - Nombres como están escritos (Doña, Don, apodos). Si coincide con un cliente registrado, usa ese nombre exacto.
   - `items`: productos resumidos.
   - `notes`: qué ignoraste, qué abonos restaste y qué montos son dudosos.
4. **UI de la vista previa** (`showPhotoPreview` en `app.js`):
   - Si `amount` es null, el input va vacío y la fila se marca (clase `need`, borde amarillo, placeholder "¿cuánto?").
   - "Pasar a la libreta" no deja guardar mientras haya montos vacíos: avisa "Llena o quita los montos marcados".
   - El total ignora los nulos.
5. **Latencia:** `structured()` acepta `effort`. Comandos y recordatorios usan `reasoning_effort: "low"`; la foto, sin el parámetro. Si la API responde 400 por un parámetro no soportado, reintenta una vez sin él y recuerda (variable del módulo) no volver a mandarlo. Escribe en el log `[ai] <función> <ms> ms` en cada llamada.
6. Con la foto real de Diego, itera el prompt hasta que el resultado coincida con lo escrito: es la meta. Pega en el reporte el JSON final y los tiempos.

### Criterios de aceptación
- [ ] `probar-ia.js foto data/libreta-real.jpg` da las cuentas correctas: lo tachado y palomeado se ignora, los abonos se restan y lo ilegible sale `null`. Diego lo valida a ojo.
- [ ] `probar-ia.js cmd "Cóbrale a Doña Mary" x5` promedia menos de ~3 s, o el reporte dice cuánto y con qué modelo.
- [ ] `npm run check` sigue dando ✅ en OpenAI. `npm test` pasa (la IA no corre en tests).
- [ ] Sin `OPENAI_API_KEY`, todo sigue como antes (datos demo).

**Commit:** `IA: lectura de libreta real sin inventar montos y comandos con menos latencia`

---

## B5 · Candado del deploy público (`ADMIN_TOKEN`)

**P1 · 30 min · Depende de: nada. Tiene que estar en main antes de compartir la URL de Railway.**
**Archivos permitidos:** `src/libreta/routes.js`, `public/app.js`, `public/styles.css`, `src/libreta/candado.test.js` (nuevo).

### Contexto
En Railway la URL es pública. Hoy cualquiera puede `POST /api/demo/reset`, simular pagos o crear cobros desde la UI. Los jueces pueden abrir la URL antes del demo.

### Qué hacer
1. **`routes.js`**, al inicio del router: `const ADMIN = process.env.ADMIN_TOKEN || ""` y un middleware `router.use("/api", …)`:
   - Si `ADMIN` está vacío o el método es GET, deja pasar.
   - Si `req.get("x-admin-token") === ADMIN`, deja pasar.
   - Si no, `401 { message: "Modo solo lectura: falta el token de admin" }`.

   No toca `/webhooks/pey`, `/mcp` ni las páginas, que están fuera del router o no son `/api`. `GET /api/events` y `GET /api/charges/:id` siguen abiertos.
2. `publicState().mode.locked = Boolean(ADMIN)`. Nunca el token.
3. **`app.js`**
   - Si la URL trae `?admin=XYZ`, guárdalo en `localStorage["cobrale-admin"]` y quítalo de la barra con `history.replaceState`. `?admin=` vacío lo borra. Envuelve el acceso a localStorage en try/catch.
   - `api()` agrega `x-admin-token` si hay token.
   - Si `mode.locked` y no hay token: chip "👀 Solo lectura"; se deshabilitan comando, micrófono, foto, botones de las tarjetas, mostrador, "Cargar ejemplo" y "Borrar todo". Se sigue viendo todo en vivo.
   - Si una llamada da 401: toast "Modo solo lectura".
4. **`candado.test.js`** (node:test):
   - Pon `process.env.ADMIN_TOKEN = "t0k"` y `process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "cobrale-"))` **antes** de `await import("./routes.js")`. Sin el `DATA_DIR` temporal, el seed escribiría en tu `data/db.json` real.
   - Monta el router en una app de Express en el puerto 0.
   - `POST /api/demo/seed` sin header → 401; con `x-admin-token: t0k` → 200; `GET /api/state` → 200 con `mode.locked === true`.
   - Cierra el server al final.

### Criterios de aceptación
- [ ] Con `ADMIN_TOKEN=abc` local: sin `?admin` se ve en solo lectura. Con `/?admin=abc`, una vez, funciona todo, y la URL queda limpia.
- [ ] Sin `ADMIN_TOKEN`, la app se comporta exactamente como antes. `npm test` pasa: el smoke corre con `ADMIN_TOKEN` vacío.

**Commit:** `Libreta: modo solo lectura con ADMIN_TOKEN para el deploy público`

---

## B4 · Celular a 375 px

**P1 · 40 min · Depende de: B2 (para incluir la pestaña Agentes).**
**Archivos permitidos:** `public/styles.css`, `public/index.html` (solo atributos o clases), `public/app.js` (solo si hace falta para el layout).

Hoy hay un solo `@media (max-width: 760px)` al final de `styles.css`. Revisa a 375×812 y 360×740:
- [ ] Sin scroll horizontal: `document.documentElement.scrollWidth <= innerWidth` en todas las pestañas y modales.
- [ ] Header: logo + nombre en una línea, chips debajo y envueltos.
- [ ] Stats: "Me deben" a todo lo ancho y los otros dos en 2 columnas.
- [ ] Barra de comando: micrófono, input, cámara y botón caben. El botón puede quedar en solo ícono ➤ en móvil. El input con `font-size >= 16px` para que iOS no haga zoom.
- [ ] Las 4 pestañas en una fila con scroll horizontal propio si no caben.
- [ ] Tarjetas en una columna, con los 4 botones en una cuadrícula de 2×2 y toques de al menos 44 px.
- [ ] Modal como hoja inferior a todo lo ancho, con scroll interno y el QR a no más de 80vw.
- [ ] La tabla de la foto, debajo de 600 px, se ve como tarjetas apiladas: cada fila es una tarjeta con sus inputs.
- [ ] Keypad del mostrador con teclas grandes.
- [ ] Pestaña Agentes: los bloques de código hacen scroll horizontal **dentro** de su caja.

El ejecutor no siempre puede ver el navegador. Si es así, dilo, y Diego lo revisa en Chrome DevTools (modo dispositivo) con la lista de arriba.

**Commit:** `Libreta: vista de celular a 375 px`

---

## B6 · Landing `/agentes` (opcional)

**P2 · 45 min · Depende de: mejor después de A4, para listar las herramientas finales.**
**Archivos permitidos:** `public/agentes.html` (nuevo), `public/img/*` (copias de `docs/img/*.png`).

`express.static` sirve `public/` con `extensions: ["html"]`, así que `public/agentes.html` queda en `https://<railway>/agentes`, en el mismo dominio que `/mcp`. No hace falta GitHub Pages.

1. Un solo HTML con CSS en línea, sin CDNs ni fuentes externas, en español, y que se vea bien a 375 px. Título "Cóbrale · CoDi para agentes".
2. Secciones:
   - Hero ("Cualquier agente de IA cobra en México con CoDi").
   - El problema (3 líneas).
   - Cómo funciona (SVG en línea: Agente → Cóbrale → pey → CoDi → webhook → `esperar_pago` ✅).
   - Conéctalo en 1 minuto: Codex (`codex mcp add`, TOML con `tool_timeout_sec = 300`) y Responses API.
   - Herramientas: tabla generada **leyendo los `registerTool` reales de `src/mcp/server.js` al momento de la tarea**, más el resource si existe.
   - Libreta para tienditas, con las 3 capturas (`/img/libreta.png`, `/img/cobro-qr.png`, `/img/pagado.png`).
   - Pie con link al repo y a la Libreta (`/`).
3. Un script en línea rellena la URL del MCP con `location.origin + "/mcp"`, con botones Copiar.

**Commit:** `Landing /agentes: CoDi para agentes con snippets de conexión`

---

## B7 · `PITCH.md` para una persona

**P0 · 15 min · Depende de: nada (revisa `src/mcp/server.js` para el número real de herramientas).**
**Archivos permitidos:** `PITCH.md`.

Reescribe `PITCH.md` con el guion, el checklist y el plan B de `plan/demo.md`: **una sola persona**, con laptop y su celular. Conserva la frase, las preguntas probables y el texto para el envío. Actualiza:
- Las herramientas: el número real.
- Que el pago real es de $0.01 por `PEY_TEST_AMOUNT` y la libreta registra la cuenta completa.
- "Qué sigue": quita lo que ya existe (por ejemplo `cancelar_cobro`, si A4 entró).

**Commit:** `Pitch para una persona: guion, checklist y plan B`
