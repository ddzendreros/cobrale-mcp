# Plan de la noche · modo solo

**Quién:** Diego, solo. El código lo escribe el ejecutor (GPT‑6 Luna en max), Diego hace lo humano y los merges.
**Cuándo:** sábado 7 nov 23:30 → domingo 8 nov. **Freeze 10:00 · envío 11:30 · cierre 13:00.**
**Dónde vive el server:** Railway (proceso Node persistente, una réplica).

| Archivo | Para qué |
|---|---|
| `plan/README.md` | Este archivo: reglas, carriles, git, gate, horario, riesgos |
| [`plan/carril-a.md`](carril-a.md) | Tareas del ejecutor: núcleo de pagos, MCP, scripts, infra |
| [`plan/carril-b.md`](carril-b.md) | Tareas del ejecutor: Libreta, UI, landing, pitch |
| [`plan/humano.md`](humano.md) | Lo que solo Diego puede hacer: pey, Railway, pagos reales, Codex, video, envío |
| [`plan/demo.md`](demo.md) | Guion de 3 min para una persona, checklist antes de subir y plan B |

---

## 1. Cómo se usa esto con el ejecutor

1. Abre una sesión del ejecutor **en la raíz del worktree del carril** (`../cobrale-a` o `../cobrale-b`). Lee `AGENTS.md` solo.
2. Pega el **preámbulo** (abajo) una vez por sesión, cambiando `A`/`B`.
3. Después, para cada tarea, solo escribe: **`Ejecuta la tarea A1 de plan/carril-a.md.`**
4. Cuando termine, revisa su reporte y el diff (`git show --stat HEAD`), y haz el merge (sección 4).

Las tareas están escritas para leerse solas: traen contexto, archivos permitidos, pasos, criterios de aceptación, cómo probar y el mensaje de commit.

### Preámbulo (pegar al abrir cada sesión)

```text
Lee completos AGENTS.md y plan/README.md. Eres el ejecutor del CARRIL A de Cóbrale
(cambia a B si aplica) y estás en el worktree de la rama carril-a.

Reglas duras:
- Toca solo los archivos que la tarea permite. Si necesitas otro, detente y dime cuál y por qué.
- ESM, Node >= 18, sin TypeScript, sin build, sin dependencias nuevas (tampoco devDependencies).
- Todo texto que vea el usuario va en español de México.
- No cambies firmas del contrato de src/pey/payments.js (AGENTS.md). Solo agrega funciones o eventos nuevos.
- Todo debe seguir funcionando en modo demo, sin PEY_API_KEY ni OPENAI_API_KEY.
- No leas, imprimas ni copies .env, keys ni el contenido de data/ (salvo que la tarea lo pida).
- No hagas push ni merge. Solo commits en esta rama.
- Si algo de la tarea choca con el código real, gana el código: adáptate y dime qué cambiaste.

Al terminar cada tarea:
1. Corre `npm test` (existe desde la tarea A1; si aún no existe, levanta `npm start` con PORT libre
   y corre `npm run test:mcp -- http://localhost:<PORT>/mcp`).
2. Haz commit con el mensaje que indica la tarea.
3. Repórtame así:
   - Qué cambió (archivos y en una línea cada uno)
   - Cómo lo probé (comandos y resultado)
   - Qué NO pude probar (y cómo lo pruebo yo)
   - Riesgos o pendientes
```

> Tip de velocidad: max es lento. Para tareas chicas (A3, B7) puedes bajar el esfuerzo del ejecutor; para A1, A2, A4, B2, B3 y B5 déjalo en max.

---

## 2. Estado real (verificado el sáb 7 nov, 23:10, modo demo)

Probado levantando el server en un puerto aparte, con datos temporales:

- ✅ **Libreta:** cargar ejemplo, "Cóbrale a Doña Mary" → QR por $128, simular pago → saldo en 0, abono en efectivo, recordatorio (link + push), mostrador y foto (datos demo).
- ✅ **MCP:** las 6 herramientas por el SDK. QR con imagen, `esperar_pago` despierta en ~1.5 s, push, validación del celular, link, y `pagos_recibidos` junta Libreta + agentes.
- ✅ **Webhook:** firmado (Standard Webhooks) se acepta; sin firma → 401; duplicado detectado; pago sin cobro → "sin asignar".
- ❌ `scripts/test-mcp.js` truena si el server no está en el puerto 3000 (la URL de simulate está fija) y nunca falla con exit 1 → **A1**.
- ❌ Parser local: "cobrale a doña mary" (minúsculas) toma como cliente "cobrale" → **B1**.
- ⚠️ **Conciliación:** según el OpenAPI de pey, `GET /transaction/api-key` regresa `id`, `status: PAID`, `payableType`, `payableId`; el código busca `transactionId`, `codiQrId`, `numRef` → casi nunca casa → **A2**.
- ⚠️ **Pago contado dos veces / al cobro equivocado:** si la conciliación marca pagado un cobro y luego llega su webhook, el webhook ya no encuentra el cobro (está pagado) y cae al match por monto. Con `PEY_TEST_AMOUNT=0.01` todos valen lo mismo, así que puede marcar pagado **otro** cobro pendiente → **A2** (idempotencia por transacción).
- ⚠️ El webhook de QR de pey **no trae metadata**: solo casa si `codiQrId` == `id` que regresó `POST /codi/qr`. Es lo esperado pero **no está verificado** → H4 + A2b.
- ⚠️ "Hoy" usa la hora del servidor; Railway corre en UTC → `TZ=America/Mexico_City` (H2).
- ⚠️ El deploy es público y sin candado: cualquiera puede borrar la libreta o simular pagos → **B5** + `PEY_MCP_TOKEN`.
- ⚠️ Con `PEY_TEST_AMOUNT`, "Cobrado hoy" muestra el monto de la cuenta, no el $0.01 real. Se dice en el pitch con transparencia.

---

## 3. Carriles y dueños de archivos

Dos sesiones del ejecutor corren en paralelo, cada una en su worktree, sobre archivos que no se cruzan.

| Carril | Worktree · rama | Puede tocar |
|---|---|---|
| **A** núcleo + MCP + infra | `../cobrale-a` · `carril-a` | `src/pey/*`, `src/mcp/*`, `scripts/*`, `examples/*`, `package.json`, `railway.json`, `.env.example`, `docs/codex.md`, `README.md`, `AGENTS.md` |
| **B** Libreta + UI + landing | `../cobrale-b` · `carril-b` | `src/libreta/*`, `public/*`, `PITCH.md` |
| **Diego** | `AlanCobra` · `main` | merges, `.env`, Railway, pey, `plan/*` |
| nadie | — | `src/server.js`, `src/store.js` (solo si una tarea lo dice explícitamente) |

Las pruebas unitarias del carril B van en `src/libreta/*.test.js`; `npm test` (A1) las corre solas, así B nunca toca `package.json`.

### Preparar los worktrees (una vez, 5 min)

```bash
cd C:/Users/damia/Documents/Proyectos/AlanCobra
git pull
git worktree add ../cobrale-a -b carril-a
git worktree add ../cobrale-b -b carril-b
```

```bash
cd ../cobrale-a && npm install && cp .env.example .env
```

```bash
cd ../cobrale-b && npm install && cp .env.example .env
```

En el `.env` de cada carril pon solo `PORT=3101` (A) y `PORT=3102` (B), **sin `PEY_API_KEY`**. El carril B necesita `OPENAI_API_KEY` en su `.env` para la tarea B3. Las keys de pey viven solo en `AlanCobra/.env` y en Railway.

---

## 4. Git: cómo entra algo a `main`

`main` es lo que está desplegado: **cada push a main redeploya Railway** (y borra los datos si no hay volumen).

```bash
cd C:/Users/damia/Documents/Proyectos/AlanCobra
git merge --no-ff carril-a -m "Merge carril-a: A1"
npm test
git push origin main
```

Y luego el otro carril se pone al día (desde su worktree):

```bash
cd ../cobrale-b && git merge main
```

- Merge seguido y chico: una o dos tareas por merge.
- Si `npm test` falla en main después del merge: `git reset --hard ORIG_HEAD` (deshace el merge local, nada se pierde en la rama) y le pasas el error al ejecutor de ese carril.
- Prioridad de merge cuando hay prisa: A2b > A1 > A2 > B5 > B3 > B2 > A4 > lo demás.

---

## 5. Gate (definición de "terminado" para cualquier tarea)

- [ ] `npm test` pasa (desde A1) y `npm start` arranca sin errores.
- [ ] Funciona en modo demo, sin keys.
- [ ] Sin dependencias nuevas; `package-lock.json` sin cambios.
- [ ] Commit con el mensaje de la tarea; reporte del ejecutor leído.
- [ ] Lo que el ejecutor "no pudo probar" lo probaste tú o quedó anotado.

---

## 6. Horario

| Hora | Carril A | Carril B | Diego |
|---|---|---|---|
| 23:30–00:00 | **A1** gate de pruebas | **B1** parser local | Worktrees. **H1: pey desde cero (arrancar ya)** |
| 00:00–01:30 | **A2** conciliación + idempotencia | **B2** pestaña Agentes | H1 sigue · **H2 Railway** con main tal cual · H6 libreta de papel |
| 01:30–03:00 | A3 railway.json | **B3** foto real + latencia IA | Merge A1, A2, B1, B2 → deploy · **H3 webhook · H4 primer pago real** |
| 03:00–05:00 | **A2b** si hubo huérfano → **A4** cancelar_cobro | **B5** candado | Merge · **H5 Codex** + push real a tu cel |
| 05:00–07:00 | A5 (opcional) | B4 móvil → B6 landing | **Dormir.** Deja corriendo solo tareas de bajo riesgo |
| 07:00–08:30 | Solo bloqueadores | B7 PITCH | Merge de todo · regresión real · **08:00 decisión: ¿pey en vivo?** |
| 08:30–10:00 | — | — | **H7** dos ensayos + video de respaldo |
| 10:00 | **FREEZE** | **FREEZE** | Tag `v1.0`, no más push a main |
| 10:00–11:30 | — | — | **H8 envío** |

### Recorte (si a las 03:00 vas atrasado)

Se caen en este orden: **A5 → B6 → B4 → A3 → A4 → B2 → B1.**
Nunca se recortan: **H1–H5, A1, A2, A2b, B3, B5, H7, H8.**

### Índice de tareas

| ID | Prio | Tiempo | Depende de | Qué |
|---|---|---|---|---|
| A1 | P0 | 30 min | — | `npm test`: server aislado + Libreta + webhooks + MCP |
| A2 | P0 | 45 min | A1 | Conciliación con la forma real de pey, idempotencia, `PEY_DEBUG` |
| A2b | P0 | bajo demanda | H4 | Arreglar el match con el payload real |
| A3 | P1 | 15 min | — | `railway.json` + README de deploy |
| A4 | P1 | 45 min | A1 | `cancelar_cobro`, evento `superseded`, resource `cobrale://pagos/hoy` |
| A5 | P2 | 40 min | H2 | Agente de empresa conversacional |
| B1 | P1 | 25 min | — | Parser local con minúsculas + pruebas |
| B2 | P1 | 70 min | — (mejor con A4) | Pestaña Agentes + Conecta tu agente |
| B3 | P0 | 45 min | H6, `OPENAI_API_KEY` | Foto real, montos ilegibles, latencia IA |
| B5 | P1 | 30 min | — | `ADMIN_TOKEN`: deploy público en solo lectura |
| B4 | P1 | 40 min | B2 | Celular a 375 px |
| B6 | P2 | 45 min | A4 (para la lista de herramientas) | Landing `/agentes` |
| B7 | P0 | 15 min | — | `PITCH.md` para una persona |

---

## 7. Riesgos principales

| Riesgo | Qué lo evita |
|---|---|
| pey no se activa a tiempo | H1 es lo primero de la noche; pedir ayuda a mentores de pey temprano; **08:00 go/no-go** |
| El pago real queda "sin asignar" | A2 + `PEY_DEBUG` + A2b; **un solo cobro pendiente a la vez** en el demo |
| Pago contado dos veces o al cobro equivocado | Idempotencia por transacción (A2) |
| Redeploy a media demo borra los datos | Freeze 10:00, nada de push después; volumen opcional en Railway |
| Alguien manipula el deploy público | B5 (`ADMIN_TOKEN`) + `PEY_MCP_TOKEN` |
| La IA tarda en escena | `reasoning_effort` bajo (B3); Codex del demo con esfuerzo bajo (H5); parser local |
| El ejecutor en max tarda mucho | Dos carriles en paralelo, tareas cortas, tú haces lo humano mientras corre |
| Cansancio y errores de las 6 am | Dormir 05:00–07:00, freeze estricto, el runbook en `plan/demo.md` |
